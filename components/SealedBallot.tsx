"use client";

import { CaseState } from "@/lib/reducer";
import { Avatar } from "./Avatar";

// Act 1: The Sealed Ballot (blind round = anti-anchoring, dramatized).
// Identities sealed in shadow while jurors reason alone; the reveal lights them up.
export function SealedBallot({ state }: { state: CaseState }) {
  const revealed = state.blindRevealed;

  return (
    <section className="ballot">
      <div className="ballot-head">
        <h2>{revealed ? "The Sealed Ballot — opened" : "The Sealed Ballot"}</h2>
        <p className="muted">
          {revealed
            ? "Where everyone started — before anyone influenced anyone."
            : "Twelve minds, twelve sealed booths. No one sees another's verdict yet."}
        </p>
      </div>

      {revealed && (
        <div className="tally">
          <span className="tally-yes">▲ {state.jurors.filter((j) => state.votes[j.slot]?.vote === 1).length} FOR</span>
          <span className="tally-no">▼ {state.jurors.filter((j) => state.votes[j.slot]?.vote === -1).length} AGAINST</span>
          <span className="tally-abs">◇ {state.jurors.filter((j) => state.votes[j.slot]?.vote === 0).length} UNDECIDED</span>
        </div>
      )}

      <div className="booths">
        {state.jurors.map((j) => {
          const v = state.votes[j.slot]?.vote;
          const conf = state.votes[j.slot]?.confidence;
          const thinking = state.thinking.includes(j.slot);
          const sealed = state.sealed.includes(j.slot);
          return (
            <div
              key={j.slot}
              className={`booth ${revealed ? (v === 1 ? "yes" : v === -1 ? "no" : "abstain") : sealed ? "sealed" : thinking ? "thinking" : ""}`}
            >
              <Avatar name={j.name} axis={j.axis} size={48} mystery={!revealed} />
              <div className="booth-info">
                <div className="booth-name">{revealed ? j.name : "Juror sealed"}</div>
                {revealed ? (
                  <div className="booth-vote">
                    {v === 1 ? "FOR" : v === -1 ? "AGAINST" : "UNDECIDED"}
                    {conf != null && <span className="booth-conf"> · {(conf * 100).toFixed(0)}%</span>}
                  </div>
                ) : (
                  <div className="booth-status">{sealed ? "🔒 vote sealed" : thinking ? "deliberating…" : "—"}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
