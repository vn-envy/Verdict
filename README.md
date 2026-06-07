# 12 Angry Agents — The Deliberation Room (front-end)

A live, broadcast-style debate room for the **12 Angry Agents** swarm: twelve heterogeneous AI jurors deliberate a contested claim through five acts, with live fact-checking, mandated dissent, a self-policing bias sentinel, and a preserved Minority Report — entertaining like a panel show, but fact-grounded and unbiased by construction.

This package is the **experience layer**. It runs entirely off canned event tapes, so the whole UI is buildable and demoable with **zero backend**. See the design docs in `~/Downloads/12_angry_agents_*.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Use the transport bar to **Play / Pause / Step / Restart**, change **speed** (0.5–3×), **scrub** the timeline, and switch between the three house cases.

## The five acts

| Act | Component | What it shows |
|---|---|---|
| Cold Open — The Docket | `ColdOpen` | Case file + jurors cast for *this* topic, each with its real model badge |
| Act 1 — Sealed Ballot | `SealedBallot` | Blind independent round (frosted booths) → poll-style reveal (anti-anchoring) |
| Act 2 — The Floor | `SpeakerSpotlight`, `FactCheckTicker`, `DevilsAdvocateCallout` | Cross-examination + live fact-check + the mandated-dissent "heel" |
| Act 3 — The Turn | `JuryBox`, `TurningPointBanner`, `ConsensusMeter` | Animated vote shifts + the turning point + swinging consensus |
| Act 4 — The Verdict | `VerdictCard` | Calibrated confidence, per-subclaim verdict, preserved **Minority Report**, you-vs-room |

## Architecture (one idea)

**The UI is a pure renderer of an event stream.** The engine emits events; the front-end never computes a score — consensus/confidence/convergence/ECE are taken verbatim from events. That's what keeps "calibrated, not a vibe" honest.

```
tape JSON ──► useEventStream() ──► reduce(state, event)  [pure fold over events[0..cursor]]
                                          │
                                          ▼
                                    <FloorScreen> ──► act components
```

- `lib/events.ts` — the event contract (mirrors `12_angry_agents_event_schema.md`).
- `lib/reducer.ts` — the single reducer, keyed by `seq`, idempotent & append-only. No derived numbers.
- `lib/useEventStream.ts` — transport. State is a **pure fold** over `events[0..cursor]`, so restart/scrub are trivial and correct.
- `components/*` — pure presentational renderers of slices of `CaseState`.
- `public/case_{A,B,C}_tape.json` — replay fixtures.
- `scripts/gen_tapes.mjs` — regenerates the A/B tapes (`node scripts/gen_tapes.mjs`).

## The house cases

| Case | Claim | Lands on | Demo role |
|---|---|---|---|
| **C** | Tariffs lower domestic prices for consumers | **likely false** (clean turning point) | Hero — minority/lead-proponent flip on camera |
| **A** | World Cup surge pricing is fair to fans | **contested** (honest split) | Shows the system refusing to force consensus |
| **B** | A 50% AI wealth tax would benefit the public | **leaning false** + self-interest disclosure | Meta centerpiece — AI judging AI policy |

All three are cast from the **same 12 fixed slots** (model + disposition never change); only the lens/name/voice is recast per topic — see `12_angry_agents_casting_director.md`.

## Swapping to a live backend

The transport is the only thing that changes. Replace the `fetch(tapeUrl)` in `lib/useEventStream.ts` with an SSE source:

```ts
const es = new EventSource(`/api/cases/${caseId}/stream`);
es.onmessage = (m) => applyEvent(JSON.parse(m.data)); // same Envelope, same reducer
```

Reconnects use `Last-Event-ID = lastSeq`; the engine replays the gap; the reducer dedupes by `seq`. **No component changes** — live and cached replay run through the identical renderer, so the demo looks exactly like production.

## Notes / next

- Motion is CSS-only (no animation deps) so install is light; swap in Framer Motion later if desired.
- Reduced-motion users get instant state changes (content identical).
- Not yet wired: the participatory pre-vote input (currently shows a locked prior from the tape), the `EvidenceDrawer` click-through, and an `EnterPlanMode`-style live topic submission box.
