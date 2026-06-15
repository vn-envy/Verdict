"""Consensus Engine — DETERMINISTIC, no LLM.

The hard rule from the design docs (12_angry_agents_event_schema.md §5):
> Everything vote.*/consensus.* is engine-computed. The UI never derives a score.

So every number the front-end shows — consensus score, label, confidence, convergence,
ECE, turning points, the minority report — is computed here in plain Python from the
jurors' structured votes. This module is import-clean (stdlib only) and unit-tested
without any network, which is what keeps "calibrated, not a vibe" honest.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

Vote = int  # -1 | 0 | 1


# ---- Inputs ---------------------------------------------------------------

@dataclass
class JurorVote:
    """One juror's position in a round: an overall stance plus per-subclaim stances."""
    juror_id: str
    overall_vote: Vote
    overall_confidence: float
    per_subclaim: dict[str, tuple[Vote, float]] = field(default_factory=dict)  # sc_id -> (vote, conf)


# ---- Outputs --------------------------------------------------------------

@dataclass
class SubclaimScore:
    subclaim_id: str
    score: float
    confidence: float


@dataclass
class VoteShift:
    juror_id: str
    subclaim_id: str | None
    frm: Vote
    to: Vote
    confidence: float
    delta_confidence: float


@dataclass
class TurningPoint:
    round: int
    description: str
    trigger: str  # "minority_flip" | "majority_flip" | "new_evidence"
    movers: list[str]


@dataclass
class ConsensusResult:
    score: float
    label: str
    confidence: float
    convergence: float
    per_subclaim: list[SubclaimScore]
    shifts: list[VoteShift]
    turning_point: TurningPoint | None


LABELS = (
    (0.5, "likely_true"),
    (0.25, "leaning_true"),
    (-0.25, "contested"),
    (-0.5, "leaning_false"),
    (-1.01, "likely_false"),
)

# Normative/value claims default to CONTESTED unless the room strongly agrees (|score| > 0.5):
# "not empirically proven" must not collapse into a confident true/false on a value judgment.
NORMATIVE_LABELS = (
    (0.5, "likely_true"),
    (-0.5, "contested"),
    (-1.01, "likely_false"),
)


def label_for(score: float, claim_type: str = "factual") -> str:
    table = NORMATIVE_LABELS if claim_type == "normative" else LABELS
    for threshold, name in table:
        if score >= threshold:
            return name
    return "likely_false"


def _clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _weighted(pairs: list[tuple[Vote, float]]) -> tuple[float, float]:
    """Confidence-weighted mean stance and mean confidence for a set of (vote, conf)."""
    if not pairs:
        return 0.0, 0.0
    wsum = sum(c for _, c in pairs)
    score = sum(v * c for v, c in pairs) / wsum if wsum else 0.0
    mean_conf = sum(c for _, c in pairs) / len(pairs)
    return _clamp(score), _clamp(mean_conf, 0.0, 1.0)


class ConsensusEngine:
    """Stateful across rounds so it can compute convergence, shifts and turning points."""

    def __init__(self, subclaim_ids: list[str], claim_type: str = "factual"):
        self.subclaim_ids = subclaim_ids
        self.claim_type = claim_type
        self._prev: dict[str, JurorVote] = {}
        self._prev_score: float | None = None

    # -- core -------------------------------------------------------------
    def update(self, round_no: int, votes: list[JurorVote]) -> ConsensusResult:
        by_id = {v.juror_id: v for v in votes}
        panel = len(votes)

        # Overall weighted score from each juror's overall stance.
        score, mean_conf = _weighted([(v.overall_vote, v.overall_confidence) for v in votes])

        # Per-subclaim weighted scores.
        per_subclaim: list[SubclaimScore] = []
        for sc in self.subclaim_ids:
            pairs = [v.per_subclaim[sc] for v in votes if sc in v.per_subclaim]
            sc_score, sc_conf = _weighted(pairs)
            per_subclaim.append(SubclaimScore(sc, round(sc_score, 4), round(sc_conf, 4)))

        # Convergence = blend of vote-agreement and round-over-round stability.
        yes = sum(1 for v in votes if v.overall_vote > 0)
        no = sum(1 for v in votes if v.overall_vote < 0)
        nonabstain = max(1, yes + no)
        agreement = max(yes, no) / nonabstain  # 0.5..1.0
        agreement_norm = _clamp((agreement - 0.5) * 2, 0.0, 1.0)

        shifts = self._shifts(by_id)
        movers = {s.juror_id for s in shifts}
        if self._prev:
            stability = 1.0 - (len(movers) / panel if panel else 0.0)
            convergence = _clamp(0.5 * agreement_norm + 0.5 * stability, 0.0, 1.0)
        else:
            convergence = agreement_norm  # round 0: no prior to measure stability against

        # Confidence rises as the room settles (matches the tape's 0.41→0.78 arc).
        confidence = _clamp(mean_conf * (0.6 + 0.4 * convergence), 0.0, 1.0)

        turning = self._turning_point(round_no, score, shifts, by_id)

        # Advance state.
        self._prev = {v.juror_id: v for v in votes}
        self._prev_score = score

        return ConsensusResult(
            score=round(score, 4),
            label=label_for(score, self.claim_type),
            confidence=round(confidence, 4),
            convergence=round(convergence, 4),
            per_subclaim=per_subclaim,
            shifts=shifts,
            turning_point=turning,
        )

    # -- helpers ----------------------------------------------------------
    def _shifts(self, by_id: dict[str, JurorVote]) -> list[VoteShift]:
        """Per-subclaim movements vs the previous round (the dramatic payload)."""
        out: list[VoteShift] = []
        for jid, cur in by_id.items():
            prev = self._prev.get(jid)
            if prev is None:
                continue
            for sc, (to_vote, to_conf) in cur.per_subclaim.items():
                frm_vote, frm_conf = prev.per_subclaim.get(sc, (0, 0.0))
                if to_vote != frm_vote:
                    out.append(VoteShift(
                        juror_id=jid, subclaim_id=sc, frm=frm_vote, to=to_vote,
                        confidence=round(to_conf, 4),
                        delta_confidence=round(to_conf - frm_conf, 4),
                    ))
        return out

    def _turning_point(self, round_no: int, score: float, shifts: list[VoteShift],
                       by_id: dict[str, JurorVote]) -> TurningPoint | None:
        if self._prev_score is None or not shifts:
            return None
        movers = sorted({s.juror_id for s in shifts})
        # Majority flip: the sign of the overall consensus changed.
        if self._prev_score != 0 and score != 0 and (score > 0) != (self._prev_score > 0):
            return TurningPoint(
                round=round_no, movers=movers, trigger="majority_flip",
                description=f"The room's overall stance flipped sign ({self._prev_score:+.2f} → {score:+.2f}).",
            )
        # Minority flip: a juror crosses to the now-majority side.
        maj_sign = 1 if score > 0 else -1 if score < 0 else 0
        crossers = [s.juror_id for s in shifts
                    if maj_sign and (s.to == maj_sign) and (s.frm != maj_sign)]
        if crossers:
            return TurningPoint(
                round=round_no, movers=sorted(set(crossers)), trigger="minority_flip",
                description=f"{len(set(crossers))} juror(s) crossed to the majority position.",
            )
        return None


# ---- Verdict-time analytics ----------------------------------------------

def expected_calibration_error(votes: list[JurorVote], final_sign: int, bins: int = 5) -> float:
    """ECE proxy: bucket jurors by stated confidence; accuracy = stance agrees with the
    final consensus sign. |confidence - accuracy| averaged over occupied buckets, weighted."""
    if not votes or final_sign == 0:
        return 0.0
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(bins)]
    for v in votes:
        idx = min(bins - 1, int(v.overall_confidence * bins))
        correct = 1 if (v.overall_vote * final_sign) > 0 else 0
        buckets[idx].append((v.overall_confidence, correct))
    n = len(votes)
    ece = 0.0
    for b in buckets:
        if not b:
            continue
        conf = sum(c for c, _ in b) / len(b)
        acc = sum(a for _, a in b) / len(b)
        ece += (len(b) / n) * abs(conf - acc)
    return round(ece, 4)


def minority_report(votes: list[JurorVote], consensus_score: float) -> list[dict]:
    """Jurors whose final overall stance opposes the consensus sign — preserved, never averaged."""
    maj_sign = 1 if consensus_score > 0 else -1 if consensus_score < 0 else 0
    if maj_sign == 0:
        return []
    dissenters = [v for v in votes if v.overall_vote != 0 and (v.overall_vote == -maj_sign)]
    out = []
    for v in dissenters:
        out.append({
            "jurors": [v.juror_id],
            "confidence": round(v.overall_confidence, 4),
        })
    return out
