// Generates schema-valid replay tapes for Cases A and B into /public.
// Run: node scripts/gen_tapes.mjs
// Boilerplate (seq, ts, act) is auto-assigned so the arcs stay readable.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dir, "..", "public");

class Tape {
  constructor(caseId, title, evidence) {
    this.caseId = caseId;
    this.title = title;
    this.evidence = evidence;
    this.events = [];
    this.seq = 0;
    this.t = Date.parse("2026-06-07T15:00:00Z");
    this.act = 1;
  }
  push(event, data, round = this.round ?? 0) {
    this.t += 6000 + Math.floor(Math.random() * 4000);
    this.events.push({
      event,
      case_id: this.caseId,
      seq: ++this.seq,
      ts: new Date(this.t).toISOString(),
      round,
      act: this.act,
      data,
    });
    return this;
  }
  setRound(n) {
    this.round = n;
    this.act = n === 0 ? 1 : n >= 3 ? 3 : 2;
    return this;
  }
  filed(claim, user_prior) { return this.push("case.filed", { claim, source: "user", user_prior }); }
  subclaims(list) { return this.push("subclaims.ready", { subclaims: list.map(([id, text]) => ({ id, text, status: "open" })) }); }
  cast(jurors, da) {
    const axes_filled = {};
    jurors.forEach((j) => (axes_filled[j.axis] = (axes_filled[j.axis] || 0) + 1));
    return this.push("panel.cast", { axes_filled, devils_advocate: da, jurors });
  }
  balance(jurors, extra = {}) {
    const mean = +(jurors.reduce((a, j) => a + j.stance_prior, 0) / jurors.length).toFixed(2);
    const axes_filled = {};
    jurors.forEach((j) => (axes_filled[j.axis] = (axes_filled[j.axis] || 0) + 1));
    return this.push("panel.balance", { passed: true, mean_stance_prior: mean, axes_filled, retries: 0, fell_back: false, ...extra });
  }
  evidenceReady(ids, for_subclaim) {
    const items = ids.map((id) => this.evidence.find((e) => e.id === id));
    return this.push("evidence.ready", for_subclaim ? { for_subclaim, items } : { items });
  }
  blindStart() { return this.setRound(0).push("round.blind.start", {}); }
  thinking(ids) { ids.forEach((id) => this.push("juror.thinking", { juror_id: id })); return this; }
  votesCast(ids) { ids.forEach((id) => this.push("vote.cast", { juror_id: id, sealed: true })); return this; }
  reveal(perJuror) {
    const tally = { yes: 0, no: 0, abstain: 0 };
    perJuror.forEach((p) => (tally[p.vote === 1 ? "yes" : p.vote === -1 ? "no" : "abstain"]++));
    return this.push("round.blind.reveal", { tally, per_juror: perJuror });
  }
  consensus(score, label, confidence, convergence, per) {
    return this.push("consensus.update", { score, label, confidence, convergence, per_subclaim: per });
  }
  roundStart(n, agenda) { return this.setRound(n).push("round.start", { round: n, agenda }); }
  speaker(id) { return this.push("floor.speaker", { juror_id: id }); }
  claim(juror_id, text, claim_ref, subclaim_id, spans = []) { return this.push("claim.made", { juror_id, text, claim_ref, subclaim_id, spans }); }
  factcheck(claim_ref, status, citations = [], note) { return this.push("factcheck.result", { claim_ref, status, citations, note }); }
  bias(juror_id, type, severity, note, span_id) { return this.push("bias.flag", { juror_id, type, span_id, severity, note }); }
  da(name, target_consensus, argument, citations = []) { return this.push("devils_advocate.attack", { name, target_consensus, argument, citations }); }
  shift(juror_id, subclaim_id, from, to, confidence, delta_confidence, reason, citations = []) {
    return this.push("vote.shift", { juror_id, subclaim_id, from, to, confidence, delta_confidence, reason, citations });
  }
  turning(round, description, trigger, movers) { return this.push("turning_point", { round, description, trigger, movers }); }
  roundEnd(n, converged, stalled) { return this.push("round.end", { round: n, converged, stalled }); }
  verdict(v) { this.act = 4; return this.push("verdict.final", v); }
  closed() { this.act = 4; return this.push("case.closed", { tape_uri: `cosmos://deliberations/${this.caseId}/tape` }); }
}

const cite = (id, c) => ({ evidence_id: id, credibility: c });

/* ---------------- CASE A — World Cup surge pricing ---------------- */
function caseA() {
  const ev = [
    { id: "eva1", title: "Secondary-market resale floors, 2026 cycle", url: "https://example.org/eva1", snippet: "Resale prices fell below face for many matches, signalling weaker scalping leverage.", credibility: 0.78, supports: ["sca2"] },
    { id: "eva2", title: "Dynamic pricing & access (sports economics review)", url: "https://example.org/eva2", snippet: "Demand-based pricing clears markets but shifts allocation toward willingness-to-pay.", credibility: 0.72, supports: ["sca1", "sca4"] },
    { id: "eva3", title: "Income and ticket access survey", url: "https://example.org/eva3", snippet: "Lower-income fans disproportionately priced out at peak demand windows.", credibility: 0.70, supports: ["sca3"] },
    { id: "eva4", title: "Bot & bulk-buying mitigation report", url: "https://example.org/eva4", snippet: "Dynamic + identity checks reduced bulk bot purchases vs. fixed-price drops.", credibility: 0.75, supports: ["sca2"] },
    { id: "eva5", title: "Mega-event pricing history (Olympics, Super Bowl)", url: "https://example.org/eva5", snippet: "Fixed-price events historically captured by resellers and sponsors.", credibility: 0.74, supports: ["sca2", "sca4"] },
    { id: "eva6", title: "Qatar 2022 access comparison", url: "https://example.org/eva6", snippet: "Mixed: broader nominal availability, but local-fan access uneven.", credibility: 0.70, supports: ["sca3", "sca4"] },
  ];
  const jurors = [
    { slot: "S1", model: "gpt-4o", disposition: "tol/prin/long/ref", axis: "proponent", lens: "Sports Economist", name: "Vega", voice: "markets-clear-best", stance_prior: 0.5, opening_question: "Isn't a $0 face-value ticket just a gift to scalpers?" },
    { slot: "S10", model: "mistral-large", disposition: "tol/prin/long/ref", axis: "proponent", lens: "Revenue/Yield Strategist", name: "Brandt", voice: "pricing-is-information", stance_prior: 0.4, opening_question: "Demand signals fund more seats — why hide them?" },
    { slot: "S3", model: "o-series", disposition: "av/emp/long/sq", axis: "opponent", lens: "Consumer-Protection Economist", name: "Okun", voice: "watch the elasticity", stance_prior: -0.5, opening_question: "Show me surge pricing that widened access." },
    { slot: "S4", model: "gpt-4o-mini", disposition: "av/emp/near/sq", axis: "opponent", lens: "Ticketing-Market Analyst", name: "Pell", voice: "resale-data realist", stance_prior: -0.4, opening_question: "Resale floors fell — so demand wasn't there. Now what?" },
    { slot: "S5", model: "llama-3.1-70b", disposition: "av/prin/near/ref", axis: "affected", lens: "Traveling-Supporter Advocate", name: "Reyes", voice: "fan-first, away-days", stance_prior: -0.3, opening_question: "I saved two years — and the price moved on me." },
    { slot: "S6", model: "phi-4", disposition: "av/emp/near/ref", axis: "affected", lens: "Local/Host-City Fan Advocate", name: "Mott", voice: "priced-out-at-home", stance_prior: -0.4, opening_question: "It's in my city and I can't afford my own stadium." },
    { slot: "S7", model: "o-series", disposition: "av/prin/long/sq", axis: "methodologist", lens: "Mechanism-Design Skeptic", name: "Holm", voice: "incentives & gaming", stance_prior: 0.0, opening_question: "What stops bots from front-running the surge?" },
    { slot: "S8", model: "phi-4", disposition: "tol/emp/near/ref", axis: "methodologist", lens: "Ticketing Technologist", name: "Kade", voice: "logs over rhetoric", stance_prior: 0.0, opening_question: "Define 'fair' as a metric — then we can test it." },
    { slot: "S9", model: "gpt-4o", disposition: "av/prin/long/ref", axis: "ethicist", lens: "Access-&-Equity Ethicist", name: "Soto", voice: "sport-as-public-good", stance_prior: -0.4, opening_question: "Is the World Cup a market or a commons?" },
    { slot: "S12", model: "gpt-4o-mini", disposition: "tol/emp/long/sq", axis: "ethicist", lens: "Commercialization Ethicist", name: "Aldous", voice: "money in modern sport", stance_prior: 0.1, opening_question: "We already accept paid seats — where's the moral line?" },
    { slot: "S2", model: "mistral-large", disposition: "tol/emp/near/sq", axis: "historian", lens: "Sports-Business Historian", name: "Wren", voice: "Olympics to Super Bowl", stance_prior: -0.2, opening_question: "Every 'fair' pricing reform got captured. Why not this?" },
    { slot: "S11", model: "llama-3.1-70b", disposition: "av/prin/long/sq", axis: "historian", lens: "Comparative-Events Historian", name: "Ito", voice: "cross-event cases", stance_prior: 0.0, opening_question: "Past hosts tried both models — which fans got in?" },
  ];
  const allIds = jurors.map((j) => j.slot);
  const t = new Tape("A", "Dynamic 'surge' pricing for 2026 World Cup tickets is fair to fans", ev);
  t.filed("Dynamic 'surge' pricing for 2026 World Cup tickets is fair to fans.", -0.5)
    .subclaims([["sca1", "Dynamic pricing reflects true demand, not arbitrary gouging."], ["sca2", "It reduces scalping and secondary-market markups."], ["sca3", "It does not disproportionately exclude lower-income fans."], ["sca4", "Net effect on overall fan access is positive vs. fixed pricing."]])
    .cast(jurors, { model: "gpt-4o", name: "The Contrarian" })
    .balance(jurors)
    .evidenceReady(ev.map((e) => e.id));
  t.blindStart().thinking(allIds).votesCast(allIds).reveal([
    { juror_id: "S1", vote: 1, confidence: 0.7 }, { juror_id: "S10", vote: 1, confidence: 0.66 },
    { juror_id: "S3", vote: -1, confidence: 0.72 }, { juror_id: "S4", vote: -1, confidence: 0.6 },
    { juror_id: "S5", vote: -1, confidence: 0.62 }, { juror_id: "S6", vote: -1, confidence: 0.68 },
    { juror_id: "S7", vote: 0, confidence: 0.4 }, { juror_id: "S8", vote: 0, confidence: 0.42 },
    { juror_id: "S9", vote: -1, confidence: 0.64 }, { juror_id: "S12", vote: 1, confidence: 0.52 },
    { juror_id: "S2", vote: -1, confidence: 0.55 }, { juror_id: "S11", vote: 0, confidence: 0.45 },
  ]);
  t.consensus(-0.22, "contested", 0.42, 0.2, [
    { subclaim_id: "sca1", score: 0.1, confidence: 0.38 }, { subclaim_id: "sca2", score: 0.0, confidence: 0.35 },
    { subclaim_id: "sca3", score: -0.4, confidence: 0.46 }, { subclaim_id: "sca4", score: -0.15, confidence: 0.33 },
  ]);
  // Round 1 — does it actually beat scalpers?
  t.roundStart(1, "Sub-claim 2: does dynamic pricing actually reduce scalping?");
  t.speaker("S4").claim("S4", "Resale floors fell below face this cycle — that's demand met at the source, not gouging.", "a-cl1", "sca2").factcheck("a-cl1", "supported", [cite("eva1", 0.78)]);
  t.speaker("S1").claim("S1", "Exactly — a fixed $50 ticket worth $500 obviously just hands $450 to a reseller.", "a-cl2", "sca2", [{ id: "a-sp1", start: 30, end: 38 }]).bias("S1", "unsupported_certainty", "low", "'obviously' overstates a contested allocation claim", "a-sp1").factcheck("a-cl2", "partial", [cite("eva4", 0.75), cite("eva5", 0.74)], "Bot mitigation helped; the resale-vs-access tradeoff is not settled.");
  t.speaker("S6").claim("S6", "Reducing scalping isn't the same as letting locals in. It's in my city and I'm still priced out.", "a-cl3", "sca3").factcheck("a-cl3", "supported", [cite("eva3", 0.70)]);
  t.da("The Contrarian", "the 'unfair' lean", "You're romanticizing fixed pricing — which historically just hands seats to scalpers and to whoever can refresh fastest. Surge at least funds capacity.", [cite("eva5", 0.74)]);
  t.shift("S7", "sca2", 0, 1, 0.6, 0.2, "The anti-scalping evidence is real; on sub-claim 2 I move to agree.", [cite("eva1"), cite("eva4")]);
  t.shift("S8", "sca2", 0, 1, 0.58, 0.16, "Bot mitigation data convinces me on the scalping point specifically.", [cite("eva4")]);
  t.consensus(-0.12, "contested", 0.5, 0.4, [
    { subclaim_id: "sca1", score: 0.2, confidence: 0.5 }, { subclaim_id: "sca2", score: 0.35, confidence: 0.6 },
    { subclaim_id: "sca3", score: -0.45, confidence: 0.6 }, { subclaim_id: "sca4", score: -0.1, confidence: 0.45 },
  ]).roundEnd(1, false, false);
  // Round 2 — equity vs. access
  t.roundStart(2, "Sub-claim 3 & 4: access and equity. Does 'fair' survive the income test?");
  t.speaker("S9").claim("S9", "If the basket of seats clears by willingness-to-pay, the lowest-income fans are structurally last in line. That's the fairness question.", "a-cl4", "sca3").factcheck("a-cl4", "supported", [cite("eva3", 0.70), cite("eva2", 0.72)]);
  t.speaker("S11").claim("S11", "Past hosts ran both models; access outcomes were mixed, not clearly better under either.", "a-cl5", "sca4").factcheck("a-cl5", "partial", [cite("eva6", 0.70), cite("eva5", 0.74)], "Cross-event evidence is genuinely ambiguous on net access.");
  t.speaker("S3").claim("S3", "I'll concede the scalping point — but 'fair to fans' has to mean access, and there the case is unproven.", "a-cl6", "sca4").factcheck("a-cl6", "partial", [cite("eva2", 0.72)]);
  t.shift("S5", "sca2", -1, 0, 0.5, -0.02, "Conceding scalping is reduced; I can't call the whole thing unfair, but equity worries hold.", [cite("eva1")]);
  t.shift("S3", "sca4", -1, 0, 0.52, -0.06, "Moving to abstain on the headline: it's neither clearly fair nor clearly unfair.", [cite("eva2")]);
  t.turning(2, "Okun, a lead opponent, concedes the anti-scalping case and moves to abstain — the room splits rather than converges.", "minority_flip", ["S3"]);
  t.consensus(-0.08, "contested", 0.56, 0.55, [
    { subclaim_id: "sca1", score: 0.25, confidence: 0.58 }, { subclaim_id: "sca2", score: 0.42, confidence: 0.66 },
    { subclaim_id: "sca3", score: -0.5, confidence: 0.66 }, { subclaim_id: "sca4", score: -0.05, confidence: 0.5 },
  ]).roundEnd(2, true, false);
  t.verdict({
    consensus: { score: -0.08, label: "contested" },
    confidence: 0.56, ece: 0.07,
    takeaway: "Dynamic pricing genuinely curbs scalping and reflects real demand — but it does not clearly widen access, and it structurally disadvantages lower-income fans. 'Fair to fans' is half-true: fairer against resellers, not fairer on access. The room ends honestly split rather than forced to a verdict.",
    per_subclaim: [
      { subclaim_id: "sca1", verdict: "Reflects demand, not arbitrary gouging — leaning true.", confidence: 0.58, citations: ["eva2"] },
      { subclaim_id: "sca2", verdict: "Reduces scalping — supported.", confidence: 0.66, citations: ["eva1", "eva4"] },
      { subclaim_id: "sca3", verdict: "Excludes lower-income fans — supported (counts against 'fair').", confidence: 0.66, citations: ["eva3"] },
      { subclaim_id: "sca4", verdict: "Net access vs. fixed pricing — genuinely contested.", confidence: 0.5, citations: ["eva6", "eva2"] },
    ],
    minority_report: [
      { jurors: ["S1", "S10"], position: "Vega & Brandt: against the realistic alternative (scalper-captured fixed pricing), dynamic pricing is the fairer mechanism, full stop.", confidence: 0.6, citations: ["eva5"] },
      { jurors: ["S9"], position: "Soto: any pricing that allocates a public sporting event by willingness-to-pay cannot be called 'fair' to all fans.", confidence: 0.62, citations: ["eva3"] },
    ],
    bias_flags: [{ type: "unsupported_certainty", count: 1 }],
    citations: ev.filter((e) => ["eva1", "eva3", "eva4", "eva5"].includes(e.id)).map((e) => ({ evidence_id: e.id, title: e.title, url: e.url, credibility: e.credibility })),
    user_comparison: { user_prior: -0.5, room_final: -0.08, moved: false },
  });
  t.closed();
  return t;
}

/* ---------------- CASE B — AI wealth tax ---------------- */
function caseB() {
  const ev = [
    { id: "evb1", title: "One-time wealth/levy revenue studies", url: "https://example.org/evb1", snippet: "Taxes on unrealized stock value raise far less than headline due to valuation and realization.", credibility: 0.80, supports: ["scb1"] },
    { id: "evb2", title: "Capital mobility & corporate relocation evidence", url: "https://example.org/evb2", snippet: "High one-time levies accelerate domicile shifts and structure changes.", credibility: 0.78, supports: ["scb1"] },
    { id: "evb3", title: "Sovereign wealth fund deployment (Norway model)", url: "https://example.org/evb3", snippet: "Well-governed SWFs can deliver broad public benefit over decades.", credibility: 0.82, supports: ["scb3"] },
    { id: "evb4", title: "Windfall-tax history review", url: "https://example.org/evb4", snippet: "Most windfall taxes underperformed forecasts and were repealed.", credibility: 0.80, supports: ["scb1", "scb4"] },
    { id: "evb5", title: "Constitutional analysis of wealth taxes", url: "https://example.org/evb5", snippet: "Direct-tax and takings challenges create material legal risk.", credibility: 0.76, supports: ["scb4"] },
    { id: "evb6", title: "AI investment elasticity estimates", url: "https://example.org/evb6", snippet: "Frontier AI capex is sensitive to after-tax returns at the margin.", credibility: 0.70, supports: ["scb2"] },
  ];
  const jurors = [
    { slot: "S1", model: "gpt-4o", disposition: "tol/prin/long/ref", axis: "proponent", lens: "Public-Finance Economist", name: "Vega", voice: "windfalls should be shared", stance_prior: 0.5, opening_question: "Excess rents exist — why shouldn't the public capture them?" },
    { slot: "S10", model: "mistral-large", disposition: "tol/prin/long/ref", axis: "proponent", lens: "Distributive Policy Strategist", name: "Brandt", voice: "sovereign-wealth builder", stance_prior: 0.4, opening_question: "Norway did it with oil — why not with compute?" },
    { slot: "S3", model: "o-series", disposition: "av/emp/long/sq", axis: "opponent", lens: "Tax-Incidence Economist", name: "Okun", voice: "who really pays", stance_prior: -0.5, opening_question: "A one-time tax on stock — does that even raise revenue?" },
    { slot: "S4", model: "gpt-4o-mini", disposition: "av/emp/near/sq", axis: "opponent", lens: "Capital-Markets Analyst", name: "Pell", voice: "flight & valuation", stance_prior: -0.5, opening_question: "Name the jurisdiction the capital doesn't leave for." },
    { slot: "S5", model: "llama-3.1-70b", disposition: "av/prin/near/ref", axis: "affected", lens: "Worker/Displacement Advocate", name: "Reyes", voice: "labor side of AI", stance_prior: 0.2, opening_question: "If AI takes the jobs, shouldn't it fund the fallout?" },
    { slot: "S6", model: "phi-4", disposition: "av/emp/near/ref", axis: "affected", lens: "AI-Startup Founder", name: "Mott", voice: "downstream-builder", stance_prior: -0.3, opening_question: "Tax the leaders, and my compute bill goes up. Then what?" },
    { slot: "S7", model: "o-series", disposition: "av/prin/long/sq", axis: "methodologist", lens: "Fiscal Modeler", name: "Holm", voice: "dynamic scoring", stance_prior: 0.0, opening_question: "Where's the behavioral-response estimate? Static is fiction." },
    { slot: "S8", model: "phi-4", disposition: "tol/emp/near/ref", axis: "methodologist", lens: "Tech-Economics Analyst", name: "Kade", voice: "unit-economics of AI", stance_prior: 0.0, opening_question: "Are these 'windfalls' profits or just paper valuations?" },
    { slot: "S9", model: "gpt-4o", disposition: "av/prin/long/ref", axis: "ethicist", lens: "Economic-Justice Ethicist", name: "Soto", voice: "concentration of power", stance_prior: 0.4, opening_question: "Should this much capability sit in so few hands untaxed?" },
    { slot: "S12", model: "gpt-4o-mini", disposition: "tol/emp/long/sq", axis: "ethicist", lens: "Innovation Ethicist", name: "Aldous", voice: "progress-as-public-good", stance_prior: -0.2, opening_question: "Slow the frontier and who pays the opportunity cost?" },
    { slot: "S2", model: "mistral-large", disposition: "tol/emp/near/sq", axis: "historian", lens: "Tax-Policy Historian", name: "Wren", voice: "windfall taxes, 1980 to now", stance_prior: -0.1, opening_question: "Windfall taxes have a graveyard. Why is this one different?" },
    { slot: "S11", model: "llama-3.1-70b", disposition: "av/prin/long/sq", axis: "historian", lens: "Tech-Regulation Historian", name: "Ito", voice: "Standard Oil to Big Tech", stance_prior: 0.1, opening_question: "We broke up monopolies before — is tax the weaker tool?" },
  ];
  const allIds = jurors.map((j) => j.slot);
  const t = new Tape("B", "A one-time 50% wealth tax on AI companies would benefit the public", ev);
  t.filed("A one-time 50% wealth tax on AI companies would benefit the public.", 0.5)
    .subclaims([["scb1", "It raises meaningful net revenue after avoidance and relocation."], ["scb2", "It does not materially slow AI investment or innovation."], ["scb3", "The proceeds are deployed to broad public benefit effectively."], ["scb4", "It is legally and constitutionally durable."]])
    .cast(jurors, { model: "gpt-4o", name: "The Contrarian" })
    .balance(jurors, { disclosure: "Jurors run on models from companies affected by this claim. Watch for reasoning that defends model-provider interests without evidence." })
    .evidenceReady(ev.map((e) => e.id));
  t.blindStart().thinking(allIds).votesCast(allIds).reveal([
    { juror_id: "S1", vote: 1, confidence: 0.7 }, { juror_id: "S10", vote: 1, confidence: 0.66 },
    { juror_id: "S3", vote: -1, confidence: 0.72 }, { juror_id: "S4", vote: -1, confidence: 0.7 },
    { juror_id: "S5", vote: 1, confidence: 0.55 }, { juror_id: "S6", vote: -1, confidence: 0.6 },
    { juror_id: "S7", vote: 0, confidence: 0.4 }, { juror_id: "S8", vote: 0, confidence: 0.42 },
    { juror_id: "S9", vote: 1, confidence: 0.64 }, { juror_id: "S12", vote: -1, confidence: 0.55 },
    { juror_id: "S2", vote: -1, confidence: 0.58 }, { juror_id: "S11", vote: 1, confidence: 0.5 },
  ]);
  t.consensus(0.05, "contested", 0.43, 0.2, [
    { subclaim_id: "scb1", score: -0.1, confidence: 0.4 }, { subclaim_id: "scb2", score: 0.05, confidence: 0.35 },
    { subclaim_id: "scb3", score: 0.2, confidence: 0.38 }, { subclaim_id: "scb4", score: -0.1, confidence: 0.34 },
  ]);
  // Round 1 — does it raise revenue?
  t.roundStart(1, "Sub-claim 1: does a one-time tax on stock value actually raise net revenue?");
  t.speaker("S3").claim("S3", "A 50% levy on unrealized stock value is largely paper — valuation drops and avoidance gut the net take.", "b-cl1", "scb1").factcheck("b-cl1", "supported", [cite("evb1", 0.80)]);
  t.speaker("S4").claim("S4", "And the marginal company restructures or redomiciles. Capital is the most mobile thing we have.", "b-cl2", "scb1").factcheck("b-cl2", "supported", [cite("evb2", 0.78)]);
  t.speaker("S1").claim("S1", "Norway captured oil rents into a sovereign fund — compute rents are obviously the same opportunity.", "b-cl3", "scb3", [{ id: "b-sp1", start: 38, end: 47 }]).bias("S1", "unsupported_certainty", "low", "'obviously the same' equates very different asset and mobility profiles", "b-sp1").factcheck("b-cl3", "partial", [cite("evb3", 0.82)], "SWF deployment can work, but oil is immobile and AI capital is not.");
  t.da("The Contrarian", "the emerging revenue skepticism", "You assume firms dodge — but a credible one-time, pre-announced levy is unavoidable by construction. Static-avoidance pessimism is its own bias.", []);
  t.bias("DA", "missing_context", "low", "Ignores that the cited windfall-tax record shows avoidance happening anyway.");
  t.shift("S7", "scb1", 0, -1, 0.62, 0.22, "On revenue specifically, the incidence and mobility evidence is decisive — net take is small.", [cite("evb1"), cite("evb2")]);
  t.consensus(-0.12, "leaning_false", 0.52, 0.42, [
    { subclaim_id: "scb1", score: -0.4, confidence: 0.62 }, { subclaim_id: "scb2", score: -0.05, confidence: 0.45 },
    { subclaim_id: "scb3", score: 0.1, confidence: 0.46 }, { subclaim_id: "scb4", score: -0.2, confidence: 0.44 },
  ]).roundEnd(1, false, false);
  // Round 2 — legality, history, and the real motive
  t.roundStart(2, "Sub-claims 3 & 4: deployment and legal durability; separate 'benefit the public' from 'curb power'.");
  t.speaker("S2").claim("S2", "From the 1980s windfall taxes onward, almost all underperformed forecasts and were repealed. The graveyard is large.", "b-cl4", "scb1").factcheck("b-cl4", "supported", [cite("evb4", 0.80)]);
  t.speaker("S11").claim("S11", "Legally it's fragile — direct-tax and takings challenges create real risk it never survives.", "b-cl5", "scb4").factcheck("b-cl5", "supported", [cite("evb5", 0.76)]);
  t.speaker("S9").claim("S9", "Maybe the point was never revenue. It's curbing dangerous concentration of capability — and that benefits the public.", "b-cl6", "scb3").factcheck("b-cl6", "partial", [], "A values claim about concentration; not evidence the tax raises funds or survives.");
  t.shift("S5", "scb1", 1, 0, 0.5, -0.05, "Conceding the revenue case is weak; I keep my worry about workers, not the mechanism.", [cite("evb1")]);
  t.shift("S1", "scb1", 1, -1, 0.64, -0.06, "On the actual claim — does THIS tax benefit the public — the revenue and legal evidence say no. I was wrong.", [cite("evb1"), cite("evb5")]);
  t.turning(2, "Vega, the lead proponent, concedes the revenue and legal case collapses — the 'yes' bloc shrinks to a values-based minority.", "majority_flip", ["S1"]);
  t.consensus(-0.38, "leaning_false", 0.62, 0.78, [
    { subclaim_id: "scb1", score: -0.55, confidence: 0.72 }, { subclaim_id: "scb2", score: -0.1, confidence: 0.5 },
    { subclaim_id: "scb3", score: 0.05, confidence: 0.5 }, { subclaim_id: "scb4", score: -0.45, confidence: 0.62 },
  ]).roundEnd(2, true, false);
  t.verdict({
    consensus: { score: -0.38, label: "leaning_false" },
    confidence: 0.62, ece: 0.07,
    takeaway: "As written — a one-time 50% tax on AI-company stock — the claim that it would benefit the public is weakly supported: it raises little net revenue, invites relocation, and faces serious legal risk. A real public-interest case exists for curbing concentration of capability, but that argues for a different instrument, not this one.",
    per_subclaim: [
      { subclaim_id: "scb1", verdict: "Meaningful net revenue — contradicted.", confidence: 0.72, citations: ["evb1", "evb2", "evb4"] },
      { subclaim_id: "scb2", verdict: "No material innovation slowdown — unresolved.", confidence: 0.5, citations: ["evb6"] },
      { subclaim_id: "scb3", verdict: "Effective public deployment — possible but not established for this tax.", confidence: 0.5, citations: ["evb3"] },
      { subclaim_id: "scb4", verdict: "Legally durable — doubtful.", confidence: 0.62, citations: ["evb5"] },
    ],
    minority_report: [
      { jurors: ["S9", "S11"], position: "Soto & Ito: concentration of AI capability is a genuine public harm; even if this tax is flawed, the public-benefit aim is sound and warrants a stronger instrument.", confidence: 0.6, citations: ["evb3"] },
      { jurors: ["S5"], position: "Reyes: whatever the mechanism, displaced workers have a real claim on AI gains.", confidence: 0.5, citations: [] },
    ],
    bias_flags: [{ type: "unsupported_certainty", count: 1 }, { type: "missing_context", count: 1 }],
    citations: ev.filter((e) => ["evb1", "evb2", "evb4", "evb5"].includes(e.id)).map((e) => ({ evidence_id: e.id, title: e.title, url: e.url, credibility: e.credibility })),
    user_comparison: { user_prior: 0.5, room_final: -0.38, moved: false },
  });
  t.closed();
  return t;
}

for (const t of [caseA(), caseB()]) {
  const fname = `case_${t.caseId}_tape.json`;
  writeFileSync(join(PUBLIC, fname), JSON.stringify({ tape_version: "1.0", case_id: t.caseId, title: t.title, note: "Generated by gen_tapes.mjs", evidence_catalog: t.evidence, events: t.events }, null, 2));
  console.log(`wrote ${fname}: ${t.events.length} events`);
}
