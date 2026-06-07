"use client";

import { DevilsAdvocateAttack } from "@/lib/events";

export function DevilsAdvocateCallout({ attack }: { attack?: DevilsAdvocateAttack }) {
  if (!attack) return null;
  return (
    <div className="da-callout">
      <div className="da-head">
        🔥 {attack.name}
        <span className="da-badge">MANDATED DISSENT</span>
      </div>
      <div className="da-target">attacking: {attack.target_consensus}</div>
      <p className="da-arg">&ldquo;{attack.argument}&rdquo;</p>
    </div>
  );
}
