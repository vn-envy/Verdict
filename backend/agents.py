"""Role agents — thin, structured-output wrappers over the model layer.

Each agent maps to the roster in 12_angry_agents_architecture.md §4. They produce the
structured payloads the orchestrator turns into events. Model assignment (free-account
conscious): reasoning model (o4-mini) only for the Foreman's framing/synthesis; cheap
gpt-41-mini for the Verifier and Bias Sentinel; gpt-4o for the Decomposer and Devil's
Advocate; jurors run on their own heterogeneous deployments.
"""
from __future__ import annotations

from config import Settings
from models import ModelRegistry, extract_json
from schemas import (
    BiasOut,
    ClaimTypeOut,
    DevilsAdvocateOut,
    FactcheckOut,
    JurorBallot,
    JurorTurn,
    SubclaimsOut,
)


def _normative_note(claim_type: str) -> str:
    """Appended to juror prompts on value-laden claims: 'unproven' is not 'false'."""
    if claim_type != "normative":
        return ""
    return (
        " NOTE: this is a VALUE/POLICY claim where reasonable, well-informed people genuinely "
        "disagree. 'Not empirically proven' is NOT the same as 'false'. If both sides have a fair "
        "case, your honest OVERALL vote is 0 (contested/unsure), not -1. Reserve -1 for a claim "
        "that is wrong on its own terms — not one that is merely unproven or that you dislike."
    )


def evidence_brief(evidence: list[dict]) -> str:
    """Compact, citable view of the shared evidence base for prompts."""
    return "\n".join(
        f"  {e['id']}: {e['title']} — {e['snippet']} (credibility {e['credibility']})"
        for e in evidence
    )


def _ballot_instructions(subclaims: list[dict]) -> str:
    ids = ", ".join(sc["id"] for sc in subclaims)
    return (
        "Vote -1 (false), 0 (unsure), or +1 (true) on the OVERALL claim with a confidence in [0,1]. "
        f"Then vote the same way on each sub-claim ({ids}). Cite evidence ids you relied on. "
        'Return ONLY JSON: {"vote":-1,"confidence":0.7,"rationale":"one line",'
        '"subclaims":[{"id":"sc1","vote":-1,"confidence":0.6}]}'
    )


def _persona(juror: dict) -> str:
    return (
        f"You are juror {juror['slot']} — {juror['name']}, a {juror['lens']} "
        f"({juror['voice']}). Coverage axis: {juror['axis']}. Disposition: {juror['disposition']}. "
        "You reason from evidence, not vibes, and you update your vote when the evidence demands it."
    )


# ---- Claim-type classifier (cheap, gates normative handling) -------------
async def classify_claim(reg: ModelRegistry, s: Settings, claim: str) -> str:
    raw = await reg.complete(
        s.gpt4o_mini,
        "Classify a claim's TYPE. DEFAULT to 'factual'. Choose 'normative' ONLY if the claim is "
        "primarily a value, fairness, policy, or 'should/best/better/worth-it' judgment that "
        "evidence cannot settle even in principle. A claim about what IS true in the world — "
        "science, history, economics, health — is 'factual' EVEN IF politically charged or "
        "disputed in bad faith. Examples: 'vaccines cause autism'=factual; 'climate change is "
        "human-caused'=factual; 'antibiotics work on colds'=factual; 'UBI would improve "
        "wellbeing'=normative; 'surge pricing is fair'=normative; 'nuclear is the best path'=normative.",
        f'CLAIM: {claim}\n\nReturn ONLY JSON: {{"type":"factual|normative"}}',
        max_tokens=60,
    )
    return ClaimTypeOut.model_validate(extract_json(raw)).type


# ---- Decomposer ----------------------------------------------------------
async def decompose(reg: ModelRegistry, s: Settings, claim: str, max_subclaims: int = 4) -> list[dict]:
    raw = await reg.complete(
        s.gpt4o,
        "You break a claim into atomic, independently checkable sub-claims ('facts in evidence').",
        f'CLAIM: {claim}\n\nReturn ONLY JSON with up to {max_subclaims} sub-claims: '
        '{"subclaims":[{"text":"..."}]}',
        max_tokens=500,
    )
    out = SubclaimsOut.model_validate(extract_json(raw))
    texts = [sc.text for sc in out.subclaims[:max_subclaims] if sc.text.strip()]
    if not texts:  # degrade to the whole claim as a single sub-claim
        texts = [claim]
    return [{"id": f"sc{i+1}", "text": t, "status": "open"} for i, t in enumerate(texts)]


# ---- Juror ---------------------------------------------------------------
async def juror_blind_ballot(
    reg: ModelRegistry, s: Settings, deployment: str, juror: dict, claim: str,
    subclaims: list[dict], evidence: list[dict], claim_type: str = "factual",
) -> JurorBallot:
    sys = (_persona(juror) + " This is the BLIND round: you have NOT seen any other juror's view."
           + _normative_note(claim_type))
    user = (
        f"CLAIM: {claim}\n\nSUB-CLAIMS:\n" + "\n".join(f"  {sc['id']}: {sc['text']}" for sc in subclaims)
        + "\n\nEVIDENCE:\n" + evidence_brief(evidence)
        + "\n\nYour opening lens: " + juror.get("opening_question", "")
        + "\n\n" + _ballot_instructions(subclaims)
    )
    raw = await reg.complete(deployment, sys, user, max_tokens=600)
    return JurorBallot.model_validate(extract_json(raw))


async def juror_turn(
    reg: ModelRegistry, s: Settings, deployment: str, juror: dict, claim: str,
    subclaims: list[dict], evidence: list[dict], context: str, claim_type: str = "factual",
) -> JurorTurn:
    sys = (_persona(juror) + " It is now open debate; weigh the floor and the evidence, then update."
           " Anchor on the EVIDENCE, not the room's mood: do NOT lower a well-evidenced vote just "
           "because others sound skeptical or a contrarian point was raised — change your vote only "
           "if the evidence itself genuinely warrants it. Equally, hold a strong stance only while "
           "the evidence supports it." + _normative_note(claim_type))
    user = (
        f"CLAIM: {claim}\n\nSUB-CLAIMS:\n" + "\n".join(f"  {sc['id']}: {sc['text']}" for sc in subclaims)
        + "\n\nEVIDENCE:\n" + evidence_brief(evidence)
        + f"\n\nTHE FLOOR (anonymized):\n{context}\n\n"
        "Speak ONE short, checkable claim for the floor, then re-cast your ballot. "
        'Return ONLY JSON: {"text":"your spoken line","subclaim_id":"sc3","citations":["ev1"],'
        '"ballot":{"vote":-1,"confidence":0.7,"rationale":"one line",'
        '"subclaims":[{"id":"sc1","vote":-1,"confidence":0.6}]}}'
    )
    raw = await reg.complete(deployment, sys, user, max_tokens=700)
    return JurorTurn.model_validate(extract_json(raw))


# ---- Devil's Advocate ----------------------------------------------------
async def devils_advocate(
    reg: ModelRegistry, s: Settings, claim: str, consensus_label: str, evidence: list[dict],
) -> DevilsAdvocateOut:
    raw = await reg.complete(
        s.gpt4o,
        "You are The Contrarian. You MUST attack whatever consensus is forming, regardless of side, "
        "surfacing the strongest overlooked counter-argument. You are a functionary, not a juror.",
        f"CLAIM: {claim}\nThe room is drifting toward: {consensus_label}.\n\nEVIDENCE:\n"
        + evidence_brief(evidence)
        + '\n\nReturn ONLY JSON: {"target_consensus":"...","argument":"your attack","citations":["ev4"]}',
        max_tokens=400,
        temperature=0.9,
    )
    return DevilsAdvocateOut.model_validate(extract_json(raw))


# ---- Verifier ------------------------------------------------------------
async def verify_claim(
    reg: ModelRegistry, s: Settings, claim_text: str, evidence: list[dict],
    claim_type: str = "factual",
) -> FactcheckOut:
    extra = (
        " This deliberation is on a NORMATIVE/value claim. A value or policy judgment cannot be "
        "empirically 'supported' or 'unsupported' — so if the statement is an opinion/value/policy "
        "judgment rather than a factual assertion, return status 'pending' (it is contested, not "
        "false). Only mark 'unsupported' for a factual sub-assertion the evidence actually refutes."
        if claim_type == "normative" else ""
    )
    raw = await reg.complete(
        s.gpt4o_mini,
        "You are the Verifier: an LLM-as-judge scoring a juror's claim ONLY against the shared "
        "evidence base. Do not use outside knowledge." + extra,
        f'CLAIM TO CHECK: "{claim_text}"\n\nEVIDENCE:\n' + evidence_brief(evidence)
        + '\n\nReturn ONLY JSON: {"status":"supported|unsupported|partial|pending",'
        '"citations":["ev1"],"note":"one line"}',
        max_tokens=300,
    )
    return FactcheckOut.model_validate(extract_json(raw))


# ---- Bias Sentinel -------------------------------------------------------
async def bias_scan(reg: ModelRegistry, s: Settings, text: str) -> BiasOut:
    raw = await reg.complete(
        s.gpt4o_mini,
        "You are the Bias & Sensationalism Sentinel. Flag emotional framing, missing context, "
        "manipulative language, or unsupported certainty in the given statement. Be sparing.",
        f'STATEMENT: "{text}"\n\nReturn ONLY JSON (empty list if clean): '
        '{"flags":[{"type":"unsupported_certainty","severity":"low","note":"why"}]}',
        max_tokens=250,
    )
    return BiasOut.model_validate(extract_json(raw))


async def content_safety_screen(s: Settings, text: str) -> dict:
    """Real Azure AI Content Safety call (Prompt Shields-style inbound screen). Resilient: a
    failure never blocks the deliberation, it just reports unavailable."""
    if not s.contentsafety_endpoint:
        return {"available": False}
    try:
        from azure.ai.contentsafety.aio import ContentSafetyClient
        from azure.ai.contentsafety.models import AnalyzeTextOptions
        from azure.identity.aio import DefaultAzureCredential

        cred = DefaultAzureCredential()
        client = ContentSafetyClient(s.contentsafety_endpoint, credential=cred)
        result = await client.analyze_text(AnalyzeTextOptions(text=text))
        await client.close()
        await cred.close()
        worst = max((c.severity for c in result.categories_analysis), default=0)
        return {"available": True, "max_severity": worst}
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "error": type(exc).__name__}


# ---- Foreman (reasoning model, used sparingly) ---------------------------
async def foreman_agenda(reg: ModelRegistry, s: Settings, round_no: int, subclaims: list[dict],
                         consensus_label: str) -> str:
    raw = await reg.complete(
        s.oseries,
        "You are the Foreman. In ONE sentence, set the agenda for the next debate round.",
        f"Round {round_no}. Current lean: {consensus_label}.\nSUB-CLAIMS:\n"
        + "\n".join(f"  {sc['id']}: {sc['text']}" for sc in subclaims)
        + "\nReturn just the sentence (no JSON).",
        want_json=False,
        max_tokens=1500,
    )
    return raw.strip().strip('"')


async def foreman_takeaway(reg: ModelRegistry, s: Settings, claim: str, label: str,
                           per_subclaim: list[dict]) -> str:
    lines = "\n".join(f"  {p['subclaim_id']}: score {p['score']}" for p in per_subclaim)
    raw = await reg.complete(
        s.oseries,
        "You are the Foreman writing the verdict's one-paragraph, human-repeatable takeaway. "
        "Be calibrated and concrete; no hedging boilerplate.",
        f"CLAIM: {claim}\nVERDICT: {label}\nPER-SUBCLAIM SCORES:\n{lines}\n"
        "Return just the paragraph (no JSON).",
        want_json=False,
        max_tokens=1500,
    )
    return raw.strip().strip('"')
