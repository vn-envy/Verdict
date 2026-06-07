"""Evaluation metrics — deterministic, no network. Unit-tested offline.

Maps onto the architecture doc's eval strategy (§8): verdict accuracy vs a single-model
baseline, calibration error (ECE), an anchoring-resistance signal (does deliberation
overturn a wrong anchored start?), and dissent preservation.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CaseResult:
    key: str
    truth_sign: int            # +1 true, -1 false, 0 contested (ground truth)
    truth_label: str
    blind_score: float         # weighted consensus after the blind round
    final_score: float         # weighted consensus at the verdict
    final_label: str
    final_confidence: float
    had_turning_point: bool
    minority_preserved: bool
    bias_flags: int
    baseline_score: float | None = None      # single-model baseline (None if not run)
    baseline_confidence: float | None = None


def _sign(x: float) -> int:
    return 1 if x > 1e-9 else -1 if x < -1e-9 else 0


def is_correct(truth_sign: int, score: float, label: str) -> bool:
    """A contested ground truth is 'correct' iff the verdict is contested; otherwise the
    consensus sign must match the truth sign."""
    if truth_sign == 0:
        return label == "contested"
    return _sign(score) == truth_sign


def accuracy(results: list[CaseResult]) -> float:
    if not results:
        return 0.0
    hits = sum(is_correct(r.truth_sign, r.final_score, r.final_label) for r in results)
    return round(hits / len(results), 4)


def baseline_accuracy(results: list[CaseResult]) -> float | None:
    scored = [r for r in results if r.baseline_score is not None]
    if not scored:
        return None
    hits = 0
    for r in scored:
        # The baseline has no notion of "contested"; score it on sign for definitive claims.
        if r.truth_sign == 0:
            hits += 1 if abs(r.baseline_score) < 0.25 else 0
        else:
            hits += 1 if _sign(r.baseline_score) == r.truth_sign else 0
    return round(hits / len(scored), 4)


def expected_calibration_error(results: list[CaseResult], bins: int = 5) -> float:
    """Aggregate ECE over the dataset: |confidence - accuracy| per confidence bucket."""
    if not results:
        return 0.0
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for r in results:
        idx = min(bins - 1, int(r.final_confidence * bins))
        buckets[idx].append((r.final_confidence, int(is_correct(r.truth_sign, r.final_score, r.final_label))))
    n = len(results)
    ece = 0.0
    for b in buckets:
        if not b:
            continue
        conf = sum(c for c, _ in b) / len(b)
        acc = sum(a for _, a in b) / len(b)
        ece += (len(b) / n) * abs(conf - acc)
    return round(ece, 4)


def anchoring_resistance(results: list[CaseResult]) -> float | None:
    """Among definitive cases that started anchored on the WRONG side after the blind round,
    the fraction the deliberation corrected to the truth. The exact failure prior work showed."""
    anchored_wrong = [
        r for r in results
        if r.truth_sign != 0 and _sign(r.blind_score) != 0 and _sign(r.blind_score) != r.truth_sign
    ]
    if not anchored_wrong:
        return None
    corrected = sum(1 for r in anchored_wrong if _sign(r.final_score) == r.truth_sign)
    return round(corrected / len(anchored_wrong), 4)


def dissent_preservation(results: list[CaseResult]) -> float:
    if not results:
        return 0.0
    return round(sum(1 for r in results if r.minority_preserved) / len(results), 4)


def summarize(results: list[CaseResult]) -> dict:
    swarm_acc = accuracy(results)
    base_acc = baseline_accuracy(results)
    return {
        "n_cases": len(results),
        "swarm_accuracy": swarm_acc,
        "baseline_accuracy": base_acc,
        "accuracy_lift": (round(swarm_acc - base_acc, 4) if base_acc is not None else None),
        "ece": expected_calibration_error(results),
        "anchoring_resistance": anchoring_resistance(results),
        "dissent_preservation": dissent_preservation(results),
        "turning_points": sum(1 for r in results if r.had_turning_point),
        "bias_flags_total": sum(r.bias_flags for r in results),
    }


def report_markdown(results: list[CaseResult], s: dict) -> str:
    lines = [
        "# Verdict — evaluation report",
        "",
        f"- **Cases:** {s['n_cases']}",
        f"- **Swarm accuracy:** {s['swarm_accuracy']}"
        + (f"  ·  **baseline:** {s['baseline_accuracy']}  ·  **lift:** {s['accuracy_lift']:+}"
           if s["baseline_accuracy"] is not None else ""),
        f"- **ECE (calibration error):** {s['ece']}",
        f"- **Anchoring resistance:** {s['anchoring_resistance']}",
        f"- **Dissent preservation:** {s['dissent_preservation']}",
        f"- **Turning points:** {s['turning_points']}  ·  **bias flags:** {s['bias_flags_total']}",
        "",
        "| Case | truth | blind | verdict | conf | correct | turning | minority |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            f"| {r.key} | {r.truth_label} | {r.blind_score:+.2f} | {r.final_label} ({r.final_score:+.2f}) "
            f"| {r.final_confidence:.2f} | {'✓' if is_correct(r.truth_sign, r.final_score, r.final_label) else '✗'} "
            f"| {'●' if r.had_turning_point else '–'} | {'●' if r.minority_preserved else '–'} |"
        )
    return "\n".join(lines)
