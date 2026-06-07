"use client";

import { CaseState } from "@/lib/reducer";
import { CouncilMark } from "./CouncilMark";
import { Typewriter } from "./Typewriter";

export function SpeakerSpotlight({ state }: { state: CaseState }) {
  const juror = state.speaker ? state.jurorsBySlot[state.speaker] : undefined;
  const claim = [...state.claims].reverse().find((c) => c.juror_id === state.speaker);
  const flagsForSpeaker = state.flags.filter((f) => f.juror_id === state.speaker);

  if (!juror) {
    return (
      <div className="spotlight idle">
        <div className="muted">Waiting for the floor to open…</div>
      </div>
    );
  }

  return (
    <div className="spotlight">
      <div className="spotlight-head">
        <CouncilMark slot={juror.slot} size={64} speaking />
        <div className="chyron">
          <span className="chyron-kicker">ON THE FLOOR</span>
          <span className="chyron-name">{juror.name}</span>
          <div className="chyron-sub">
            <span className="chyron-lens">{juror.lens}</span>
            <span className="model-badge">{juror.model}</span>
            <span className={`axis-tag ${juror.axis}`}>{juror.axis}</span>
          </div>
        </div>
      </div>

      {claim ? (
        <div className="speech">
          <p>&ldquo;<Typewriter text={claim.text} id={claim.claim_ref} />&rdquo;</p>
          <div className="speech-meta">
            {claim.citations.map((c) => (
              <span key={c.evidence_id} className="cite-chip" title={state.evidence[c.evidence_id]?.title}>
                📎 {state.evidence[c.evidence_id]?.title?.slice(0, 28) ?? c.evidence_id}
              </span>
            ))}
            {claim.status === "unsupported" && <span className="flag unsupported">UNSUPPORTED</span>}
            {claim.status === "pending" && <span className="flag pending">checking…</span>}
          </div>
        </div>
      ) : (
        <div className="speech muted">{juror.voice}</div>
      )}

      {flagsForSpeaker.map((f, i) => (
        <div key={i} className={`bias-flag sev-${f.severity}`}>
          ⚠ {f.type.replace(/_/g, " ").toUpperCase()}
          {f.note ? <span className="bias-note"> — {f.note}</span> : null}
        </div>
      ))}
    </div>
  );
}
