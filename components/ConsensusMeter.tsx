"use client";

import { ConsensusUpdate } from "@/lib/events";

const LABELS: Record<string, string> = {
  likely_true: "LIKELY TRUE",
  leaning_true: "LEANING TRUE",
  contested: "CONTESTED",
  leaning_false: "LEANING FALSE",
  likely_false: "LIKELY FALSE",
};

export function ConsensusMeter({ consensus }: { consensus?: ConsensusUpdate }) {
  // score -1..1 → 0..100 (left = FALSE, right = TRUE)
  const pct = consensus ? ((consensus.score + 1) / 2) * 100 : 50;
  const label = consensus ? LABELS[consensus.label] ?? consensus.label.toUpperCase() : "—";

  return (
    <div className="panel">
      <div className="panel-title">Consensus</div>
      <div className="meter-label">{label}</div>
      <div className="meter-track">
        <div className="meter-tick" />
        <div className="meter-needle" style={{ left: `${pct}%` }} />
      </div>
      <div className="meter-ends">
        <span>FALSE</span>
        <span>TRUE</span>
      </div>
      {consensus && (
        <div className="meter-stats">
          <span>confidence {(consensus.confidence * 100).toFixed(0)}%</span>
          <div className="conv-bar">
            <div className="conv-fill" style={{ width: `${consensus.convergence * 100}%` }} />
          </div>
          <span className="muted">convergence {(consensus.convergence * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
