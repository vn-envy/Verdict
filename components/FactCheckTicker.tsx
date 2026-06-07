"use client";

import { CaseState } from "@/lib/reducer";

const ICON: Record<string, string> = {
  supported: "✔",
  unsupported: "✘",
  partial: "◐",
  pending: "…",
};

export function FactCheckTicker({ state }: { state: CaseState }) {
  const rows = [...state.claims].reverse(); // newest first

  return (
    <div className="panel">
      <div className="panel-title">Live Fact-Check</div>
      <div className="ticker-rows">
        {rows.length === 0 && <div className="muted">No claims on the floor yet.</div>}
        {rows.map((c) => {
          const juror = state.jurorsBySlot[c.juror_id];
          return (
            <div key={c.claim_ref} className={`ticker-row ${c.status}`}>
              <span className="tick-icon">{ICON[c.status]}</span>
              <span className="tick-text">
                <strong>{juror?.name ?? c.juror_id}:</strong> {c.text}
              </span>
              <span className="tick-meta">
                {c.status.toUpperCase()}
                {c.citations.length > 0 && ` · ${c.citations.length} src`}
                {c.citations[0]?.credibility != null && ` · cred ${c.citations[0].credibility.toFixed(2)}`}
              </span>
              {c.note && <span className="tick-note">{c.note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
