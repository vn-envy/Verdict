"""Run one deliberation end-to-end locally (no server) and dump the tape.

    python backend/run_local.py --case C --panel 12 --rounds 3
    python backend/run_local.py --case C --panel 6   # cheap/fast correctness pass

Writes backend/out/<case_id>.json — feed it to validate_tape.py or drop it in public/
to render in the existing UI.
"""
from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cases import load_case  # noqa: E402
from config import Settings  # noqa: E402
from cosmos_store import CosmosTapeStore  # noqa: E402
from events import EventBus  # noqa: E402
from orchestrator import run_case  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")


async def main() -> int:
    ap = argparse.ArgumentParser(description="Run a 12 Angry Agents deliberation locally.")
    ap.add_argument("--case", default="C", help="house case key: A | B | C")
    ap.add_argument("--claim", default=None, help="a custom claim to adjudicate (web-grounded)")
    ap.add_argument("--panel", type=int, default=None, help="panel size (default from env/12)")
    ap.add_argument("--rounds", type=int, default=None, help="max debate rounds (default 3)")
    ap.add_argument("--cosmos", action="store_true", help="also persist the tape to Cosmos")
    args = ap.parse_args()

    settings = Settings.load()
    if args.panel:
        settings = dataclasses.replace(settings, panel_size=args.panel)
    if args.rounds:
        settings = dataclasses.replace(settings, max_rounds=args.rounds)

    if args.claim:
        from cases import custom_case
        case = custom_case(args.claim)
    else:
        case = load_case(args.case)
    store = CosmosTapeStore(settings) if args.cosmos else None
    bus = EventBus(case["case_id"], persist=(store.append if store else None))

    print(f"▶ running {case['case_id']}  panel={settings.panel_size}  rounds={settings.max_rounds}")
    print(f"  claim: {case['claim']}")
    await run_case(case["key"], settings, bus=bus, case=case)
    if store:
        await store.aclose()

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{case['case_id']}.json")
    tape = bus.tape(title=case["title"], evidence_catalog=case["evidence"])
    with open(out_path, "w") as f:
        json.dump(tape, f, indent=2)

    final = next((e for e in reversed(bus.log) if e["event"] == "verdict.final"), None)
    print(f"\n✅ {len(bus.log)} events → {out_path}")
    if final:
        d = final["data"]
        print(f"   verdict: {d['consensus']['label']} (score {d['consensus']['score']}, "
              f"confidence {d['confidence']}, ece {d['ece']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
