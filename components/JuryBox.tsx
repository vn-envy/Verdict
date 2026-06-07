"use client";

import { CaseState } from "@/lib/reducer";
import { Avatar } from "./Avatar";

function voteClass(v?: number) {
  if (v === 1) return "yes";
  if (v === -1) return "no";
  if (v === 0) return "abstain";
  return "unknown";
}

export function JuryBox({ state }: { state: CaseState }) {
  const moverId = state.lastShift?.juror_id;

  return (
    <div className="panel">
      <div className="panel-title">The Panel</div>
      <div className="jury-grid">
        {state.jurors.map((j) => {
          const v = state.votes[j.slot]?.vote;
          const conf = state.votes[j.slot]?.confidence;
          const isSpeaker = state.speaker === j.slot;
          const isMover = moverId === j.slot;
          // Identity sits in shadow until they vote or take the floor.
          const known = v !== undefined || isSpeaker;
          return (
            <div
              key={j.slot}
              className={`juror ${voteClass(v)} ${isSpeaker ? "speaking" : ""} ${isMover ? "moved" : ""}`}
              title={`${j.name} · ${j.lens}\n${j.model} · ${j.disposition}${
                conf != null ? `\nvote ${v} @ ${(conf * 100).toFixed(0)}%` : ""
              }`}
            >
              <Avatar name={j.name} axis={j.axis} size={40} speaking={isSpeaker} mystery={!known} />
              <span className="juror-meta">
                <span className="juror-name">{j.name}</span>
                {known ? (
                  <span className="vote-track" title={v === 1 ? "for" : v === -1 ? "against" : "undecided"}>
                    <span className={`vote-marker ${voteClass(v)}`} style={{ left: `${((((v ?? 0) as number) + 1) / 2) * 100}%` }} />
                  </span>
                ) : (
                  <span className="juror-vote-tag">sealed</span>
                )}
              </span>
            </div>
          );
        })}
        {state.da && (
          <div className="juror da" title={`${state.da.name} · Devil's Advocate\n${state.da.model}`}>
            <Avatar name={state.da.name} axis="da" size={40} />
            <span className="juror-meta">
              <span className="juror-name">🔥 {state.da.name}</span>
              <span className="juror-vote-tag">dissent</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
