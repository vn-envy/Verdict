"""Verdict evaluation harness.

    python backend/eval/run_eval.py --dry                 # offline: score the canned tapes, no spend
    python backend/eval/run_eval.py --cases C,A,B --panel 6   # live: run the swarm + single-model baseline

--dry validates the whole metric pipeline against public/case_*_tape.json with zero Azure
calls (used in CI). Live mode runs the real swarm per case and a one-shot gpt-4o baseline,
then reports accuracy/lift, ECE, anchoring resistance, and dissent preservation.
"""
from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval.metrics import CaseResult, report_markdown, summarize  # noqa: E402

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_EVAL_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_dataset() -> list[dict]:
    with open(os.path.join(_EVAL_DIR, "dataset.json")) as f:
        return json.load(f)["cases"]


def _weighted_sign(per_juror: list[dict]) -> float:
    wsum = sum(p.get("confidence", 0) for p in per_juror) or 1.0
    return sum(p["vote"] * p.get("confidence", 0) for p in per_juror) / wsum


def result_from_events(c: dict, events: list[dict], baseline=None) -> CaseResult:
    verdict = next((e["data"] for e in events if e["event"] == "verdict.final"), {})
    reveal = next((e["data"] for e in events if e["event"] == "round.blind.reveal"), {})
    consensus = verdict.get("consensus", {})
    return CaseResult(
        key=c["key"],
        truth_sign=c["truth_sign"],
        truth_label=c["truth_label"],
        blind_score=round(_weighted_sign(reveal.get("per_juror", [])), 4),
        final_score=consensus.get("score", 0.0),
        final_label=consensus.get("label", "contested"),
        final_confidence=verdict.get("confidence", 0.0),
        had_turning_point=any(e["event"] == "turning_point" for e in events),
        minority_preserved=bool(verdict.get("minority_report")),
        bias_flags=sum(b.get("count", 0) for b in verdict.get("bias_flags", [])),
        baseline_score=(baseline or {}).get("score"),
        baseline_confidence=(baseline or {}).get("confidence"),
        category=c.get("category", "uncategorized"),
        difficulty=c.get("difficulty", "medium"),
    )


def _has_tape(key: str) -> bool:
    return os.path.exists(os.path.join(_ROOT, "public", f"case_{key}_tape.json"))


def _dry_events(key: str) -> list[dict]:
    with open(os.path.join(_ROOT, "public", f"case_{key}_tape.json")) as f:
        return json.load(f)["events"]


async def _baseline_vote(reg, settings, claim: str) -> dict:
    """Single-model (gpt-4o), no evidence, no debate — the thing the swarm must beat."""
    from models import extract_json
    raw = await reg.complete(
        settings.gpt4o,
        "You are a single analyst. Judge the claim's truth on your own knowledge.",
        f'CLAIM: {claim}\nReturn ONLY JSON: {{"vote":-1|0|1,"confidence":0..1}}',
        max_tokens=120,
    )
    d = extract_json(raw)
    vote = max(-1, min(1, int(d.get("vote", 0))))
    conf = max(0.0, min(1.0, float(d.get("confidence", 0.5))))
    return {"score": round(vote * conf, 4), "confidence": conf}


async def run(args) -> int:
    ds = {c["key"]: c for c in _load_dataset()}
    keys = [k.strip().upper() for k in args.cases.split(",")] if args.cases else list(ds.keys())
    results: list[CaseResult] = []

    if args.dry:
        for k in keys:
            if not _has_tape(k):
                print(f"– skip {k}: no canned tape (self-contained case; run live to score)")
                continue
            results.append(result_from_events(ds[k], _dry_events(k)))
        if not results:
            print("No tape-backed cases selected; --dry only scores A/B/C. Use a live run for the rest.")
            return 0
    else:
        from config import Settings
        from cases import load_case
        from events import EventBus
        from models import ModelRegistry
        from orchestrator import run_case

        settings = Settings.load()
        if args.panel:
            settings = dataclasses.replace(settings, panel_size=args.panel)
        if args.rounds:
            settings = dataclasses.replace(settings, max_rounds=args.rounds)
        reg = ModelRegistry(settings)
        try:
            from cases import custom_case
            for k in keys:
                c = ds[k]
                # Self-contained cases carry their own claim; A/B/C load from cases.py.
                try:
                    case = custom_case(c["claim"]) if c.get("claim") else load_case(k)
                    print(f"▶ evaluating {k}: {case['claim']}", flush=True)
                    bus = EventBus(case["case_id"])
                    await run_case(k, settings, bus=bus, registry=reg, case=case)
                    try:
                        baseline = await _baseline_vote(reg, settings, case["claim"])
                    except Exception as exc:  # noqa: BLE001 — baseline is optional; keep the case
                        print(f"  baseline failed for {k}: {type(exc).__name__}", flush=True)
                        baseline = None
                    results.append(result_from_events(c, bus.log, baseline))
                except Exception as exc:  # noqa: BLE001 — one bad case shouldn't sink a long run
                    print(f"  ✗ skipped {k}: {type(exc).__name__}: {exc}", flush=True)
        finally:
            await reg.aclose()

    s = summarize(results)
    md = report_markdown(results, s)
    print("\n" + md)

    os.makedirs(os.path.join(_EVAL_DIR, "out"), exist_ok=True)
    with open(os.path.join(_EVAL_DIR, "out", "eval_report.json"), "w") as f:
        json.dump({"summary": s, "cases": [dataclasses.asdict(r) for r in results]}, f, indent=2)
    with open(os.path.join(_EVAL_DIR, "out", "eval_report.md"), "w") as f:
        f.write(md + "\n")
    # GitHub Actions step summary, if present.
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(md + "\n")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Verdict evaluation harness.")
    ap.add_argument("--dry", action="store_true", help="score canned tapes offline (no Azure spend)")
    ap.add_argument("--cases", default="", help="comma-separated case keys (default: all)")
    ap.add_argument("--panel", type=int, default=6, help="panel size for live runs")
    ap.add_argument("--rounds", type=int, default=3, help="max rounds for live runs")
    return asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
