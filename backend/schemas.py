"""Pydantic models for structured agent I/O.

Agents are prompted to return JSON; we parse it through these tolerant models so a
ragged LLM response still yields a usable, range-checked object. Vote is clamped to
{-1,0,1} and confidence to [0,1] here so the Consensus Engine always gets clean inputs.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

Vote = int


def _clamp_vote(v) -> int:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return 0
    return max(-1, min(1, n))


def _clamp_conf(c) -> float:
    try:
        f = float(c)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(1.0, f))


# ---- Decomposer ----------------------------------------------------------
class SubclaimOut(BaseModel):
    text: str


class SubclaimsOut(BaseModel):
    subclaims: list[SubclaimOut] = Field(default_factory=list)


# ---- Casting Director ----------------------------------------------------
class CastAssignment(BaseModel):
    slot: str
    axis: str
    lens: str
    name: str
    voice: str = ""
    stance_prior: float = 0.0
    opening_question: str = ""

    @field_validator("stance_prior")
    @classmethod
    def _clamp_prior(cls, v):
        return max(-1.0, min(1.0, float(v)))


class CastOut(BaseModel):
    assignments: list[CastAssignment] = Field(default_factory=list)


# ---- Juror ---------------------------------------------------------------
class SubclaimVote(BaseModel):
    id: str
    vote: Vote = 0
    confidence: float = 0.5

    @field_validator("vote")
    @classmethod
    def _v(cls, v):
        return _clamp_vote(v)

    @field_validator("confidence")
    @classmethod
    def _c(cls, v):
        return _clamp_conf(v)


class JurorBallot(BaseModel):
    """Blind round and re-votes: an overall stance plus per-subclaim stances."""
    vote: Vote = 0
    confidence: float = 0.5
    rationale: str = ""
    subclaims: list[SubclaimVote] = Field(default_factory=list)

    @field_validator("vote")
    @classmethod
    def _v(cls, v):
        return _clamp_vote(v)

    @field_validator("confidence")
    @classmethod
    def _c(cls, v):
        return _clamp_conf(v)


class JurorTurn(BaseModel):
    """A debate-floor turn: a spoken, checkable claim + the juror's updated ballot."""
    text: str = ""
    subclaim_id: str | None = None
    citations: list[str] = Field(default_factory=list)
    ballot: JurorBallot = Field(default_factory=JurorBallot)


# ---- Verifier / Bias / Devil's Advocate ----------------------------------
class FactcheckOut(BaseModel):
    status: str = "pending"  # supported | unsupported | partial | pending
    citations: list[str] = Field(default_factory=list)
    note: str = ""

    @field_validator("status")
    @classmethod
    def _s(cls, v):
        return v if v in {"supported", "unsupported", "partial", "pending"} else "pending"


class BiasFlagOut(BaseModel):
    type: str = "missing_context"
    severity: str = "low"
    note: str = ""

    @field_validator("type")
    @classmethod
    def _t(cls, v):
        ok = {"emotional_framing", "missing_context", "manipulative", "unsupported_certainty"}
        return v if v in ok else "missing_context"

    @field_validator("severity")
    @classmethod
    def _sev(cls, v):
        return v if v in {"low", "med", "high"} else "low"


class BiasOut(BaseModel):
    flags: list[BiasFlagOut] = Field(default_factory=list)


class DevilsAdvocateOut(BaseModel):
    target_consensus: str = ""
    argument: str = ""
    citations: list[str] = Field(default_factory=list)
