from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Any


DEFAULT_YEAR = 2026

STATE_CODES = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
]

IMMIGRATION_STATUS_TO_PE = {
    "Citizen": "CITIZEN",
    "Legal Permanent Resident": "LEGAL_PERMANENT_RESIDENT",
    "Refugee": "REFUGEE",
    "Asylee": "ASYLEE",
    "Deportation Withheld": "DEPORTATION_WITHHELD",
    "Cuban/Haitian Entrant": "CUBAN_HAITIAN_ENTRANT",
    "Conditional Entrant": "CONDITIONAL_ENTRANT",
    "Paroled for at Least One Year": "PAROLED_ONE_YEAR",
    "Undocumented": "UNDOCUMENTED",
    "Deferred Action for Childhood Arrivals": "DACA",
    "Temporary Protected Status": "TPS",
}

SUPPORTED_IMMIGRATION_STATUSES = list(IMMIGRATION_STATUS_TO_PE)

ACCESS_LEVEL_BY_PROGRAM = {
    "none": 0,
    "aca": 1,
    "chip": 2,
    "medicaid": 3,
}


class CalculatorDependencyError(RuntimeError):
    pass


@dataclass
class PersonInput:
    id: str
    role: str
    age: int
    has_esi: bool = False
    offered_aca_disqualifying_esi: bool = False
    is_pregnant: bool = False
    pregnancy_month: int | None = None
    under_60_days_postpartum: bool = False
    immigration_status: str = "Citizen"
    has_itin: bool = True


@dataclass
class HouseholdInput:
    state: str
    tax_unit_magi: float
    people: list[PersonInput] = field(default_factory=list)
    year: int = DEFAULT_YEAR
    county: str | None = None
    zip_code: str | None = None


def _load_simulation():
    policyengine_repo = os.getenv("POLICYENGINE_US_REPO")
    if policyengine_repo:
        sys.path.insert(0, policyengine_repo)

    try:
        from policyengine_us import Simulation
    except ModuleNotFoundError as exc:
        raise CalculatorDependencyError(
            "PolicyEngine dependencies are not installed. "
            "Run `pip install -r scripts/requirements.txt` or set "
            "`POLICYENGINE_US_REPO` to a local checkout with its dependencies installed."
        ) from exc

    return Simulation


def _as_float(value: Any) -> float:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, list):
        return float(value[0])
    return float(value)


def _as_bool_list(value: Any) -> list[bool]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    return [bool(item) for item in value]


def _normalize_county(county: str | None, state: str) -> str | None:
    if county is None:
        return None

    normalized = (
        county.strip()
        .upper()
        .replace(",", "")
        .replace(".", "")
        .replace("-", "_")
        .replace(" ", "_")
    )
    if normalized.endswith(f"_{state}"):
        return normalized
    return f"{normalized}_{state}"


def _best_access_program(
    is_aca_ptc_eligible: bool,
    is_medicaid_eligible: bool,
    is_chip_eligible: bool,
) -> tuple[str, int]:
    if is_medicaid_eligible:
        return "medicaid", ACCESS_LEVEL_BY_PROGRAM["medicaid"]
    if is_chip_eligible:
        return "chip", ACCESS_LEVEL_BY_PROGRAM["chip"]
    if is_aca_ptc_eligible:
        return "aca", ACCESS_LEVEL_BY_PROGRAM["aca"]
    return "none", ACCESS_LEVEL_BY_PROGRAM["none"]


def _access_summary(people: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {
        "medicaid_people": 0,
        "chip_people": 0,
        "aca_people": 0,
        "uncovered_people": 0,
    }
    vector = []

    for person in people:
        program = person["best_access_program"]
        counts_key = {
            "medicaid": "medicaid_people",
            "chip": "chip_people",
            "aca": "aca_people",
            "none": "uncovered_people",
        }[program]
        counts[counts_key] += 1
        vector.append(person["best_access_level"])

    return {
        **counts,
        "access_vector": sorted(vector, reverse=True),
    }


def _validate_input(payload: HouseholdInput) -> None:
    if payload.state not in STATE_CODES:
        raise ValueError(f"Unsupported state code: {payload.state}")
    if payload.tax_unit_magi < 0:
        raise ValueError("tax_unit_magi must be non-negative")
    if not payload.people:
        raise ValueError("At least one person is required")

    ids = [person.id for person in payload.people]
    if len(ids) != len(set(ids)):
        raise ValueError("Each person id must be unique")

    roles = [person.role for person in payload.people]
    if roles.count("head") != 1:
        raise ValueError("Exactly one person must have role='head'")
    if roles.count("spouse") > 1:
        raise ValueError("At most one person may have role='spouse'")

    for person in payload.people:
        if person.role not in {"head", "spouse", "dependent"}:
            raise ValueError(f"Unsupported role: {person.role}")
        if person.age < 0:
            raise ValueError(f"Age must be non-negative for {person.id}")
        if person.immigration_status not in SUPPORTED_IMMIGRATION_STATUSES:
            raise ValueError(
                f"Unsupported immigration_status for {person.id}: "
                f"{person.immigration_status}"
            )
        if person.pregnancy_month is not None and not 1 <= person.pregnancy_month <= 9:
            raise ValueError(
                f"pregnancy_month must be between 1 and 9 for {person.id}"
            )


def build_household_situation(payload: HouseholdInput) -> dict[str, Any]:
    _validate_input(payload)

    year = payload.year
    people = {}
    member_ids = [person.id for person in payload.people]

    for person in payload.people:
        person_data: dict[str, Any] = {
            "age": {year: person.age},
            "has_esi": {year: person.has_esi},
            "offered_aca_disqualifying_esi": {
                year: person.offered_aca_disqualifying_esi
            },
            "is_pregnant": {year: person.is_pregnant},
            "under_60_days_postpartum": {year: person.under_60_days_postpartum},
            "has_itin": {year: person.has_itin},
            "immigration_status_str": {
                year: IMMIGRATION_STATUS_TO_PE[person.immigration_status]
            },
        }
        if person.is_pregnant and person.pregnancy_month is not None:
            person_data["current_pregnancy_month"] = {
                f"{year}-{month:02d}": person.pregnancy_month
                for month in range(1, 13)
            }
        people[person.id] = person_data

    household = {
        "members": member_ids,
        "state_name": {year: payload.state},
    }
    county = _normalize_county(payload.county, payload.state)
    if county:
        household["county"] = {year: county}
    if payload.zip_code:
        household["zip_code"] = {year: payload.zip_code}

    situation: dict[str, Any] = {
        "people": people,
        "families": {"family": {"members": member_ids}},
        "spm_units": {"spm_unit": {"members": member_ids}},
        "tax_units": {
            "tax_unit": {
                "members": member_ids,
                "aca_magi": {year: payload.tax_unit_magi},
                "medicaid_magi": {year: payload.tax_unit_magi},
            }
        },
        "households": {"household": household},
        "marital_units": {},
    }

    head_and_spouse = [
        person.id for person in payload.people if person.role in {"head", "spouse"}
    ]
    if head_and_spouse:
        situation["marital_units"]["primary_marital_unit"] = {
            "members": head_and_spouse,
        }

    dependents = [person.id for person in payload.people if person.role == "dependent"]
    for dependent in dependents:
        situation["marital_units"][f"{dependent}_marital_unit"] = {
            "members": [dependent]
        }

    return situation


def calculate_household(payload: HouseholdInput) -> dict[str, Any]:
    Simulation = _load_simulation()
    situation = build_household_situation(payload)
    simulation = Simulation(situation=situation)
    year = payload.year

    aca_eligible = _as_bool_list(
        simulation.calculate("is_aca_ptc_eligible", period=year)
    )
    medicaid_eligible = _as_bool_list(
        simulation.calculate("is_medicaid_eligible", period=year)
    )
    chip_eligible = _as_bool_list(
        simulation.calculate("is_chip_eligible", period=year)
    )

    people = []
    for person, aca, medicaid, chip in zip(
        payload.people,
        aca_eligible,
        medicaid_eligible,
        chip_eligible,
    ):
        best_access_program, best_access_level = _best_access_program(
            is_aca_ptc_eligible=aca,
            is_medicaid_eligible=medicaid,
            is_chip_eligible=chip,
        )
        people.append(
            {
                "id": person.id,
                "role": person.role,
                "age": person.age,
                "has_esi": person.has_esi,
                "offered_aca_disqualifying_esi": person.offered_aca_disqualifying_esi,
                "is_pregnant": person.is_pregnant,
                "immigration_status": person.immigration_status,
                "is_aca_ptc_eligible": aca,
                "is_medicaid_eligible": medicaid,
                "is_chip_eligible": chip,
                "best_access_program": best_access_program,
                "best_access_level": best_access_level,
            }
        )

    totals = {
        "aca_ptc": _as_float(
            simulation.calculate("aca_ptc", map_to="tax_unit", period=year)
        ),
        "medicaid": _as_float(
            simulation.calculate("medicaid_cost", map_to="household", period=year)
        ),
        "chip": _as_float(
            simulation.calculate("chip", map_to="household", period=year)
        ),
        "healthcare_benefit_value": _as_float(
            simulation.calculate(
                "healthcare_benefit_value",
                map_to="household",
                period=year,
            )
        ),
    }
    access = _access_summary(people)

    return {
        "input": {
            "state": payload.state,
            "county": county if (county := _normalize_county(payload.county, payload.state)) else None,
            "zip_code": payload.zip_code,
            "tax_unit_magi": payload.tax_unit_magi,
            "year": year,
        },
        "totals": totals,
        "counts": {
            "aca_ptc_eligible_people": int(sum(aca_eligible)),
            "medicaid_eligible_people": int(sum(medicaid_eligible)),
            "chip_eligible_people": int(sum(chip_eligible)),
        },
        "access": access,
        "context": {
            "aca_magi": _as_float(
                simulation.calculate("aca_magi", map_to="tax_unit", period=year)
            ),
            "medicaid_magi": _as_float(
                simulation.calculate("medicaid_magi", map_to="tax_unit", period=year)
            ),
            "aca_magi_fraction": _as_float(
                simulation.calculate(
                    "aca_magi_fraction",
                    map_to="tax_unit",
                    period=year,
                )
            ),
            "tax_unit_fpg": _as_float(
                simulation.calculate("tax_unit_fpg", map_to="tax_unit", period=year)
            ),
            "slcsp": _as_float(
                simulation.calculate("slcsp", map_to="tax_unit", period=year)
            ),
        },
        "people": people,
    }


def calculate_all_states(payload: HouseholdInput) -> list[dict[str, Any]]:
    results = []
    for state in STATE_CODES:
        scenario = HouseholdInput(
            state=state,
            tax_unit_magi=payload.tax_unit_magi,
            people=payload.people,
            year=payload.year,
            county=None,
            zip_code=None,
        )
        result = calculate_household(scenario)
        results.append(
            {
                "state": state,
                "aca_ptc": result["totals"]["aca_ptc"],
                "medicaid": result["totals"]["medicaid"],
                "chip": result["totals"]["chip"],
                "healthcare_benefit_value": result["totals"][
                    "healthcare_benefit_value"
                ],
                "access_vector": result["access"]["access_vector"],
                "medicaid_people": result["access"]["medicaid_people"],
                "chip_people": result["access"]["chip_people"],
                "aca_people": result["access"]["aca_people"],
                "uncovered_people": result["access"]["uncovered_people"],
            }
        )
    return results


def calculate_income_series(
    payload: HouseholdInput,
    max_magi: int = 120_000,
    step: int = 2_000,
) -> list[dict[str, Any]]:
    series = []
    for magi in range(0, max_magi + step, step):
        scenario = HouseholdInput(
            state=payload.state,
            county=payload.county,
            zip_code=payload.zip_code,
            tax_unit_magi=magi,
            people=payload.people,
            year=payload.year,
        )
        result = calculate_household(scenario)
        series.append(
            {
                "tax_unit_magi": magi,
                "aca_ptc": result["totals"]["aca_ptc"],
                "medicaid": result["totals"]["medicaid"],
                "chip": result["totals"]["chip"],
                "healthcare_benefit_value": result["totals"][
                    "healthcare_benefit_value"
                ],
            }
        )
    return series


def household_input_from_dict(data: dict[str, Any]) -> HouseholdInput:
    people = [PersonInput(**person) for person in data["people"]]
    return HouseholdInput(
        state=data["state"],
        year=data.get("year", DEFAULT_YEAR),
        county=data.get("county"),
        zip_code=data.get("zip_code"),
        tax_unit_magi=float(data.get("tax_unit_magi", 0)),
        people=people,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "input",
        nargs="?",
        default="scripts/sample_household.json",
        help="Path to input JSON. Use '-' to read from stdin.",
    )
    parser.add_argument(
        "--mode",
        choices=["household", "states", "series"],
        default="household",
    )
    parser.add_argument("--max-magi", type=int, default=120_000)
    parser.add_argument("--step", type=int, default=2_000)
    return parser.parse_args()


def _load_input(path: str) -> HouseholdInput:
    if path == "-":
        raw = json.load(sys.stdin)
    else:
        with open(path) as file:
            raw = json.load(file)
    return household_input_from_dict(raw)


def main() -> None:
    args = _parse_args()
    payload = _load_input(args.input)

    if args.mode == "household":
        result = calculate_household(payload)
    elif args.mode == "states":
        result = calculate_all_states(payload)
    else:
        result = calculate_income_series(
            payload,
            max_magi=args.max_magi,
            step=args.step,
        )

    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
