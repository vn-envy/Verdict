"""Seeded house cases — claim + a curated, citable evidence base.

Evidence grounding (Bing / AI Search) is deferred per BACKEND_SETUP.md, so jurors cite
from a hand-authored catalog — the same approach as the canned tapes. We load the catalog
straight out of public/case_*_tape.json so the live swarm reasons over the exact evidence
the front-end fixtures use.
"""
from __future__ import annotations

import json
import os
import time

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# key -> (seed case_id for the tape file, claim, participatory user prior in [-1,1])
CASES: dict[str, dict] = {
    "C": {"seed": "C-tariffs-001", "claim": "Tariffs lower domestic prices for consumers.",
          "user_prior": 0.5, "title": "Tariffs lower domestic prices for consumers"},
    "A": {"seed": "A", "claim": "Dynamic 'surge' pricing for 2026 World Cup tickets is fair to fans.",
          "user_prior": -0.5, "title": "Dynamic 'surge' pricing for 2026 World Cup tickets is fair to fans"},
    "B": {"seed": "B", "claim": "A one-time 50% wealth tax on AI companies would benefit the public.",
          "user_prior": 0.5, "title": "A one-time 50% wealth tax on AI companies would benefit the public"},
}


def _load_evidence(seed: str) -> list[dict]:
    path = os.path.join(_ROOT, "public", f"case_{seed.split('-')[0]}_tape.json")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f).get("evidence_catalog", [])


def load_case(key: str, *, live_id: bool = True) -> dict:
    key = key.upper()
    if key not in CASES:
        raise KeyError(f"unknown case {key!r}; choose from {sorted(CASES)}")
    c = CASES[key]
    case_id = f"{key}-live-{int(time.time())}" if live_id else c["seed"]
    return {
        "key": key,
        "case_id": case_id,
        "claim": c["claim"],
        "title": c["title"],
        "user_prior": c["user_prior"],
        "evidence": _load_evidence(c["seed"]),
    }


def custom_case(claim: str, *, user_prior: float = 0.0, evidence: list[dict] | None = None) -> dict:
    return {
        "key": "X",
        "case_id": f"X-live-{int(time.time())}",
        "claim": claim,
        "title": claim.rstrip("."),
        "user_prior": user_prior,
        "evidence": evidence or [],
    }
