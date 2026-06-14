"""FastAPI surface — start a deliberation, stream it over SSE, fetch the tape.

The front-end (lib/useEventStream.ts) swaps its fetch(tape) for
`new EventSource('/api/cases/{id}/stream')` and feeds each message's JSON envelope to the
SAME reducer — live and cached replay run through one renderer (README "Swapping to a live
backend"). Reconnects send Last-Event-ID; we replay the gap then tail live.
"""
from __future__ import annotations

import asyncio
import json
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from cases import custom_case, load_case
from config import Settings
from cosmos_store import CosmosTapeStore
from events import EventBus
from guards import ConcurrencyCap, SlidingWindowLimiter, client_ip
from models import ModelRegistry
from orchestrator import Foreman

app = FastAPI(title="Verdict — Deliberation Engine")
# Allowed origins: localhost for dev + the deployed web app (ALLOWED_ORIGINS, comma-separated,
# set from the web container app's FQDN in infra/resources.bicep).
_origins = ["http://localhost:3000"] + [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"],
)

_settings: Settings
_registry: ModelRegistry
_store: CosmosTapeStore
_limiter: SlidingWindowLimiter
_cap: ConcurrencyCap
_buses: dict[str, EventBus] = {}
_tasks: dict[str, asyncio.Task] = {}


@app.on_event("startup")
async def _startup() -> None:
    global _settings, _registry, _store, _limiter, _cap
    _settings = Settings.load()
    _registry = ModelRegistry(_settings)
    _store = CosmosTapeStore(_settings)
    _limiter = SlidingWindowLimiter(_settings.rate_limit_per_min, window_seconds=60.0)
    _cap = ConcurrencyCap(_settings.max_active_deliberations)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await _registry.aclose()
    await _store.aclose()


@app.post("/api/cases")
async def start_case(request: Request) -> JSONResponse:
    # --- Guardrails: protect the wallet on a public endpoint (see guards.py) ----------
    if _settings.api_key and request.headers.get("x-api-key") != _settings.api_key:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if not _limiter.allow(client_ip(request)):
        return JSONResponse(
            {"error": "rate_limited",
             "detail": f"max {_settings.rate_limit_per_min} deliberations/min per client"},
            status_code=429,
        )
    if not _cap.try_acquire():
        return JSONResponse(
            {"error": "at_capacity",
             "detail": f"max {_settings.max_active_deliberations} concurrent deliberations; retry shortly"},
            status_code=429,
        )

    body = await request.json() if await request.body() else {}
    if body.get("claim"):
        case = custom_case(body["claim"], user_prior=float(body.get("user_prior", 0.0)),
                           evidence=body.get("evidence") or [])
    else:
        case = load_case(body.get("case", "C"))

    bus = EventBus(case["case_id"], persist=_store.append)
    _buses[case["case_id"]] = bus

    async def _run():
        try:
            await Foreman(_settings, _registry, bus).run(case)
        except Exception as exc:  # noqa: BLE001 — surface, don't crash the server
            print(f"[deliberation {case['case_id']}] failed: {type(exc).__name__}: {exc}")
        finally:
            _cap.release()  # free the concurrency slot whether the run succeeded or failed

    _tasks[case["case_id"]] = asyncio.create_task(_run())
    return JSONResponse({"case_id": case["case_id"], "title": case["title"]})


@app.get("/api/cases/{case_id}/stream")
async def stream_case(case_id: str, request: Request) -> EventSourceResponse:
    after = int(request.headers.get("Last-Event-ID", "0") or "0")
    bus = _buses.get(case_id)

    async def gen():
        if bus is None:  # closed/unknown case: replay the durable tape from Cosmos
            for env in await _store.read_tape(case_id):
                if env["seq"] > after:
                    yield {"id": str(env["seq"]), "data": json.dumps(env)}
            return
        backlog, q = bus.subscribe(after_seq=after)
        try:
            for env in backlog:
                yield {"id": str(env["seq"]), "data": json.dumps(env)}
            while True:
                env = await q.get()
                if env is None:  # stream complete
                    break
                yield {"id": str(env["seq"]), "data": json.dumps(env)}
        finally:
            bus.unsubscribe(q)

    return EventSourceResponse(gen())


@app.get("/api/cases/{case_id}/tape")
async def get_tape(case_id: str) -> JSONResponse:
    bus = _buses.get(case_id)
    if bus is not None:
        return JSONResponse(bus.tape())
    return JSONResponse({"case_id": case_id, "events": await _store.read_tape(case_id)})


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
