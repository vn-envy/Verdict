"""Unit tests for the deterministic Consensus Engine — no network, no LLM."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from consensus import (  # noqa: E402
    ConsensusEngine,
    JurorVote,
    expected_calibration_error,
    label_for,
    minority_report,
)


def _jv(jid, vote, conf, subs=None):
    return JurorVote(jid, vote, conf, subs or {})


def test_label_thresholds():
    assert label_for(0.9) == "likely_true"
    assert label_for(0.3) == "leaning_true"
    assert label_for(0.0) == "contested"
    assert label_for(-0.3) == "leaning_false"
    assert label_for(-0.9) == "likely_false"


def test_normative_label_band_preserves_contested():
    # Normative claims need strong agreement (|score| > 0.5) to leave 'contested', so moderate
    # scores that would read leaning_true/false on a factual claim stay contested.
    assert label_for(-0.40, "normative") == "contested"   # factual would be leaning_false
    assert label_for(0.30, "normative") == "contested"    # factual would be leaning_true
    assert label_for(-0.58, "normative") == "likely_false"  # strong agreement still resolves
    assert label_for(0.55, "normative") == "likely_true"
    # The engine threads claim_type into its label.
    eng = ConsensusEngine(["sc1"], claim_type="normative")
    r = eng.update(0, [_jv("A", -1, 0.6), _jv("B", -1, 0.5), _jv("C", 1, 0.6), _jv("D", 0, 0.4)])
    assert -0.5 < r.score < 0 and r.label == "contested"


def test_blind_round_matches_tape_shape():
    """Reproduce Case C's blind reveal (4 yes / 6 no / 2 abstain) and check ranges."""
    votes = [
        _jv("S1", 1, 0.72), _jv("S10", 1, 0.68), _jv("S3", -1, 0.81), _jv("S4", -1, 0.74),
        _jv("S5", 1, 0.55), _jv("S6", -1, 0.66), _jv("S7", 0, 0.40), _jv("S8", 0, 0.42),
        _jv("S9", -1, 0.58), _jv("S12", 1, 0.51), _jv("S2", -1, 0.70), _jv("S11", -1, 0.52),
    ]
    eng = ConsensusEngine(["sc1"])
    r = eng.update(0, votes)
    assert -0.30 < r.score < -0.10          # weighted ≈ -0.21
    assert r.label == "contested"
    assert abs(r.convergence - 0.22) < 0.05  # agreement-derived, matches tape's 0.22
    assert 0.0 <= r.confidence <= 1.0
    assert r.turning_point is None           # no prior round
    assert r.shifts == []


def test_shift_detection_and_turning_point():
    subs = lambda v, c: {"sc3": (v, c)}
    eng = ConsensusEngine(["sc3"])
    r1 = eng.update(0, [_jv("A", 1, 0.7, subs(1, 0.7)), _jv("B", 1, 0.6, subs(1, 0.6)),
                        _jv("C", -1, 0.6, subs(-1, 0.6))])
    assert r1.score > 0
    # Two of three flip negative → overall sign flips → majority_flip turning point.
    r2 = eng.update(1, [_jv("A", -1, 0.7, subs(-1, 0.7)), _jv("B", -1, 0.65, subs(-1, 0.65)),
                        _jv("C", -1, 0.6, subs(-1, 0.6))])
    assert r2.score < 0
    assert {s.juror_id for s in r2.shifts} == {"A", "B"}
    assert r2.turning_point is not None
    assert r2.turning_point.trigger == "majority_flip"
    assert set(r2.turning_point.movers) == {"A", "B"}


def test_minority_report_and_ece():
    votes = [_jv("A", -1, 0.8), _jv("B", -1, 0.7), _jv("C", 1, 0.6)]  # C dissents
    mr = minority_report(votes, consensus_score=-0.5)
    assert len(mr) == 1 and mr[0]["jurors"] == ["C"]
    ece = expected_calibration_error(votes, final_sign=-1)
    assert 0.0 <= ece <= 1.0


def test_empty_and_abstain_safe():
    eng = ConsensusEngine(["sc1"])
    r = eng.update(0, [_jv("A", 0, 0.0), _jv("B", 0, 0.0)])
    assert r.score == 0.0 and r.label == "contested"
