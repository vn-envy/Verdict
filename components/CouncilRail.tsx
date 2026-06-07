"use client";

import { CaseState } from "@/lib/reducer";
import { voteToken } from "@/lib/council";
import { CouncilMark } from "./CouncilMark";

// The Council Sidebar (design.md §"Debate Chamber"): a vertical status rail tracking all
// 12 members — who is speaking, who is observing, and how each currently stands.
export function CouncilRail({ state }: { state: CaseState }) {
  const moverId = state.lastShift?.juror_id;

  return (
    <div className="panel rail">
      <div className="panel-title">The Council</div>
      <div className="rail-list">
        {state.jurors.map((j) => {
          const v = state.votes[j.slot]?.vote;
          const isSpeaker = state.speaker === j.slot;
          const known = v !== undefined || isSpeaker;
          const vt = voteToken(v);
          const status = isSpeaker
            ? "speaking"
            : v === 1 ? "for" : v === -1 ? "against" : v === 0 ? "undecided" : "observing";
          return (
            <div
              key={j.slot}
              className={`rail-item ${isSpeaker ? "active" : ""} ${moverId === j.slot ? "moved" : ""}`}
              title={`${j.name} · ${j.lens}\n${j.model} · ${j.disposition}`}
            >
              <CouncilMark slot={j.slot} size={30} speaking={isSpeaker} sealed={!known} vote={known ? v : undefined} />
              <span className="rail-meta">
                <span className="rail-name">{j.name}</span>
                <span className={`rail-status ${isSpeaker ? "speaking" : vt}`}>{status}</span>
              </span>
              {known && !isSpeaker && <span className={`rail-dot ${vt}`} aria-hidden />}
            </div>
          );
        })}
        {state.da && (
          <div className="rail-item da" title={`${state.da.name} · Devil's Advocate · ${state.da.model}`}>
            <CouncilMark da size={30} />
            <span className="rail-meta">
              <span className="rail-name">🔥 {state.da.name}</span>
              <span className="rail-status">dissent</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
