"""Evaluation metrics — deterministic, no network. Unit-tested offline.

Maps onto the architecture doc's eval strategy (§8): verdict accuracy vs a single-model
baseline, calibration error (ECE), an anchoring-resistance signal (does deliberation
overturn a wrong anchored start?), and dissent preservation.
"""
from __future__ import annotations

import math
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
    category: str = "uncategorized"          # factual | values (dataset label)
    difficulty: str = "medium"               # easy | medium | hard
    claim_type: str = "factual"              # what the live classifier tagged it (factual|normative)


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


def _baseline_correct(r: CaseResult) -> bool:
    """The baseline has no notion of 'contested'; score it on sign for definitive claims and on
    near-zero magnitude for contested ones."""
    if r.truth_sign == 0:
        return abs(r.baseline_score) < 0.25
    return _sign(r.baseline_score) == r.truth_sign


def baseline_accuracy(results: list[CaseResult]) -> float | None:
    scored = [r for r in results if r.baseline_score is not None]
    if not scored:
        return None
    hits = sum(_baseline_correct(r) for r in scored)
    return round(hits / len(scored), 4)


def wilson_interval(hits: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion — honest small-sample error bars on
    accuracy (the normal approximation is badly wrong at the n we run here)."""
    if n == 0:
        return (0.0, 0.0)
    p = hits / n
    z2 = z * z
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    half = (z / denom) * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))
    return (round(max(0.0, center - half), 4), round(min(1.0, center + half), 4))


def brier_score(results: list[CaseResult]) -> float:
    """Mean squared error between the verdict's stated confidence (as P(correct)) and the actual
    0/1 correctness. A proper scoring rule — complements ECE and is harder to game."""
    if not results:
        return 0.0
    total = sum((r.final_confidence - int(is_correct(r.truth_sign, r.final_score, r.final_label))) ** 2
                for r in results)
    return round(total / len(results), 4)


def paired_sign_test(results: list[CaseResult]) -> dict | None:
    """Two-sided sign test of swarm vs single-model baseline on per-case correctness. Reports the
    discordant counts and an exact binomial p-value so 'lift' isn't read off 3 coin flips."""
    paired = [r for r in results if r.baseline_score is not None]
    if not paired:
        return None
    swarm_better = sum(1 for r in paired
                       if is_correct(r.truth_sign, r.final_score, r.final_label) and not _baseline_correct(r))
    baseline_better = sum(1 for r in paired
                          if _baseline_correct(r) and not is_correct(r.truth_sign, r.final_score, r.final_label))
    n_disc = swarm_better + baseline_better
    if n_disc == 0:
        p = 1.0
    else:
        m = min(swarm_better, baseline_better)
        tail = sum(math.comb(n_disc, k) for k in range(m + 1)) * (0.5 ** n_disc)
        p = min(1.0, 2 * tail)
    return {"swarm_better": swarm_better, "baseline_better": baseline_better,
            "discordant": n_disc, "p_value": round(p, 4)}


def reliability_table(results: list[CaseResult], bins: int = 5) -> list[dict]:
    """Per-confidence-bucket reliability: are 0.8-confidence verdicts right ~80% of the time?"""
    buckets: list[list[CaseResult]] = [[] for _ in range(bins)]
    for r in results:
        buckets[min(bins - 1, int(r.final_confidence * bins))].append(r)
    table = []
    for i, b in enumerate(buckets):
        if not b:
            continue
        table.append({
            "range": f"{i / bins:.1f}-{(i + 1) / bins:.1f}",
            "n": len(b),
            "avg_confidence": round(sum(r.final_confidence for r in b) / len(b), 4),
            "accuracy": round(sum(is_correct(r.truth_sign, r.final_score, r.final_label) for r in b) / len(b), 4),
        })
    return table


def accuracy_by_category(results: list[CaseResult]) -> dict:
    cats: dict[str, list[CaseResult]] = {}
    for r in results:
        cats.setdefault(r.category, []).append(r)
    return {c: {"n": len(rs), "accuracy": accuracy(rs)} for c, rs in sorted(cats.items())}


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
    hits = sum(is_correct(r.truth_sign, r.final_score, r.final_label) for r in results)
    return {
        "n_cases": len(results),
        "swarm_accuracy": swarm_acc,
        "swarm_accuracy_ci95": wilson_interval(hits, len(results)),
        "baseline_accuracy": base_acc,
        "accuracy_lift": (round(swarm_acc - base_acc, 4) if base_acc is not None else None),
        "sign_test": paired_sign_test(results),
        "ece": expected_calibration_error(results),
        "brier_score": brier_score(results),
        "reliability": reliability_table(results),
        "by_category": accuracy_by_category(results),
        "anchoring_resistance": anchoring_resistance(results),
        "dissent_preservation": dissent_preservation(results),
        "turning_points": sum(1 for r in results if r.had_turning_point),
        "bias_flags_total": sum(r.bias_flags for r in results),
    }


def report_markdown(results: list[CaseResult], s: dict) -> str:
    ci = s["swarm_accuracy_ci95"]
    lines = [
        "# Verdict — evaluation report",
        "",
        f"- **Cases:** {s['n_cases']}",
        f"- **Swarm accuracy:** {s['swarm_accuracy']}  (95% CI {ci[0]}–{ci[1]})"
        + (f"  ·  **baseline:** {s['baseline_accuracy']}  ·  **lift:** {s['accuracy_lift']:+}"
           if s["baseline_accuracy"] is not None else ""),
    ]
    if s.get("sign_test"):
        st = s["sign_test"]
        lines.append(f"- **Sign test vs baseline:** swarm-better {st['swarm_better']} / "
                     f"baseline-better {st['baseline_better']}  ·  p = {st['p_value']}")
    lines += [
        f"- **ECE:** {s['ece']}  ·  **Brier:** {s['brier_score']}",
        f"- **Anchoring resistance:** {s['anchoring_resistance']}",
        f"- **Dissent preservation:** {s['dissent_preservation']}",
        f"- **Turning points:** {s['turning_points']}  ·  **bias flags:** {s['bias_flags_total']}",
    ]
    if s.get("by_category"):
        cats = "  ·  ".join(f"{c}: {v['accuracy']} (n={v['n']})" for c, v in s["by_category"].items())
        lines.append(f"- **By category:** {cats}")
    if s.get("reliability"):
        lines += ["", "**Calibration (reliability):**",
                  "| conf bin | n | avg conf | accuracy |", "|---|---|---|---|"]
        for b in s["reliability"]:
            lines.append(f"| {b['range']} | {b['n']} | {b['avg_confidence']} | {b['accuracy']} |")
    lines += [
        "",
        "| Case | truth | type | blind | verdict | conf | correct | turning | minority |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            f"| {r.key} | {r.truth_label} | {r.claim_type[:4]} | {r.blind_score:+.2f} | {r.final_label} ({r.final_score:+.2f}) "
            f"| {r.final_confidence:.2f} | {'✓' if is_correct(r.truth_sign, r.final_score, r.final_label) else '✗'} "
            f"| {'●' if r.had_turning_point else '–'} | {'●' if r.minority_preserved else '–'} |"
        )
    return "\n".join(lines)
