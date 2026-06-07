"use client";

import { CaseState } from "@/lib/reducer";

function subStatus(state: CaseState, id: string): string {
  const s = state.consensus?.per_subclaim.find((p) => p.subclaim_id === id);
  if (!s) return "open";
  if (s.confidence < 0.5) return "contested";
  return s.score < 0 ? "false" : "true";
}

const MARK: Record<string, string> = { open: "○", contested: "◐", true: "✔", false: "✘" };

export function CaseHeader({ state }: { state: CaseState }) {
  return (
    <header className="case-header">
      <div className="case-top">
        <span className="case-id">CASE {state.caseId || "—"}</span>
        <span className="round-pill">
          {state.phase === "verdict"
            ? "VERDICT"
            : state.phase === "blind"
            ? "SEALED BALLOT"
            : state.round > 0
            ? `Round ${state.round}`
            : "Empaneling"}
        </span>
      </div>
      <h1 className="claim">{state.claim ?? "…"}</h1>
      <div className="subclaims">
        {state.subclaims.map((sc) => {
          const st = subStatus(state, sc.id);
          return (
            <span key={sc.id} className={`subclaim ${st}`} title={sc.text}>
              {MARK[st]} {sc.text}
            </span>
          );
        })}
      </div>
    </header>
  );
}
