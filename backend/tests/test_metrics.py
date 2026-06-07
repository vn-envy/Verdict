"""Offline unit tests for the eval metrics."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval.metrics import (  # noqa: E402
    CaseResult,
    accuracy,
    anchoring_resistance,
    dissent_preservation,
    is_correct,
    summarize,
)


def _r(key, truth, blind, final, label, conf=0.7, tp=False, minority=True, bias=0, base=None):
    return CaseResult(key, truth, label, blind, final, label, conf, tp, minority, bias,
                      baseline_score=base)


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
