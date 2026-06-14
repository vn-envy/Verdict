"""Offline unit tests for the eval metrics."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval.metrics import (  # noqa: E402
    CaseResult,
    accuracy,
    accuracy_by_category,
    anchoring_resistance,
    brier_score,
    dissent_preservation,
    is_correct,
    paired_sign_test,
    reliability_table,
    summarize,
    wilson_interval,
)


def _r(key, truth, blind, final, label, conf=0.7, tp=False, minority=True, bias=0, base=None,
       cat="factual"):
    return CaseResult(key, truth, label, blind, final, label, conf, tp, minority, bias,
                      baseline_score=base, category=cat)


def test_is_correct():
    assert is_correct(-1, -0.7, "likely_false")
    assert not is_correct(-1, 0.3, "leaning_true")
    assert is_correct(0, 0.05, "contested")
    assert not is_correct(0, 0.6, "likely_true")


def test_accuracy_and_lift():
    rs = [_r("C", -1, 0.2, -0.7, "likely_false", base=-0.6),
          _r("A", 0, 0.0, 0.05, "contested", base=0.8),
          _r("B", -1, -0.3, -0.4, "leaning_false", base=-0.2)]
    assert accuracy(rs) == 1.0
    s = summarize(rs)
    # baseline gets A wrong (says true) -> 2/3
    assert s["baseline_accuracy"] == round(2 / 3, 4)
    assert s["accuracy_lift"] is not None and s["accuracy_lift"] > 0


def test_anchoring_resistance():
    # C started anchored wrong (blind +) but corrected to false -> resisted.
    rs = [_r("C", -1, 0.4, -0.7, "likely_false"),
          _r("B", -1, -0.5, -0.6, "leaning_false")]  # not anchored wrong
    assert anchoring_resistance(rs) == 1.0


def test_dissent_preservation():
    rs = [_r("C", -1, 0.0, -0.7, "likely_false", minority=True),
          _r("A", 0, 0.0, 0.0, "contested", minority=False)]
    assert dissent_preservation(rs) == 0.5


def test_wilson_interval():
    assert wilson_interval(0, 0) == (0.0, 0.0)
    lo, hi = wilson_interval(10, 10)          # perfect score: hi clamps at 1, lo well below
    assert hi == 1.0 and 0.5 < lo < 1.0
    lo, hi = wilson_interval(5, 10)           # 50%: interval straddles 0.5, strictly inside (0,1)
    assert lo < 0.5 < hi and lo > 0.0 and hi < 1.0


def test_brier_score():
    # conf 1.0 + correct -> 0; conf 0.0 + correct -> 1; mean 0.5.
    rs = [_r("a", -1, 0.0, -0.7, "likely_false", conf=1.0),
          _r("b", -1, 0.0, -0.7, "likely_false", conf=0.0)]
    assert brier_score(rs) == 0.5


def test_paired_sign_test():
    assert paired_sign_test([_r("a", -1, 0.0, -0.7, "likely_false")]) is None  # no baseline
    # swarm right on all 3; baseline wrong on all 3 -> 3 discordant, all swarm-better.
    rs = [_r(k, -1, 0.0, -0.7, "likely_false", base=0.6) for k in ("a", "b", "c")]
    st = paired_sign_test(rs)
    assert st["swarm_better"] == 3 and st["baseline_better"] == 0
    assert st["discordant"] == 3 and st["p_value"] == 0.25  # 2 * 0.5^3


def test_reliability_and_category():
    rs = [_r("a", -1, 0.0, -0.7, "likely_false", conf=0.7),           # bin 0.6-0.8, correct
          _r("b", 1, 0.0, -0.7, "likely_false", conf=0.7),            # bin 0.6-0.8, WRONG (truth +1)
          _r("c", 0, 0.0, 0.0, "contested", conf=0.3, cat="values")]  # bin 0.2-0.4, correct
    tbl = {b["range"]: b for b in reliability_table(rs)}
    assert tbl["0.6-0.8"]["n"] == 2 and tbl["0.6-0.8"]["accuracy"] == 0.5
    by = accuracy_by_category(rs)
    assert by["factual"] == {"n": 2, "accuracy": 0.5}
    assert by["values"] == {"n": 1, "accuracy": 1.0}
