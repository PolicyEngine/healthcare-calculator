from __future__ import annotations

import copy
import json
from dataclasses import asdict
from functools import lru_cache
from http.server import BaseHTTPRequestHandler
from typing import Any, Callable

from scripts.healthcare_calculator import (
    CalculatorDependencyError,
    HouseholdInput,
    PersonInput,
    SUPPORTED_IMMIGRATION_STATUSES,
    calculate_all_states,
    calculate_household,
    calculate_income_series,
    household_input_from_dict,
)


DEFAULT_SERIES_MAX_MAGI = 120_000
DEFAULT_SERIES_STEP = 10_000
DEFAULT_CHILDREN_MAX = 7

STATE_INFO = [
    {"code": "AL", "name": "Alabama"},
    {"code": "AK", "name": "Alaska"},
    {"code": "AZ", "name": "Arizona"},
    {"code": "AR", "name": "Arkansas"},
    {"code": "CA", "name": "California"},
    {"code": "CO", "name": "Colorado"},
    {"code": "CT", "name": "Connecticut"},
    {"code": "DE", "name": "Delaware"},
    {"code": "DC", "name": "District of Columbia"},
    {"code": "FL", "name": "Florida"},
    {"code": "GA", "name": "Georgia"},
    {"code": "HI", "name": "Hawaii"},
    {"code": "ID", "name": "Idaho"},
    {"code": "IL", "name": "Illinois"},
    {"code": "IN", "name": "Indiana"},
    {"code": "IA", "name": "Iowa"},
    {"code": "KS", "name": "Kansas"},
    {"code": "KY", "name": "Kentucky"},
    {"code": "LA", "name": "Louisiana"},
    {"code": "ME", "name": "Maine"},
    {"code": "MD", "name": "Maryland"},
    {"code": "MA", "name": "Massachusetts"},
    {"code": "MI", "name": "Michigan"},
    {"code": "MN", "name": "Minnesota"},
    {"code": "MS", "name": "Mississippi"},
    {"code": "MO", "name": "Missouri"},
    {"code": "MT", "name": "Montana"},
    {"code": "NE", "name": "Nebraska"},
    {"code": "NV", "name": "Nevada"},
    {"code": "NH", "name": "New Hampshire"},
    {"code": "NJ", "name": "New Jersey"},
    {"code": "NM", "name": "New Mexico"},
    {"code": "NY", "name": "New York"},
    {"code": "NC", "name": "North Carolina"},
    {"code": "ND", "name": "North Dakota"},
    {"code": "OH", "name": "Ohio"},
    {"code": "OK", "name": "Oklahoma"},
    {"code": "OR", "name": "Oregon"},
    {"code": "PA", "name": "Pennsylvania"},
    {"code": "RI", "name": "Rhode Island"},
    {"code": "SC", "name": "South Carolina"},
    {"code": "SD", "name": "South Dakota"},
    {"code": "TN", "name": "Tennessee"},
    {"code": "TX", "name": "Texas"},
    {"code": "UT", "name": "Utah"},
    {"code": "VT", "name": "Vermont"},
    {"code": "VA", "name": "Virginia"},
    {"code": "WA", "name": "Washington"},
    {"code": "WV", "name": "West Virginia"},
    {"code": "WI", "name": "Wisconsin"},
    {"code": "WY", "name": "Wyoming"},
]

STATE_NAME_BY_CODE = {
    state["code"]: state["name"]
    for state in STATE_INFO
}


def _annual_to_monthly(value: float) -> float:
    return round(value / 12, 2)


def _serialize_payload(payload: HouseholdInput) -> str:
    return json.dumps(asdict(payload), sort_keys=True)


def parse_household_payload(raw_payload: dict[str, Any]) -> HouseholdInput:
    return household_input_from_dict(raw_payload)


def _program_detail(
    adults: int,
    children: int,
    zero_detail: str,
    positive_label: str,
) -> str:
    if adults == 0 and children == 0:
        return zero_detail

    parts = []
    if adults:
        parts.append(f"{adults} adult(s)")
    if children:
        parts.append(f"{children} child(ren)")
    return f"{', '.join(parts)} {positive_label}".strip()


def _build_programs(raw_result: dict[str, Any]) -> list[dict[str, Any]]:
    adults_with_medicaid = sum(
        1
        for person in raw_result["people"]
        if person["role"] != "dependent" and person["is_medicaid_eligible"]
    )
    children_with_medicaid = sum(
        1
        for person in raw_result["people"]
        if person["role"] == "dependent" and person["is_medicaid_eligible"]
    )
    adults_with_aca = sum(
        1
        for person in raw_result["people"]
        if person["role"] != "dependent" and person["is_aca_ptc_eligible"]
    )
    children_with_aca = sum(
        1
        for person in raw_result["people"]
        if person["role"] == "dependent" and person["is_aca_ptc_eligible"]
    )
    children_with_chip = sum(
        1
        for person in raw_result["people"]
        if person["role"] == "dependent" and person["is_chip_eligible"]
    )

    return [
        {
            "key": "medicaid",
            "label": "Medicaid",
            "short_label": "Medicaid",
            "amount": _annual_to_monthly(raw_result["totals"]["medicaid"]),
            "detail": _program_detail(
                adults_with_medicaid,
                children_with_medicaid,
                "No modeled Medicaid eligibility in this state.",
                "with Medicaid eligibility",
            ),
        },
        {
            "key": "chip",
            "label": "CHIP",
            "short_label": "CHIP",
            "amount": _annual_to_monthly(raw_result["totals"]["chip"]),
            "detail": _program_detail(
                0,
                children_with_chip,
                "No modeled CHIP eligibility in this state.",
                "with CHIP eligibility",
            ),
        },
        {
            "key": "aca",
            "label": "ACA premium tax credits",
            "short_label": "ACA",
            "amount": _annual_to_monthly(raw_result["totals"]["aca_ptc"]),
            "detail": _program_detail(
                adults_with_aca,
                children_with_aca,
                "No modeled marketplace subsidy in this state.",
                "eligible for marketplace subsidies",
            ),
        },
    ]


def _build_notes(payload: HouseholdInput, raw_result: dict[str, Any]) -> list[str]:
    notes = []
    if not raw_result["totals"]["healthcare_benefit_value"]:
        notes.append(
            "No ACA premium tax credits, Medicaid value, or CHIP value are modeled for this household in the selected state."
        )

    if any(person.has_esi for person in payload.people):
        notes.append(
            "Employer coverage is treated as an ACA-disqualifying offer for this first pass."
        )

    if any(person.is_pregnant for person in payload.people):
        notes.append(
            "Pregnancy is included in the Medicaid and CHIP eligibility calculation."
        )

    return notes


def format_household_result(
    payload: HouseholdInput,
    raw_result: dict[str, Any],
) -> dict[str, Any]:
    support_annual = round(raw_result["totals"]["healthcare_benefit_value"], 2)
    support_monthly = _annual_to_monthly(support_annual)
    programs = _build_programs(raw_result)

    return {
        "eligible": support_annual > 0,
        "support_annual": support_annual,
        "support_monthly": support_monthly,
        "state": payload.state,
        "state_name": STATE_NAME_BY_CODE[payload.state],
        "year": payload.year,
        "household": {
            "num_adults": sum(1 for person in payload.people if person.role != "dependent"),
            "num_children": sum(1 for person in payload.people if person.role == "dependent"),
            "tax_unit_magi": payload.tax_unit_magi,
        },
        "breakdown": {
            "programs": programs,
        },
        "programs": programs,
        "notes": _build_notes(payload, raw_result),
        "counts": raw_result["counts"],
        "context": raw_result["context"],
        "people": raw_result["people"],
    }


def format_states_result(raw_result: list[dict[str, Any]]) -> dict[str, Any]:
    states = [
        {
            "state": item["state"],
            "state_name": STATE_NAME_BY_CODE[item["state"]],
            "support_annual": round(item["healthcare_benefit_value"], 2),
            "support_monthly": _annual_to_monthly(item["healthcare_benefit_value"]),
            "aca_monthly": _annual_to_monthly(item["aca_ptc"]),
            "medicaid_monthly": _annual_to_monthly(item["medicaid"]),
            "chip_monthly": _annual_to_monthly(item["chip"]),
            "eligible": item["healthcare_benefit_value"] > 0,
        }
        for item in raw_result
    ]
    return {
        "states": states,
        "max_support": max((item["support_monthly"] for item in states), default=0),
    }


def format_series_result(raw_result: list[dict[str, Any]]) -> dict[str, Any]:
    data = [
        {
            "tax_unit_magi": item["tax_unit_magi"],
            "support_annual": round(item["healthcare_benefit_value"], 2),
            "support_monthly": _annual_to_monthly(item["healthcare_benefit_value"]),
            "eligible": item["healthcare_benefit_value"] > 0,
        }
        for item in raw_result
    ]
    return {
        "data": data,
        "max_support_monthly": max(
            (item["support_monthly"] for item in data),
            default=0,
        ),
    }


def _default_person(
    person_id: str,
    role: str,
    age: int,
) -> dict[str, Any]:
    return asdict(
        PersonInput(
            id=person_id,
            role=role,
            age=age,
        )
    )


def _scenario_people_for_children(
    payload_data: dict[str, Any],
    child_count: int,
) -> list[dict[str, Any]]:
    adults = [
        copy.deepcopy(person)
        for person in payload_data["people"]
        if person["role"] != "dependent"
    ]
    current_children = [
        copy.deepcopy(person)
        for person in payload_data["people"]
        if person["role"] == "dependent"
    ]
    fallback_age = current_children[-1]["age"] if current_children else 8

    next_children = []
    for index in range(child_count):
        if index < len(current_children):
            child = current_children[index]
        else:
            child = _default_person(
                person_id=f"child_{index + 1}",
                role="dependent",
                age=fallback_age,
            )
        child["id"] = f"child_{index + 1}"
        child["role"] = "dependent"
        next_children.append(child)

    return adults + next_children


@lru_cache(maxsize=128)
def _household_result_cached(serialized_payload: str) -> dict[str, Any]:
    payload = parse_household_payload(json.loads(serialized_payload))
    return calculate_household(payload)


@lru_cache(maxsize=128)
def _all_states_cached(serialized_payload: str) -> list[dict[str, Any]]:
    payload = parse_household_payload(json.loads(serialized_payload))
    return calculate_all_states(payload)


@lru_cache(maxsize=128)
def _income_series_cached(
    serialized_payload: str,
    max_magi: int,
    step: int,
) -> list[dict[str, Any]]:
    payload = parse_household_payload(json.loads(serialized_payload))
    return calculate_income_series(
        payload,
        max_magi=max_magi,
        step=step,
    )


@lru_cache(maxsize=64)
def _household_size_cached(
    serialized_payload: str,
    max_children: int,
) -> list[dict[str, Any]]:
    payload_data = json.loads(serialized_payload)
    state_results = []

    for child_count in range(max_children + 1):
        scenario_data = copy.deepcopy(payload_data)
        scenario_data["people"] = _scenario_people_for_children(
            payload_data,
            child_count,
        )
        scenario_payload = parse_household_payload(scenario_data)
        raw_result = calculate_household(scenario_payload)
        state_results.append(
            {
                "children": child_count,
                "support_monthly": _annual_to_monthly(
                    raw_result["totals"]["healthcare_benefit_value"]
                ),
            }
        )

    return state_results


def compute_household(payload: HouseholdInput) -> dict[str, Any]:
    serialized_payload = _serialize_payload(payload)
    raw_result = _household_result_cached(serialized_payload)
    return format_household_result(payload, raw_result)


def compute_states(payload: HouseholdInput) -> dict[str, Any]:
    raw_result = _all_states_cached(_serialize_payload(payload))
    return format_states_result(raw_result)


def compute_series(
    payload: HouseholdInput,
    max_magi: int = DEFAULT_SERIES_MAX_MAGI,
    step: int = DEFAULT_SERIES_STEP,
) -> dict[str, Any]:
    raw_result = _income_series_cached(_serialize_payload(payload), max_magi, step)
    return format_series_result(raw_result)


def compute_household_size(
    payload: HouseholdInput,
    max_children: int = DEFAULT_CHILDREN_MAX,
) -> dict[str, Any]:
    data = _household_size_cached(_serialize_payload(payload), max_children)
    return {"data": data}


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    content_length = int(handler.headers.get("content-length", "0"))
    if content_length <= 0:
        raise ValueError("Request body is required")

    body = handler.rfile.read(content_length)
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError("Request body must be valid JSON") from exc


def send_json(
    handler: BaseHTTPRequestHandler,
    payload: dict[str, Any],
    status_code: int = 200,
    cache_control: str = "s-maxage=60, stale-while-revalidate=600",
) -> None:
    encoded = json.dumps(payload).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Cache-Control", cache_control)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(encoded)


def send_error_json(
    handler: BaseHTTPRequestHandler,
    status_code: int,
    message: str,
) -> None:
    send_json(handler, {"error": message}, status_code=status_code, cache_control="no-store")


def handle_options(handler: BaseHTTPRequestHandler) -> None:
    handler.send_response(204)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()


def handle_post(
    handler: BaseHTTPRequestHandler,
    compute: Callable[[dict[str, Any]], dict[str, Any]],
) -> None:
    try:
        payload = read_json_body(handler)
        response = compute(payload)
    except ValueError as exc:
        send_error_json(handler, 400, str(exc))
    except CalculatorDependencyError as exc:
        send_error_json(handler, 500, str(exc))
    except Exception as exc:
        send_error_json(handler, 500, f"Calculation failed: {exc}")
    else:
        send_json(handler, response)


def metadata_response() -> dict[str, Any]:
    return {
        "year": 2026,
        "states": STATE_INFO,
        "supported_immigration_statuses": SUPPORTED_IMMIGRATION_STATUSES,
    }
