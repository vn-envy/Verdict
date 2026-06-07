"use client";

import { useState } from "react";
import { useEventStream, StreamSource } from "@/lib/useEventStream";
import { CaseHeader } from "./CaseHeader";
import { SpeakerSpotlight } from "./SpeakerSpotlight";
import { FactCheckTicker } from "./FactCheckTicker";
import { ConsensusMeter } from "./ConsensusMeter";
import { JuryBox } from "./JuryBox";
import { DevilsAdvocateCallout } from "./DevilsAdvocateCallout";
import { TurningPointBanner } from "./TurningPointBanner";
import { VerdictCard } from "./VerdictCard";
import { ColdOpen } from "./ColdOpen";
import { SealedBallot } from "./SealedBallot";

// The backend (FastAPI) base URL for live deliberations. Override via NEXT_PUBLIC_API_BASE.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const SOURCES: { id: string; label: string; source: StreamSource }[] = [
  { id: "C", label: "▶ Replay · C · Tariffs (hero)", source: { mode: "replay", url: "/case_C_tape.json" } },
  { id: "A", label: "▶ Replay · A · World Cup pricing", source: { mode: "replay", url: "/case_A_tape.json" } },
  { id: "B", label: "▶ Replay · B · AI wealth tax", source: { mode: "replay", url: "/case_B_tape.json" } },
  { id: "liveC", label: "🔴 Live · C · Tariffs", source: { mode: "live", apiBase: API_BASE, caseKey: "C" } },
  { id: "liveA", label: "🔴 Live · A · World Cup pricing", source: { mode: "live", apiBase: API_BASE, caseKey: "A" } },
  { id: "liveB", label: "🔴 Live · B · AI wealth tax", source: { mode: "live", apiBase: API_BASE, caseKey: "B" } },
];

const STATUS_LABEL: Record<string, string> = {
  connecting: "● connecting…",
  streaming: "● streaming",
  done: "● complete",
  error: "● backend offline",
};

export function FloorScreen() {
  const [sel, setSel] = useState(SOURCES[0].id);
  const source = (SOURCES.find((x) => x.id === sel) ?? SOURCES[0]).source;
  const s = useEventStream(source);
  const { state } = s;

  return (
    <main className="floor">
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />

      <div className="masthead">
        <span className="live">
          <span className="live-dot" /> LIVE
        </span>
        <span className="brand">
          VERDICT
          <span className="brand-sub">12 Angry Agents · unbiased by construction</span>
        </span>
        <span className="masthead-right">
          {state.phase === "verdict" ? "VERDICT IN" : state.round > 0 ? `ROUND ${state.round}` : "EMPANELING"}
        </span>
      </div>

      <div className="transport">
        <select className="case-select" value={sel} onChange={(e) => setSel(e.target.value)}>
          {SOURCES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button onClick={s.playing ? s.pause : s.play}>{s.playing ? "⏸ Pause" : "▶ Play"}</button>
        <button onClick={s.step}>⏭ Step</button>
        <button onClick={s.restart}>{s.live ? "↺ New run" : "↺ Restart"}</button>
        {s.live && <span className={`stream-status ${s.status}`}>{STATUS_LABEL[s.status] ?? ""}</span>}
        <span className="spacer" />
        <label>
          speed
          <select value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={3}>3×</option>
          </select>
        </label>
        <input
          className="scrub"
          type="range"
          min={0}
          max={s.total}
          value={s.cursor}
          onChange={(e) => s.scrubTo(Number(e.target.value))}
        />
        <span className="muted">
          {s.cursor}/{s.total}
        </span>
      </div>

      <CaseHeader state={state} />
      <TurningPointBanner state={state} />

      {state.balance && (
        <div className={`balance-badge ${state.balance.passed ? "ok" : "fail"}`}>
          {state.balance.passed ? "✓ Panel certified balanced" : "⚠ Panel fell back to default"}
          <span className="muted"> · mean prior {state.balance.mean_stance_prior.toFixed(2)}</span>
          {state.balance.notes && <span className="muted"> · {state.balance.notes}</span>}
        </div>
      )}

      {state.panelDisclosure && <div className="disclosure">⚖ {state.panelDisclosure}</div>}

      {state.phase === "verdict" ? (
        <VerdictCard state={state} />
      ) : state.phase === "setup" ? (
        <ColdOpen state={state} />
      ) : state.phase === "blind" ? (
        <SealedBallot state={state} />
      ) : (
        <div className="floor-grid">
          <div className="floor-main">
            <SpeakerSpotlight state={state} />
            <DevilsAdvocateCallout attack={state.daAttack} />
            <FactCheckTicker state={state} />
          </div>
          <aside className="floor-side">
            <ConsensusMeter consensus={state.consensus} />
            <JuryBox state={state} />
            {state.userPrior != null && (
              <div className="panel">
                <div className="panel-title">Your Vote</div>
                <div className="user-vote">{state.userPrior > 0 ? "TRUE" : "FALSE"} <span className="muted">(locked)</span></div>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
