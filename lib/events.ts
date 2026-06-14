// Event types — mirrors 12_angry_agents_event_schema.md.
// The engine emits these; the UI is a pure renderer of them.

export type EventType =
  | "case.filed"
  | "subclaims.ready"
  | "panel.cast"
  | "panel.balance"
  | "evidence.ready"
  | "round.blind.start"
  | "juror.thinking"
  | "vote.cast"
  | "round.blind.reveal"
  | "round.start"
  | "floor.speaker"
  | "claim.made"
  | "factcheck.result"
  | "bias.flag"
  | "devils_advocate.attack"
  | "vote.shift"
  | "consensus.update"
  | "turning_point"
  | "round.end"
  | "verdict.final"
  | "case.closed";

export interface Envelope<T = any> {
  event: EventType;
  case_id: string;
  seq: number;
  ts: string;
  round: number;
  act: 1 | 2 | 3 | 4;
  data: T;
}

export type Vote = -1 | 0 | 1;

export interface Juror {
  slot: string;
  model: string;
  disposition: string;
  axis: string;
  lens: string;
  name: string;
  voice: string;
  stance_prior: number;
  opening_question: string;
  why?: string;                 // why this persona is on the panel for THIS claim
  disposition_label?: string;   // human-readable disposition (e.g. "tolerant · principled · …")
}

export interface Subclaim {
  id: string;
  text: string;
  status: string;
}

export interface Citation {
  evidence_id: string;
  credibility?: number;
}

export interface EvidenceItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  credibility: number;
  supports?: string[];
}

export type FactStatus = "supported" | "unsupported" | "partial" | "pending";

export interface ConsensusUpdate {
  score: number;
  label: string;
  confidence: number;
  convergence: number;
  per_subclaim: { subclaim_id: string; score: number; confidence: number }[];
}

export interface BiasFlag {
  juror_id: string;
  type: string;
  span_id?: string;
  severity: "low" | "med" | "high";
  note?: string;
}

export interface VoteShift {
  juror_id: string;
  subclaim_id?: string;
  from: Vote;
  to: Vote;
  confidence: number;
  delta_confidence: number;
  reason: string;
  citations?: Citation[];
}

export interface DevilsAdvocateAttack {
  name: string;
  target_consensus: string;
  argument: string;
  citations?: Citation[];
}

export interface TurningPoint {
  round: number;
  description: string;
  trigger: string;
  movers: string[];
}

export interface VerdictFinal {
  consensus: { score: number; label: string };
  confidence: number;
  ece: number;
  takeaway: string;
  per_subclaim: { subclaim_id: string; verdict: string; confidence: number; citations: string[] }[];
  minority_report: { jurors: string[]; position: string; confidence: number; citations: string[] }[];
  bias_flags: { type: string; count: number }[];
  citations: { evidence_id: string; title: string; url: string; credibility: number }[];
  user_comparison?: { user_prior: number; room_final: number; moved: boolean };
}

export interface Tape {
  tape_version: string;
  case_id: string;
  title: string;
  note?: string;
  evidence_catalog: EvidenceItem[];
  events: Envelope[];
}
