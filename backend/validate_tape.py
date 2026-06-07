"""Validate a generated tape against the engine↔broadcast contract (lib/events.ts).

    python backend/validate_tape.py backend/out/<case_id>.json

Checks: every event type is known; seq is monotonic from 1; envelope fields present;
act in {1,2,3,4}; required data fields per event type; lifecycle completeness (ends with
verdict.final + case.closed; the key dramatic events are present).
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from events import EVENT_TYPES  # noqa: E402

# Minimal required keys in `data` per event type (mirrors event_schema.md §3).
REQUIRED: dict[str, list[str]] = {
    "case.filed": ["claim"],
    "subclaims.ready": ["subclaims"],
    "panel.cast": ["jurors", "axes_filled", "devils_advocate"],
    "panel.balance": ["passed", "mean_stance_prior", "axes_filled"],
    "evidence.ready": ["items"],
    "round.blind.start": [],
    "juror.thinking": ["juror_id"],
    "vote.cast": ["juror_id", "sealed"],
    "round.blind.reveal": ["tally", "per_juror"],
    "round.start": ["round"],
    "floor.speaker": ["juror_id"],
    "claim.made": ["juror_id", "text", "claim_ref"],
    "factcheck.result": ["claim_ref", "status"],
    "bias.flag": ["juror_id", "type", "severity"],
    "devils_advocate.attack": ["name", "argument"],
    "vote.shift": ["juror_id", "from", "to", "confidence"],
    "consensus.update": ["score", "label", "confidence", "convergence", "per_subclaim"],
    "turning_point": ["round", "trigger", "movers"],
    "round.end": ["round", "converged"],
    "verdict.final": ["consensus", "confidence", "ece", "takeaway", "per_subclaim",
                      "minority_report", "citations"],
    "case.closed": ["tape_uri"],
}

# Events the lifecycle must contain to be a complete deliberation.
MUST_APPEAR = [
    "case.filed", "subclaims.ready", "panel.cast", "panel.balance", "round.blind.start",
    "round.blind.reveal", "consensus.update", "round.start", "claim.made", "factcheck.result",
    "devils_advocate.attack", "verdict.final", "case.closed",
]


def validate(path: str) -> int:
    with open(path) as f:
        tape = json.load(f)
    events = tape.get("events", [])
    errors: list[str] = []
    seen: set[str] = set()

    if not events:
        print("FAIL: no events"); return 1

    expected_seq = 1
    for e in events:
        loc = f"seq={e.get('seq')} event={e.get('event')}"
        for k in ("event", "case_id", "seq", "ts", "round", "act", "data"):
            if k not in e:
                errors.append(f"{loc}: missing envelope field {k!r}")
        ev = e.get("event")
        seen.add(ev)
        if ev not in EVENT_TYPES:
            errors.append(f"{loc}: unknown event type")
        if e.get("seq") != expected_seq:
            errors.append(f"{loc}: seq not monotonic (expected {expected_seq})")
        expected_seq += 1
        if e.get("act") not in (1, 2, 3, 4):
            errors.append(f"{loc}: act {e.get('act')} not in 1..4")
        for k in REQUIRED.get(ev, []):
            if k not in (e.get("data") or {}):
                errors.append(f"{loc}: data missing {k!r}")

    for ev in MUST_APPEAR:
        if ev not in seen:
            errors.append(f"lifecycle: required event {ev!r} never appeared")
    if events[-1].get("event") != "case.closed":
        errors.append("lifecycle: tape does not end with case.closed")

    if errors:
        print(f"FAIL ({len(errors)} issues):")
        for e in errors[:40]:
            print("  -", e)
        return 1
    print(f"PASS: {len(events)} events, {len(seen)} distinct types, seq 1..{events[-1]['seq']} monotonic.")
    print(f"  types: {', '.join(sorted(seen))}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python backend/validate_tape.py <tape.json>"); raise SystemExit(2)
    raise SystemExit(validate(sys.argv[1]))
