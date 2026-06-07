"use client";

import { CaseState } from "@/lib/reducer";
import { Avatar } from "./Avatar";

// Act: The Docket. Shown while the panel is being empaneled (phase "setup"
// before the blind round). Seats fill as panel.cast lands; each juror wears
// its real model badge — heterogeneity made visible.
export function ColdOpen({ state }: { state: CaseState }) {
  return (
    <section className="coldopen">
      <div className="docket-stamp">THE DOCKET</div>
      <p className="docket-sub">Empaneling a balanced jury for this case…</p>

      <div className="seats">
        {state.jurors.length === 0 && <div className="muted">Reading the claim…</div>}
        {state.jurors.map((j, i) => (
          <div key={j.slot} className={`seat axis-${j.axis}`} style={{ animationDelay: `${i * 70}ms` }}>
            <div className="seat-top">
              <Avatar name={j.name} axis={j.axis} size={46} />
              <div>
                <div className="seat-name">{j.name}</div>
                <div className="seat-lens">{j.lens}</div>
              </div>
            </div>
            <div className="seat-badges">
              <span className="model-badge">{j.model}</span>
              <span className={`axis-tag ${j.axis}`}>{j.axis}</span>
            </div>
            <div className="seat-q">&ldquo;{j.opening_question}&rdquo;</div>
          </div>
        ))}
        {state.da && (
          <div className="seat da-seat" style={{ animationDelay: `${state.jurors.length * 70}ms` }}>
            <div className="seat-top">
              <Avatar name={state.da.name} axis="da" size={46} />
              <div>
                <div className="seat-name">🔥 {state.da.name}</div>
                <div className="seat-lens">Devil&rsquo;s Advocate</div>
              </div>
            </div>
            <div className="seat-badges">
              <span className="model-badge">{state.da.model}</span>
              <span className="axis-tag">mandated dissent</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
