// The single reducer, keyed by `seq` (idempotent, append-only).
// No derived scores live here — consensus/confidence come verbatim from events.

import {
  Envelope,
  Juror,
  Subclaim,
  EvidenceItem,
  ConsensusUpdate,
  BiasFlag,
  VoteShift,
  DevilsAdvocateAttack,
  TurningPoint,
  VerdictFinal,
  Vote,
  Citation,
  FactStatus,
} from "./events";

export interface ClaimRow {
  claim_ref: string;
  juror_id: string;
  text: string;
  subclaim_id?: string;
  status: FactStatus;
  citations: Citation[];
  note?: string;
}

export type Phase = "setup" | "blind" | "debate" | "verdict";

export interface CaseState {
  lastSeq: number;
  phase: Phase;
  round: number;
  caseId: string;
  claim?: string;
  userPrior?: number;
  subclaims: Subclaim[];
  evidence: Record<string, EvidenceItem>;
  jurors: Juror[];
  jurorsBySlot: Record<string, Juror>;
  da?: { model: string; name: string };
  balance?: { passed: boolean; mean_stance_prior: number; fell_back: boolean; notes?: string };
  panelDisclosure?: string;
  thinking: string[];
  sealed: string[];
  blindRevealed: boolean;
  votes: Record<string, { vote: Vote; confidence: number }>;
  shiftHistory: Record<string, VoteShift[]>;
  lastShift?: VoteShift;
  speaker?: string;
  claims: ClaimRow[];
  flags: BiasFlag[];
  daAttack?: DevilsAdvocateAttack;
  consensus?: ConsensusUpdate;
  turningPoint?: TurningPoint;
  verdict?: VerdictFinal;
  closed: boolean;
}

export function initialState(): CaseState {
  return {
    lastSeq: 0,
    phase: "setup",
    round: 0,
    caseId: "",
    subclaims: [],
    evidence: {},
    jurors: [],
    jurorsBySlot: {},
    thinking: [],
    sealed: [],
    blindRevealed: false,
    votes: {},
    shiftHistory: {},
    claims: [],
    flags: [],
    closed: false,
  };
}

export function reduce(state: CaseState, e: Envelope): CaseState {
  if (e.seq <= state.lastSeq) return state; // idempotent / reconnect-safe
  const base = { ...state, lastSeq: e.seq, round: e.round, caseId: e.case_id || state.caseId };
  const d = e.data;

  switch (e.event) {
    case "case.filed":
      return { ...base, claim: d.claim, userPrior: d.user_prior };

    case "subclaims.ready":
      return { ...base, subclaims: d.subclaims };

    case "panel.cast": {
      const jurorsBySlot: Record<string, Juror> = {};
      (d.jurors as Juror[]).forEach((j) => (jurorsBySlot[j.slot] = j));
      return { ...base, jurors: d.jurors, jurorsBySlot, da: d.devils_advocate };
    }

    case "panel.balance":
      return {
        ...base,
        balance: { passed: d.passed, mean_stance_prior: d.mean_stance_prior, fell_back: d.fell_back, notes: d.notes },
        panelDisclosure: d.disclosure ?? state.panelDisclosure,
      };

    case "evidence.ready": {
      const evidence = { ...state.evidence };
      (d.items as EvidenceItem[]).forEach((it) => (evidence[it.id] = it));
      return { ...base, evidence };
    }

    case "round.blind.start":
      return { ...base, phase: "blind", thinking: [], sealed: [] };

    case "juror.thinking":
      return { ...base, thinking: [...new Set([...state.thinking, d.juror_id])] };

    case "vote.cast":
      return {
        ...base,
        sealed: [...new Set([...state.sealed, d.juror_id])],
        thinking: state.thinking.filter((id) => id !== d.juror_id),
      };

    case "round.blind.reveal": {
      const votes: Record<string, { vote: Vote; confidence: number }> = {};
      (d.per_juror as { juror_id: string; vote: Vote; confidence: number }[]).forEach(
        (p) => (votes[p.juror_id] = { vote: p.vote, confidence: p.confidence })
      );
      return { ...base, blindRevealed: true, votes };
    }

    case "round.start":
      return { ...base, phase: "debate", daAttack: undefined, turningPoint: undefined };

    case "floor.speaker":
      return { ...base, speaker: d.juror_id };

    case "claim.made":
      return {
        ...base,
        claims: [
          ...state.claims,
          {
            claim_ref: d.claim_ref,
            juror_id: d.juror_id,
            text: d.text,
            subclaim_id: d.subclaim_id,
            status: "pending",
            citations: [],
          },
        ],
      };

    case "factcheck.result":
      return {
        ...base,
        claims: state.claims.map((c) =>
          c.claim_ref === d.claim_ref
            ? { ...c, status: d.status as FactStatus, citations: d.citations ?? [], note: d.note }
            : c
        ),
      };

    case "bias.flag":
      return { ...base, flags: [...state.flags, d as BiasFlag] };

    case "devils_advocate.attack":
      return { ...base, daAttack: d as DevilsAdvocateAttack };

    case "vote.shift": {
      const s = d as VoteShift;
      const history = { ...state.shiftHistory, [s.juror_id]: [...(state.shiftHistory[s.juror_id] ?? []), s] };
      return {
        ...base,
        votes: { ...state.votes, [s.juror_id]: { vote: s.to, confidence: s.confidence } },
        shiftHistory: history,
        lastShift: s,
      };
    }

    case "consensus.update":
      return { ...base, consensus: d as ConsensusUpdate };

    case "turning_point":
      return { ...base, turningPoint: d as TurningPoint };

    case "round.end":
      return base;

    case "verdict.final":
      return { ...base, phase: "verdict", verdict: d as VerdictFinal };

    case "case.closed":
      return { ...base, closed: true };

    default:
      return base;
  }
}
