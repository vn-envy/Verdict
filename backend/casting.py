"""Casting Director — fixed anti-anchoring scaffold + topic-relevant, provably-balanced panel.

Layers (per 12_angry_agents_casting_director.md):
  L1 Structural slots: model + epistemic disposition — FIXED, never topic-dependent.
  L2 Coverage axes: 6 stakeholder lenses x2 — a contract the casting MUST satisfy.
  L3 Persona casting: the LLM assigns lens/name/voice/stance_prior/opening_question per slot.

The balance audit (L2) is DETERMINISTIC code, not an LLM vibe. We pin axis->slot from the
doc's worked example so balance is structurally guaranteed; the LLM only adds topical flavor.
The doc's two Llama slots are remapped onto our deployed models (no Llama provisioned), kept
off Phi-4 to respect its cap-1 throughput.
"""
from __future__ import annotations

from dataclasses import dataclass

from config import Settings
from models import ModelRegistry, extract_json, model_label
from schemas import CastOut


@dataclass(frozen=True)
class SlotSpec:
    id: str
    deployment_key: str  # which Settings deployment attr to use
    disposition: str
    axis: str


# Fixed 12 slots: disposition + axis from the casting doc; model remapped to our 5 deployments.
# deployment_key is resolved against Settings at runtime.
SLOTS: list[SlotSpec] = [
    SlotSpec("S1", "gpt4o", "tol/prin/long/ref", "proponent"),
    SlotSpec("S10", "mistral_deployment", "tol/prin/long/ref", "proponent"),
    SlotSpec("S3", "oseries", "av/emp/long/sq", "opponent"),
    SlotSpec("S4", "gpt4o_mini", "av/emp/near/sq", "opponent"),
    SlotSpec("S5", "mistral_deployment", "av/prin/near/ref", "affected"),   # was Llama
    SlotSpec("S6", "phi4_deployment", "av/emp/near/ref", "affected"),
    SlotSpec("S7", "oseries", "av/prin/long/sq", "methodologist"),
    SlotSpec("S8", "phi4_deployment", "tol/emp/near/ref", "methodologist"),
    SlotSpec("S9", "gpt4o", "av/prin/long/ref", "ethicist"),
    SlotSpec("S12", "gpt4o_mini", "tol/emp/long/sq", "ethicist"),
    SlotSpec("S2", "mistral_deployment", "tol/emp/near/sq", "historian"),
    SlotSpec("S11", "gpt4o", "av/prin/long/sq", "historian"),               # was Llama
]

AXES = ["proponent", "opponent", "affected", "methodologist", "ethicist", "historian"]

_GENERIC_LENS = {
    "proponent": ("Supportive Domain Expert", "Avery", "steelmans the claim"),
    "opponent": ("Critical Domain Expert", "Okun", "challenges the claim"),
    "affected": ("Affected Stakeholder", "Reyes", "lived experience, not theory"),
    "methodologist": ("Methodologist / Skeptic", "Holm", "cares about evidence quality"),
    "ethicist": ("Ethicist", "Soto", "who bears the cost"),
    "historian": ("Historian / Precedent", "Wren", "what comparable cases show"),
}


def deployment_for(settings: Settings, slot: SlotSpec) -> str:
    return getattr(settings, slot.deployment_key)


def _casting_prompt(claim: str, subclaims: list[dict], slots: list[SlotSpec]) -> str:
    slot_lines = "\n".join(
        f'  - slot {s.id}: disposition {s.disposition}, coverage_axis "{s.axis}"' for s in slots
    )
    sc_lines = "\n".join(f"  - {sc['id']}: {sc['text']}" for sc in subclaims)
    return (
        f"CLAIM: {claim}\n\nSUB-CLAIMS:\n{sc_lines}\n\n"
        f"SLOTS (fixed model+disposition+axis — you may NOT change these):\n{slot_lines}\n\n"
        "For EACH slot assign a topic-relevant persona that fits its disposition and axis:\n"
        "  lens (a specific domain expertise for THIS claim), name (one word), voice (one short line),\n"
        "  stance_prior (a number in [-1,1] for balance only), opening_question (one cross-exam line).\n"
        "Keep proponents positive-leaning and opponents negative-leaning so the panel is balanced.\n"
        "No two lenses may be near-duplicates. Return ONLY JSON:\n"
        '{"assignments":[{"slot":"S1","axis":"proponent","lens":"...","name":"...",'
        '"voice":"...","stance_prior":0.3,"opening_question":"..."}]}'
    )


async def cast_panel(
    registry: ModelRegistry, settings: Settings, claim: str, subclaims: list[dict], panel_size: int
) -> tuple[list[dict], dict, dict]:
    """Return (jurors, balance, devils_advocate)."""
    slots = SLOTS[: max(2, min(panel_size, len(SLOTS)))]

    # L3 — ask the Casting Director (gpt-4o) for personas.
    by_slot: dict[str, dict] = {}
    try:
        raw = await registry.complete(
            settings.gpt4o,
            "You are the Casting Director for a deliberation panel. You hold no opinion on the claim. "
            "Assign relevant, balanced personas. Do not editorialize.",
            _casting_prompt(claim, subclaims, slots),
            want_json=True,
            max_tokens=1800,
        )
        cast = CastOut.model_validate(extract_json(raw))
        by_slot = {a.slot: a for a in cast.assignments}
    except Exception:  # noqa: BLE001 — fall back to generic lenses below
        by_slot = {}

    jurors: list[dict] = []
    fell_back = False
    for s in slots:
        a = by_slot.get(s.id)
        if a is None or not a.lens:
            fell_back = True
            lens, name, voice = _GENERIC_LENS[s.axis]
            stance = 0.3 if s.axis == "proponent" else -0.3 if s.axis == "opponent" else 0.0
            jurors.append({
                "slot": s.id, "model": model_label(settings, deployment_for(settings, s)),
                "disposition": s.disposition, "axis": s.axis, "lens": lens, "name": name,
                "voice": voice, "stance_prior": stance,
                "opening_question": "What does the evidence actually show?",
            })
        else:
            jurors.append({
                "slot": s.id, "model": model_label(settings, deployment_for(settings, s)),
                "disposition": s.disposition, "axis": a.axis or s.axis, "lens": a.lens,
                "name": a.name, "voice": a.voice, "stance_prior": a.stance_prior,
                "opening_question": a.opening_question,
            })

    balance = _balance_audit(jurors, fell_back)
    devils_advocate = {"model": model_label(settings, settings.gpt4o), "name": "The Contrarian"}
    return jurors, balance, devils_advocate


def _balance_audit(jurors: list[dict], fell_back: bool) -> dict:
    """Deterministic L2 audit; nudges priors to center so |mean| <= 0.25 with both signs present."""
    axes_filled = {ax: sum(1 for j in jurors if j["axis"] == ax) for ax in AXES}
    priors = [j["stance_prior"] for j in jurors]
    mean = sum(priors) / len(priors) if priors else 0.0

    # Center the distribution if skewed (deterministic re-balance, never an LLM call).
    if abs(mean) > 0.25:
        for j in jurors:
            j["stance_prior"] = round(max(-1.0, min(1.0, j["stance_prior"] - mean)), 3)
        priors = [j["stance_prior"] for j in jurors]
        mean = sum(priors) / len(priors)

    signs = {1 if p > 0 else -1 if p < 0 else 0 for p in priors}
    both_signs = (1 in signs) and (-1 in signs)
    if not both_signs and jurors:  # force at least one opposing sign
        jurors[0]["stance_prior"] = abs(jurors[0]["stance_prior"]) or 0.2
        jurors[-1]["stance_prior"] = -(abs(jurors[-1]["stance_prior"]) or 0.2)
        priors = [j["stance_prior"] for j in jurors]
        mean = sum(priors) / len(priors)
        both_signs = True

    has_prop = axes_filled.get("proponent", 0) >= 1
    has_opp = axes_filled.get("opponent", 0) >= 1
    dispositions = {j["disposition"] for j in jurors}
    passed = has_prop and has_opp and abs(mean) <= 0.25 and both_signs and len(dispositions) >= 4

    return {
        "passed": passed,
        "mean_stance_prior": round(mean, 3),
        "axes_filled": axes_filled,
        "retries": 0,
        "fell_back": fell_back,
        "notes": "both stance signs present" if both_signs else "balance forced",
    }
