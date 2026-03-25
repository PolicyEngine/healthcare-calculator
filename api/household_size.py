from __future__ import annotations

from http.server import BaseHTTPRequestHandler

from api._shared import (
    DEFAULT_CHILDREN_MAX,
    compute_household_size,
    handle_options,
    handle_post,
    parse_household_payload,
)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        handle_options(self)

    def do_POST(self) -> None:
        handle_post(
            self,
            lambda raw_payload: compute_household_size(
                parse_household_payload(raw_payload),
                max_children=int(raw_payload.get("max_children", DEFAULT_CHILDREN_MAX)),
            ),
        )
