"""Event bus — the engine ↔ broadcast contract (mirrors lib/events.ts & event_schema.md).

`seq` is the spine: monotonic per case, the renderer's ordering/dedupe/scrub index.
Every emitted Envelope is (a) appended to an in-memory log (the tape), (b) optionally
persisted to Cosmos, and (c) fanned out to any live SSE subscribers.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

# The 21 event types, kept in lockstep with lib/events.ts EventType.
EVENT_TYPES = {
    "case.filed", "subclaims.ready", "panel.cast", "panel.balance", "evidence.ready",
    "round.blind.start", "juror.thinking", "vote.cast", "round.blind.reveal",
    "round.start", "floor.speaker", "claim.made", "factcheck.result", "bias.flag",
    "devils_advocate.attack", "vote.shift", "consensus.update", "turning_point",
    "round.end", "verdict.final", "case.closed",
}

Act = int  # 1 | 2 | 3 | 4
Persist = Callable[[dict], Awaitable[None]]


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class EventBus:
    """Per-case event spine. Construct one per deliberation."""

    def __init__(self, case_id: str, persist: Persist | None = None):
        self.case_id = case_id
        self._persist = persist
        self._seq = 0
        self.log: list[dict] = []                  # the in-memory tape
        self._subscribers: set[asyncio.Queue] = set()
        self.closed = False

    async def emit(self, event: str, data: dict[str, Any], *, round: int, act: Act) -> dict:
        if event not in EVENT_TYPES:
            raise ValueError(f"unknown event type: {event!r}")
        self._seq += 1
        env = {
            "event": event,
            "case_id": self.case_id,
            "seq": self._seq,
            "ts": _now_iso(),
            "round": round,
            "act": act,
            "data": data,
        }
        # Append + fan-out happen with NO await between them, so a concurrent subscribe()
        # snapshot can't both include this env in its backlog AND receive it on the queue
        # (which would double-deliver). Persistence is awaited only afterwards.
        self.log.append(env)
        for q in list(self._subscribers):
            q.put_nowait(env)
        if event == "case.closed":
            self.closed = True
            for q in list(self._subscribers):
                q.put_nowait(None)  # sentinel: stream complete
        if self._persist is not None:
            try:
                await self._persist(env)
            except Exception:  # noqa: BLE001 — persistence must never break the live stream
                pass
        return env

    # -- SSE fan-out ------------------------------------------------------
    def subscribe(self, after_seq: int = 0) -> tuple[list[dict], asyncio.Queue]:
        """Return (backlog after `after_seq`, live queue for everything subsequent).

        Caller drains the backlog first, then awaits the queue. This is reconnect-safe:
        a client reconnecting with Last-Event-ID=N gets the gap then the live tail.
        """
        backlog = [e for e in self.log if e["seq"] > after_seq]
        q: asyncio.Queue = asyncio.Queue()
        if self.closed and not backlog:
            q.put_nowait(None)
        self._subscribers.add(q)
        return backlog, q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    # -- tape -------------------------------------------------------------
    def tape(self, *, title: str = "", evidence_catalog: list | None = None) -> dict:
        """Assemble a replay tape identical in shape to public/case_*_tape.json."""
        return {
            "tape_version": "1.0",
            "case_id": self.case_id,
            "title": title,
            "note": "Generated live by the MAF swarm; schema-valid per 12_angry_agents_event_schema.md.",
            "evidence_catalog": evidence_catalog or [],
            "events": self.log,
        }
