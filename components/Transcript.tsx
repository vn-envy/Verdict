"use client";

import { CSSProperties } from "react";
import { CaseState } from "@/lib/reducer";
import { identityForSlot } from "@/lib/council";
import { CouncilMark } from "./CouncilMark";

// The Live Transcript (design.md §"Debate Chamber"): messages slide in, color-coded per
// member by their council identity color.
export function Transcript({ state }: { state: CaseState }) {
  const rows = state.claims.slice(-14);
  return (
    <div className="panel">
      <div className="panel-title">Transcript</div>
      <div className="transcript">
        {rows.length === 0 && <div className="muted">The floor is quiet…</div>}
        {rows.map((c) => {
          const j = state.jurorsBySlot[c.juror_id];
          const color = identityForSlot(c.juror_id).color;
          return (
            <div key={c.claim_ref} className="msg" style={{ ["--mark" as keyof CSSProperties]: color } as CSSProperties}>
              <CouncilMark slot={c.juror_id} size={30} />
              <div className="msg-body">
                <span className="msg-name">
                  {j?.name ?? c.juror_id}
                  <span className={`msg-tag ${c.status}`}>· {c.status}</span>
                </span>
                <div className="msg-text">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
