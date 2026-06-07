"use client";

import { CaseState } from "@/lib/reducer";

export function TurningPointBanner({ state }: { state: CaseState }) {
  const tp = state.turningPoint;
  if (!tp) return null;
  const movers = tp.movers.map((m) => state.jurorsBySlot[m]?.name ?? m).join(", ");
  // key={tp.description} remounts on a NEW turning point, so the sweep/flash fire once.
  return (
    <div className="turning-banner" key={tp.description}>
      <span className="tp-flash" aria-hidden />
      <span className="tp-sweep" aria-hidden />
      <span className="tp-badge">★ TURNING POINT</span>
      <span className="tp-text">{tp.description}</span>
      <span className="tp-movers">moved: {movers}</span>
    </div>
  );
}
