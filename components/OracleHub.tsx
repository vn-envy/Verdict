"use client";

import { motion } from "framer-motion";
import { CaseState } from "@/lib/reducer";
import { CouncilMark } from "./CouncilMark";

// The Oracle Hub (design.md §"Oracle Hub"): the 12 council members orbit a central,
// pulsing "eye" that holds the claim under consideration. Staggered spring entrance.
export function OracleHub({ state }: { state: CaseState }) {
  const jurors = state.jurors;
  const n = Math.max(jurors.length, 1);
  const radius = 40; // % of the square hub — matches the .hub-ring.r1 orbit ring

  return (
    <div>
      <div className="hub">
        <div className="hub-ring r1" aria-hidden />
        <div className="hub-ring r2" aria-hidden />
        <div className="hub-ring r3" aria-hidden />

        <div className="hub-center">
          <div className="hub-kicker">THE ORACLE CONVENES</div>
          <div className="hub-eye" aria-hidden />
          <div className="hub-claim">{state.claim ?? "Reading the claim…"}</div>
        </div>

        {jurors.map((j, i) => {
          const ang = (-90 + (i * 360) / n) * (Math.PI / 180);
          const left = 50 + radius * Math.cos(ang);
          const top = 50 + radius * Math.sin(ang);
          return (
            <motion.div
              key={j.slot}
              className="hub-node"
              style={{ left: `${left}%`, top: `${top}%` }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.06, type: "spring", stiffness: 150, damping: 15 }}
            >
              <div className="hub-tip">
                <div className="tip-axis">{j.axis}</div>
                {j.lens} · <span className="muted">{j.model}</span>
              </div>
              <CouncilMark slot={j.slot} size={46} />
              <div className="hub-name">{j.name}</div>
            </motion.div>
          );
        })}
      </div>

      {jurors.length === 0 && <p className="muted" style={{ textAlign: "center" }}>Empaneling the council…</p>}
      {state.da && (
        <div className="muted" style={{ textAlign: "center", marginTop: 16 }}>
          + <span style={{ color: "var(--da)", fontWeight: 600 }}>🔥 {state.da.name}</span> — mandated Devil&rsquo;s
          Advocate ({state.da.model})
        </div>
      )}
    </div>
  );
}
