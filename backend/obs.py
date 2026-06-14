"""Observability — route logs/traces to the App Insights resource that's already provisioned.

`configure_azure_monitor` auto-instruments the stdlib `logging` module (plus FastAPI/HTTP), so
plain `log_event(...)` lands in App Insights as a trace with custom dimensions. A `case_id`
contextvar lets every LLM call and lifecycle line carry the deliberation it belongs to — the
model registry is shared across concurrent runs, but contextvars are copied into the asyncio
tasks each run spawns, so per-case slicing stays accurate.

Telemetry is best-effort: if the SDK or connection string is missing we fall back to stdout and
never break startup.
"""
from __future__ import annotations

import logging
from contextvars import ContextVar

case_id_var: ContextVar[str] = ContextVar("case_id", default="-")
log = logging.getLogger("verdict")

_configured = False


def setup_observability(connection_string: str = "") -> None:
    global _configured
    if _configured:
        return
    logging.basicConfig(level=logging.INFO)
    if connection_string:
        try:
            from azure.monitor.opentelemetry import configure_azure_monitor

            configure_azure_monitor(connection_string=connection_string, logger_name="verdict")
            log.info("observability: App Insights wired")
        except Exception as exc:  # noqa: BLE001 — telemetry must never break the service
            log.warning("observability: App Insights unavailable (%s); stdout only",
                        type(exc).__name__)
    _configured = True


def log_event(msg: str, **fields) -> None:
    """Structured log carrying the current case_id + arbitrary fields (App Insights dimensions)."""
    log.info(msg, extra={"case_id": case_id_var.get(), **fields})
