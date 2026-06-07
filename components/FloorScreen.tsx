"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useEventStream, StreamSource } from "@/lib/useEventStream";
import { CaseHeader } from "./CaseHeader";
import { SpeakerSpotlight } from "./SpeakerSpotlight";
import { FactCheckTicker } from "./FactCheckTicker";
import { ConsensusMeter } from "./ConsensusMeter";
import { CouncilRail } from "./CouncilRail";
import { Transcript } from "./Transcript";
import { DevilsAdvocateCallout } from "./DevilsAdvocateCallout";
import { TurningPointBanner } from "./TurningPointBanner";
import { SynthesisModal } from "./SynthesisModal";
import { OracleHub } from "./OracleHub";
import { SealedBallot } from "./SealedBallot";
import { ThemeToggle } from "./ThemeToggle";

// The backend (FastAPI) base URL for live deliberations. Defaults to the deployed Azure
// Container App; override via NEXT_PUBLIC_API_BASE for local dev (e.g. http://localhost:8000).
// `||` (not `??`) so an empty build-arg still falls back to the live API rather than same-origin.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://ca-api-taaq4xfj2gl.mangofield-bb2f9c8d.eastus2.azurecontainerapps.io";

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

const PHASE_LABEL: Record<string, string> = {
  setup: "EMPANELING",
  blind: "SEALED BALLOT",
  debate: "IN SESSION",
  verdict: "SYNTHESIS",
};

export function FloorScreen() {
  const [sel, setSel] = useState(SOURCES[0].id);
  const source = (SOURCES.find((x) => x.id === sel) ?? SOURCES[0]).source;
  const s = useEventStream(source);
  const { state } = s;

  // The Final Synthesis modal opens when the verdict lands; the user can dismiss it to
  // review the chamber, and it re-opens for a new case/verdict.
  const [showSynthesis, setShowSynthesis] = useState(false);
  useEffect(() => {
    if (state.phase === "verdict" && state.verdict) setShowSynthesis(true);
  }, [state.phase, state.verdict]);
  useEffect(() => {
    setShowSynthesis(false);
  }, [sel, s.cursor === 0]);

  return (
    <main className="app">
      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />

      <div className="masthead">
        {s.live ? (
          <span className="live"><span className="live-dot" /> LIVE</span>
        ) : (
          <span className="live" style={{ color: "var(--muted)" }}>◷ REPLAY</span>
        )}
        <span className="brand">
          VERDICT
          <span className="brand-sub">The Oracle · Council of 12</span>
        </span>
        <span className="masthead-spacer" />
        <span className="masthead-right">{PHASE_LABEL[state.phase] ?? ""}{state.round > 0 && state.phase === "debate" ? ` · ROUND ${state.round}` : ""}</span>
        <ThemeToggle />
      </div>

      <div className="transport">
        <select className="case-select" value={sel} onChange={(e) => setSel(e.target.value)}>
          {SOURCES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
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
        <input className="scrub" type="range" min={0} max={s.total} value={s.cursor}
          onChange={(e) => s.scrubTo(Number(e.target.value))} />
        <span className="muted">{s.cursor}/{s.total}</span>
      </div>

      {state.phase !== "setup" && <CaseHeader state={state} />}
      {state.phase === "debate" && <TurningPointBanner state={state} />}

      {state.balance && (
        <div className={`balance-badge ${state.balance.passed ? "ok" : "fail"}`}>
          {state.balance.passed ? "✓ Council certified balanced" : "⚠ Council fell back to default"}
          <span className="muted"> · mean prior {state.balance.mean_stance_prior.toFixed(2)}</span>
          {state.balance.notes && <span className="muted"> · {state.balance.notes}</span>}
        </div>
      )}
      {state.panelDisclosure && <div className="disclosure">⚖ {state.panelDisclosure}</div>}

      {state.phase === "setup" ? (
        <OracleHub state={state} />
      ) : state.phase === "blind" ? (
        <SealedBallot state={state} />
      ) : (
        <div className="chamber">
          <CouncilRail state={state} />
          <div className="stage">
            <SpeakerSpotlight state={state} />
            <DevilsAdvocateCallout attack={state.daAttack} />
            <Transcript state={state} />
          </div>
          <div className="col">
            <ConsensusMeter consensus={state.consensus} />
            <FactCheckTicker state={state} />
            {state.userPrior != null && (
              <div className="panel">
                <div className="panel-title">Your Vote</div>
                <div className="user-vote">
                  {state.userPrior > 0 ? "TRUE" : "FALSE"} <span className="muted">(locked)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSynthesis && state.verdict && (
          <SynthesisModal state={state} onClose={() => setShowSynthesis(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
