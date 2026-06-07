"use client";

import { CaseState } from "@/lib/reducer";

export function VerdictCard({ state }: { state: CaseState }) {
  const v = state.verdict;
  if (!v) return null;
  const pct = ((v.consensus.score + 1) / 2) * 100;

  return (
    <div className="verdict">
      <div className="verdict-head">
        <span className="verdict-label">{v.consensus.label.replace(/_/g, " ").toUpperCase()}</span>
        <span className="verdict-conf">
          confidence {(v.confidence * 100).toFixed(0)}% · ECE {v.ece.toFixed(2)}
        </span>
      </div>

      <div className="meter-track big">
        <div className="meter-needle" style={{ left: `${pct}%` }} />
      </div>

      <p className="takeaway">{v.takeaway}</p>

      <div className="verdict-grid">
        <div>
          <div className="panel-title">Per sub-claim</div>
          {v.per_subclaim.map((p) => (
            <div key={p.subclaim_id} className="subverdict">
              <span className="muted">{p.subclaim_id}</span> {p.verdict}
              <span className="subconf"> ({(p.confidence * 100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>

        <div className="minority">
          <div className="panel-title">The Minority Report</div>
          {v.minority_report.map((m, i) => (
            <div key={i} className="minority-item">
              <strong>{m.jurors.map((j) => state.jurorsBySlot[j]?.name ?? j).join(", ")}:</strong> {m.position}
              <span className="subconf"> ({(m.confidence * 100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="verdict-foot">
        <span>⚠ {v.bias_flags.reduce((a, b) => a + b.count, 0)} framing flags</span>
        <span>📎 {v.citations.length} sources</span>
        {v.user_comparison && (
          <span className="you-vs-room">
            You voted {v.user_comparison.user_prior > 0 ? "TRUE" : "FALSE"} → room ended{" "}
            {v.user_comparison.room_final > 0 ? "TRUE" : "FALSE"}
          </span>
        )}
      </div>
    </div>
  );
}
