"""The Foreman — deterministic deliberation protocol over the MAF agent swarm.

Round structure is deterministic Python (reproducible demos); only intra-round reasoning
is LLM-driven (architecture doc §3). This walks the event_schema.md lifecycle exactly and
emits every event through the EventBus. All scores come from the Consensus Engine.
"""
from __future__ import annotations

import asyncio
import time

import agents
import casting
import obs
from cases import load_case
from config import Settings
from consensus import (
    ConsensusEngine,
    JurorVote,
    expected_calibration_error,
    minority_report,
)
from events import EventBus
from models import ModelRegistry, model_label
from schemas import BiasOut, DevilsAdvocateOut, FactcheckOut, JurorBallot

CONVERGENCE_STOP = 0.8
SPEAKERS_PER_ROUND = 4


def _act(round_no: int, max_rounds: int) -> int:
    if round_no == 0:
        return 1
    return 3 if round_no >= max_rounds else 2


def _ballot_to_vote(slot: str, b: JurorBallot, subclaim_ids: list[str]) -> JurorVote:
    per = {sv.id: (sv.vote, sv.confidence) for sv in b.subclaims if sv.id in subclaim_ids}
    # Any sub-claim the juror skipped inherits the overall stance (keeps the engine clean).
    for sc in subclaim_ids:
        per.setdefault(sc, (b.vote, b.confidence))
    return JurorVote(slot, b.vote, b.confidence, per)


def _deployment(settings: Settings, juror: dict) -> str:
    spec = next(s for s in casting.SLOTS if s.id == juror["slot"])
    return casting.deployment_for(settings, spec)


class Foreman:
    def __init__(self, settings: Settings, registry: ModelRegistry, bus: EventBus):
        self.s = settings
        self.reg = registry
        self.bus = bus

    async def run(self, case: dict) -> None:
        s, reg, bus = self.s, self.reg, self.bus
        mr = s.max_rounds
        obs.case_id_var.set(bus.case_id)  # tag every LLM call/log for this run (App Insights dim)
        _t0 = time.monotonic()
        obs.log_event("deliberation.start", panel=s.panel_size, rounds=mr)
        claim, subclaims_text = case["claim"], None
        evidence = case["evidence"]

        # --- Setup (Act 1) ------------------------------------------------
        await bus.emit("case.filed", {"claim": claim, "source": "user",
                                      "user_prior": case["user_prior"]}, round=0, act=1)
        await agents.content_safety_screen(s, claim)  # real Prompt-Shields-style inbound screen

        subclaims = await self._safe(agents.decompose(reg, s, claim),
                                     [{"id": "sc1", "text": claim, "status": "open"}], "decompose")
        await bus.emit("subclaims.ready", {"subclaims": subclaims}, round=0, act=1)
        sc_ids = [sc["id"] for sc in subclaims]

        # Web/RAG grounding for custom claims that arrive without a seeded evidence base.
        if not evidence:
            from evidence import gather_evidence
            try:
                evidence = await gather_evidence(claim, subclaims)
            except Exception:  # noqa: BLE001 — degrade to parametric reasoning, never break
                evidence = []

        jurors, balance, da = await casting.cast_panel(reg, s, claim, subclaims, s.panel_size)
        axes_filled = {ax: sum(1 for j in jurors if j["axis"] == ax) for ax in casting.AXES}
        await bus.emit("panel.cast", {"axes_filled": axes_filled, "jurors": jurors,
                                      "devils_advocate": da}, round=0, act=1)
        await bus.emit("panel.balance", balance, round=0, act=1)

        if evidence:
            await bus.emit("evidence.ready", {"items": evidence}, round=0, act=1)

        # --- Blind round (Act 1) -----------------------------------------
        await bus.emit("round.blind.start", {}, round=0, act=1)
        for j in jurors:
            await bus.emit("juror.thinking", {"juror_id": j["slot"]}, round=0, act=1)

        ballots = await self._gather_blind(jurors, claim, subclaims, evidence)
        for j in jurors:
            await bus.emit("vote.cast", {"juror_id": j["slot"], "sealed": True}, round=0, act=1)

        per_juror = [{"juror_id": j["slot"], "vote": ballots[j["slot"]].vote,
                      "confidence": round(ballots[j["slot"]].confidence, 2)} for j in jurors]
        tally = {
            "yes": sum(1 for p in per_juror if p["vote"] > 0),
            "no": sum(1 for p in per_juror if p["vote"] < 0),
            "abstain": sum(1 for p in per_juror if p["vote"] == 0),
        }
        await bus.emit("round.blind.reveal", {"tally": tally, "per_juror": per_juror}, round=0, act=1)

        engine = ConsensusEngine(sc_ids)
        votes = [_ballot_to_vote(j["slot"], ballots[j["slot"]], sc_ids) for j in jurors]
        result = engine.update(0, votes)
        await self._emit_consensus(result, round_no=0, act=1)

        # --- Debate rounds (Act 2/3) -------------------------------------
        last_turn: dict[str, object] = {}
        claim_seq = 0
        bias_counts: dict[str, int] = {}
        for rnd in range(1, mr + 1):
            act = _act(rnd, mr)
            agenda = await self._safe(
                agents.foreman_agenda(reg, s, rnd, subclaims, result.label),
                f"Round {rnd}: weigh the evidence on each sub-claim and update your vote.",
                "foreman_agenda")
            await bus.emit("round.start", {"round": rnd, "agenda": agenda}, round=rnd, act=act)

            # Every juror reconsiders (concurrently); a rotating few take the floor.
            context = self._floor_context(result, last_turn)
            turns = await self._gather_turns(jurors, claim, subclaims, evidence, context)
            for slot, t in turns.items():
                last_turn[slot] = t
                ballots[slot] = t.ballot

            speakers = self._pick_speakers(jurors, rnd)
            for j in speakers:
                t = turns[j["slot"]]
                if not t.text.strip():
                    continue
                claim_seq += 1
                cref = f"cl-{claim_seq:03d}"
                await bus.emit("floor.speaker", {"juror_id": j["slot"]}, round=rnd, act=act)
                await bus.emit("claim.made", {
                    "juror_id": j["slot"], "text": t.text, "claim_ref": cref,
                    "subclaim_id": t.subclaim_id, "spans": [],
                }, round=rnd, act=act)
                # Bias sentinel + verifier (verifier may lag; we emit right after for simplicity).
                bias = await self._safe(agents.bias_scan(reg, s, t.text), BiasOut(), "bias_scan")
                for fl in bias.flags:
                    bias_counts[fl.type] = bias_counts.get(fl.type, 0) + 1
                    await bus.emit("bias.flag", {"juror_id": j["slot"], "type": fl.type,
                                                 "severity": fl.severity, "note": fl.note},
                                   round=rnd, act=act)
                fc = await self._safe(agents.verify_claim(reg, s, t.text, evidence),
                                      FactcheckOut(status="pending", note="(verifier unavailable)"),
                                      "verify_claim")
                await bus.emit("factcheck.result", {
                    "claim_ref": cref, "status": fc.status,
                    "citations": [{"evidence_id": e, "credibility": _cred(evidence, e)} for e in fc.citations],
                    "note": fc.note,
                }, round=rnd, act=act)

            # Mandated dissent.
            attack = await self._safe(
                agents.devils_advocate(reg, s, claim, result.label, evidence),
                DevilsAdvocateOut(target_consensus=result.label,
                                  argument="(no challenge raised this round)"),
                "devils_advocate")
            await bus.emit("devils_advocate.attack", {
                "name": da["name"], "target_consensus": attack.target_consensus,
                "argument": attack.argument,
                "citations": [{"evidence_id": e, "credibility": _cred(evidence, e)} for e in attack.citations],
            }, round=rnd, act=act)

            # Re-tally → consensus, shifts, turning point.
            votes = [_ballot_to_vote(j["slot"], ballots[j["slot"]], sc_ids) for j in jurors]
            result = engine.update(rnd, votes)
            for sh in result.shifts:
                t = last_turn.get(sh.juror_id)
                reason = getattr(getattr(t, "ballot", None), "rationale", "") or "Updated on the floor evidence."
                cites = [{"evidence_id": e} for e in getattr(t, "citations", [])] if t else []
                await bus.emit("vote.shift", {
                    "juror_id": sh.juror_id, "subclaim_id": sh.subclaim_id, "from": sh.frm, "to": sh.to,
                    "confidence": sh.confidence, "delta_confidence": sh.delta_confidence,
                    "reason": reason, "citations": cites,
                }, round=rnd, act=act)
            await self._emit_consensus(result, round_no=rnd, act=act)
            if result.turning_point:
                tp = result.turning_point
                await bus.emit("turning_point", {"round": tp.round, "description": tp.description,
                                                 "trigger": tp.trigger, "movers": tp.movers},
                               round=rnd, act=act)

            converged = result.convergence >= CONVERGENCE_STOP
            stalled = (not result.shifts) and rnd > 1 and not converged
            await bus.emit("round.end", {"round": rnd, "converged": converged, "stalled": stalled},
                           round=rnd, act=act)
            if converged or stalled:
                break

        # --- Verdict (Act 4) ---------------------------------------------
        await self._emit_verdict(case, claim, subclaims, evidence, jurors, ballots, result,
                                 engine, bias_counts)
        await bus.emit("case.closed", {"tape_uri": f"cosmos://{self.s.cosmos_database}/{bus.case_id}/tape"},
                       round=result_round(result, mr), act=4)
        obs.log_event("deliberation.end", label=result.label, score=round(result.score, 3),
                      convergence=round(result.convergence, 3),
                      duration_ms=round((time.monotonic() - _t0) * 1000))

    # -- resilience helper -----------------------------------------------
    async def _safe(self, coro, fallback, what):
        """Run an agent call; on any error log it and return a safe fallback. The jurors already
        degrade this way (abstain); this extends the same isolation to the Foreman / Verifier /
        Bias Sentinel / Devil's Advocate so one agent failure can't kill the whole run."""
        try:
            return await coro
        except Exception as exc:  # noqa: BLE001 — intentional: isolate a single agent failure
            obs.log_event("agent.failed", agent=what, error=type(exc).__name__, detail=str(exc)[:200])
            return fallback

    # -- concurrency helpers ---------------------------------------------
    async def _gather_blind(self, jurors, claim, subclaims, evidence) -> dict[str, JurorBallot]:
        async def one(j):
            try:
                b = await agents.juror_blind_ballot(self.reg, self.s, _deployment(self.s, j), j,
                                                    claim, subclaims, evidence)
            except Exception:  # noqa: BLE001 — a juror that errors abstains rather than killing the run
                b = JurorBallot(vote=0, confidence=0.3, rationale="(no response)")
            return j["slot"], b
        return dict(await asyncio.gather(*(one(j) for j in jurors)))

    async def _gather_turns(self, jurors, claim, subclaims, evidence, context):
        async def one(j):
            try:
                t = await agents.juror_turn(self.reg, self.s, _deployment(self.s, j), j,
                                            claim, subclaims, evidence, context)
            except Exception:  # noqa: BLE001
                from schemas import JurorTurn
                t = JurorTurn()
            return j["slot"], t
        return dict(await asyncio.gather(*(one(j) for j in jurors)))

    # -- small helpers ----------------------------------------------------
    def _pick_speakers(self, jurors, rnd):
        start = ((rnd - 1) * SPEAKERS_PER_ROUND) % len(jurors)
        rotated = jurors[start:] + jurors[:start]
        return rotated[:SPEAKERS_PER_ROUND]

    def _floor_context(self, result, last_turn) -> str:
        lines = [f"Current room lean: {result.label} (score {result.score:+.2f}, "
                 f"convergence {result.convergence:.2f})."]
        recent = [getattr(t, "text", "") for t in list(last_turn.values())[-4:] if getattr(t, "text", "")]
        for r in recent:
            lines.append(f"- A juror argued: {r}")
        return "\n".join(lines)

    async def _emit_consensus(self, result, *, round_no, act):
        await self.bus.emit("consensus.update", {
            "score": result.score, "label": result.label, "confidence": result.confidence,
            "convergence": result.convergence,
            "per_subclaim": [{"subclaim_id": p.subclaim_id, "score": p.score, "confidence": p.confidence}
                             for p in result.per_subclaim],
        }, round=round_no, act=act)

    async def _emit_verdict(self, case, claim, subclaims, evidence, jurors, ballots, result,
                            engine, bias_counts):
        sc_ids = [sc["id"] for sc in subclaims]
        votes = [_ballot_to_vote(j["slot"], ballots[j["slot"]], sc_ids) for j in jurors]
        final_sign = 1 if result.score > 0 else -1 if result.score < 0 else 0
        ece = expected_calibration_error(votes, final_sign)
        takeaway = await self._safe(
            agents.foreman_takeaway(
                self.reg, self.s, claim, result.label,
                [{"subclaim_id": p.subclaim_id, "score": p.score} for p in result.per_subclaim]),
            f"The room reached '{result.label}'. See the per-sub-claim breakdown below.",
            "foreman_takeaway")

        sc_text = {sc["id"]: sc["text"] for sc in subclaims}
        per_subclaim = []
        for p in result.per_subclaim:
            verdict = ("supported" if p.score > 0.3 else "contradicted" if p.score < -0.3 else "mixed")
            cites = [e["id"] for e in evidence if p.subclaim_id in (e.get("supports") or [])][:3]
            per_subclaim.append({"subclaim_id": p.subclaim_id,
                                 "verdict": f"{sc_text.get(p.subclaim_id,'')} — {verdict}.",
                                 "confidence": p.confidence, "citations": cites})

        mr = minority_report(votes, result.score)
        slot_name = {j["slot"]: j for j in jurors}
        for m in mr:
            jid = m["jurors"][0]
            b = ballots.get(jid)
            m["position"] = (getattr(b, "rationale", "") or
                             f"{slot_name.get(jid,{}).get('name','A juror')} holds a dissenting view.")
            m["citations"] = []

        top_cites = sorted(evidence, key=lambda e: e.get("credibility", 0), reverse=True)[:4]
        citations = [{"evidence_id": e["id"], "title": e["title"], "url": e["url"],
                      "credibility": e["credibility"]} for e in top_cites]

        up = case["user_prior"]
        verdict_payload = {
            "consensus": {"score": result.score, "label": result.label},
            "confidence": result.confidence, "ece": ece, "takeaway": takeaway,
            "per_subclaim": per_subclaim,
            "minority_report": mr,
            "bias_flags": [{"type": t, "count": c} for t, c in bias_counts.items()],
            "citations": citations,
            "user_comparison": {"user_prior": up, "room_final": result.score,
                                "moved": (up > 0) != (result.score > 0)},
        }
        await self.bus.emit("verdict.final", verdict_payload,
                            round=result_round(result, self.s.max_rounds), act=4)


def result_round(result, max_rounds: int) -> int:
    tp = result.turning_point
    return tp.round if tp else max_rounds


def _cred(evidence: list[dict], eid: str) -> float:
    for e in evidence:
        if e["id"] == eid:
            return e.get("credibility", 0.5)
    return 0.5


async def run_case(key: str, settings: Settings | None = None, *, bus: EventBus | None = None,
                   registry: ModelRegistry | None = None, case: dict | None = None) -> EventBus:
    """Convenience entry: build everything not supplied, run one deliberation, return the bus."""
    settings = settings or Settings.load()
    case = case or load_case(key)
    own_reg = registry is None
    registry = registry or ModelRegistry(settings)
    bus = bus or EventBus(case["case_id"])
    try:
        await Foreman(settings, registry, bus).run(case)
    finally:
        if own_reg:
            await registry.aclose()
    return bus
