"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEventStream, StreamSource } from "@/lib/useEventStream";
import { API_BASE } from "@/lib/api";
import { MatrixRain, Crt, Panel, Chip, Button, SegBar, VectorDial, GlitchText, SidebarNav } from "@/components/hud";

const LABELS: Record<string, string> = {
  likely_true: "LIKELY_TRUE", leaning_true: "LEANING_TRUE", contested: "CONTESTED",
  leaning_false: "LEANING_FALSE", likely_false: "LIKELY_FALSE",
};
const ICON: Record<string, string> = { supported: "✔", unsupported: "✘", partial: "◐", pending: "…" };
const voteTone = (v?: number) => (v === 1 ? "green" : v === -1 ? "red" : v === 0 ? "blue" : undefined);
const voteWord = (v?: number) => (v === 1 ? "FOR" : v === -1 ? "AGAINST" : v === 0 ? "ABSTAIN" : "—");
const AXIS_HEX: Record<string, string> = {
  proponent: "#00ff41", opponent: "#ff5d56", affected: "#00daf3",
  methodologist: "#b600f8", ethicist: "#ffce5a", historian: "#7fecff",
};
const axisColor = (axis?: string) => AXIS_HEX[axis ?? ""] ?? "#aebfa8";

function buildSource(id: string, claim?: string, prior?: string): StreamSource {
  if (id === "new" && claim) return { mode: "live", apiBase: API_BASE, claim, userPrior: prior ? Number(prior) : 0 };
  if (id.startsWith("replay_")) return { mode: "replay", url: `/case_${id.split("_")[1]}_tape.json` };
  return { mode: "live", apiBase: API_BASE, caseId: id };
}

const PHASE: Record<string, string> = { setup: "EMPANELING", blind: "SEALED_BALLOT", debate: "IN_SESSION", verdict: "RESOLVED" };

export function NeuralRoom({ id, claim, prior }: { id: string; claim?: string; prior?: string }) {
  const source = useMemo(() => buildSource(id, claim, prior), [id, claim, prior]);
  const s = useEventStream(source);
  const st = s.state;
  const [showVerdict, setShowVerdict] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const con = st.consensus;
  const speaker = st.speaker ? st.jurorsBySlot[st.speaker] : undefined;

  // Auto-scroll the chat to the newest message.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [st.claims.length, st.daAttack]);

  return (
    <main className="scanlines" style={{ minHeight: "100vh", position: "relative" }}>
      <Crt />
      <MatrixRain opacity={0.1} />

      <header className="shell shell-wide room-top">
        <span className="h-md t-green">VERDICT_AI</span>
        <nav className="room-tabs">{["NODES", "DELIBERATION", "LOG", "ARCHIVE"].map((t) => <span key={t} className={`room-tab ${t === "DELIBERATION" ? "on" : ""}`}>{t}</span>)}</nav>
        <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {s.live ? <Chip tone={s.status === "streaming" ? "green" : s.status === "error" ? "red" : "blue"}>{s.status}</Chip> : <Chip tone="violet">replay</Chip>}
          <Link href="/" className="label" style={{ color: "var(--ink-variant)" }}>EXIT ✕</Link>
        </span>
      </header>

      <div className="shell shell-wide room-grid" style={{ position: "relative", zIndex: 1 }}>
        {/* left rail */}
        <Panel title="ROOT_CORE" style={{ alignSelf: "start" }}>
          <SidebarNav active="streams" items={[
            { id: "sensors", label: "Sensors", icon: "sensors" },
            { id: "vectors", label: "Vectors", icon: "hub" },
            { id: "streams", label: "Streams", icon: "stream" },
          ]} />
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-2)" }}>
            <div className="label" style={{ marginBottom: 8 }}>CASE</div>
            <div className="code-sm muted" style={{ wordBreak: "break-all" }}>{st.caseId || "—"}</div>
            <div className="label" style={{ margin: "12px 0 6px" }}>NODES</div>
            <div className="code-sm t-green">{st.jurors.length} / 12 ACTIVE</div>
          </div>
        </Panel>

        {/* CENTER — the live chat is the highlight */}
        <div className="stage">
          <div className="stage-claimbar">
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <Chip tone="blue">{PHASE[st.phase] ?? st.phase}</Chip>
              {st.round > 0 && st.phase === "debate" && <Chip>round {st.round}</Chip>}
              {st.turningPoint && <Chip tone="red">turning_point</Chip>}
            </div>
            <h1 className="h-lg">{st.claim ?? s.title ?? "AWAITING_CLAIM…"}</h1>
          </div>

          <Panel title="LIVE_DELIBERATION" accent="green" className="chatpanel"
            right={<span className="code-sm" style={{ color: speaker ? axisColor(speaker.axis) : "var(--muted)" }}>
              {speaker ? `◉ ${speaker.name.toUpperCase()} SPEAKING` : st.phase === "verdict" ? "◉ RESOLVED" : st.phase === "blind" ? "◉ SEALED BALLOT" : "◉ STANDBY"}
            </span>}>
            <div className="chatfeed" ref={feedRef}>
              {st.claims.length === 0 && (
                <div className="chat-empty">
                  <GlitchText anim>{PHASE[st.phase] ?? "SYNCING"}</GlitchText>
                  <div className="code-sm muted" style={{ marginTop: 10 }}>&gt; the floor is about to open…<span className="cursor" /></div>
                </div>
              )}
              {st.claims.map((c) => {
                const j = st.jurorsBySlot[c.juror_id];
                const col = axisColor(j?.axis);
                return (
                  <motion.div key={c.claim_ref} className="cmsg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ ["--c" as keyof CSSProperties]: col } as CSSProperties}>
                    <div className="cmsg-head">
                      <span className="cmsg-name">{j?.name ?? c.juror_id}</span>
                      {j?.model && <span className="cmsg-model">{j.model}</span>}
                      {j?.axis && <span className="cmsg-axis">{j.axis}</span>}
                      <span className={`cmsg-fc ${c.status}`}>{ICON[c.status]} {c.status}</span>
                    </div>
                    <div className="cmsg-text">{c.text}</div>
                    {c.citations.length > 0 && (
                      <div className="cmsg-cites">{c.citations.map((ci) => <span key={ci.evidence_id} className="cmsg-cite">📎 {st.evidence[ci.evidence_id]?.title?.slice(0, 30) ?? ci.evidence_id}</span>)}</div>
                    )}
                  </motion.div>
                );
              })}
              {st.daAttack && (
                <motion.div className="cmsg da" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="cmsg-head"><span className="cmsg-name" style={{ color: "var(--da)" }}>🔥 {st.daAttack.name}</span><span className="cmsg-axis" style={{ color: "var(--da)" }}>mandated dissent</span></div>
                  <div className="cmsg-text">{st.daAttack.argument}</div>
                </motion.div>
              )}
            </div>
          </Panel>
        </div>

        {/* right — telemetry */}
        <div className="room-side">
          <Panel title="CONSENSUS_RECORD">
            <div style={{ display: "flex", justifyContent: "center" }}>
              <VectorDial value={con?.score ?? 0} label={con ? (LABELS[con.label] ?? con.label.toUpperCase()) : "—"} sub={con ? `score ${con.score.toFixed(2)}` : "awaiting"} tone={con && con.score < -0.05 ? "red" : con && con.score > 0.05 ? "green" : "blue"} size={150} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
              <SegBar name="Confidence" value={con?.confidence ?? 0} tone="blue" />
              <SegBar name="Convergence" value={con?.convergence ?? 0} tone="violet" />
            </div>
          </Panel>

          <Panel title={`THE_COUNCIL // ${st.jurors.length}`}>
            <div className="council">
              {st.jurors.map((j) => {
                const v = st.votes[j.slot]?.vote;
                const sp = st.speaker === j.slot;
                return (
                  <div key={j.slot} className={`cmem ${sp ? "spk" : ""}`} title={`${j.name} · ${j.lens} · ${j.model}`}>
                    <span className="cdot" style={{ background: v !== undefined ? axisColor(j.axis) : "var(--muted)", boxShadow: v !== undefined ? `0 0 5px ${axisColor(j.axis)}` : "none" }} />
                    <span className="cname">{j.name}</span>
                    <span className={`cvote t-${voteTone(v) ?? "muted"}`}>{voteWord(v)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="TRANSPORT">
            <div className="transport">
              <Button ghost clip={false} onClick={s.playing ? s.pause : s.play}>{s.playing ? "❚❚" : "▶"}</Button>
              <Button ghost clip={false} onClick={s.step}>▶❚</Button>
              <Button ghost clip={false} onClick={s.restart}>{s.live ? "↺ new" : "↺"}</Button>
              <span className="code-sm muted" style={{ marginLeft: "auto" }}>{s.cursor}/{s.total}</span>
            </div>
            <input className="scrub" type="range" min={0} max={s.total} value={s.cursor} onChange={(e) => s.scrubTo(Number(e.target.value))} />
          </Panel>
        </div>
      </div>

      {/* verdict overlay */}
      {st.phase === "verdict" && st.verdict && showVerdict && (
        <div className="synth-bg" onClick={() => setShowVerdict(false)}>
          <div className="synth" onClick={(e) => e.stopPropagation()}>
            <div className="label" style={{ textAlign: "center", color: "var(--green)" }}>FINAL_EXECUTION_AUTHORIZED</div>
            <div style={{ textAlign: "center", margin: "14px 0 8px" }}>
              <span className="h-xl"><GlitchText anim>{LABELS[st.verdict.consensus.label] ?? st.verdict.consensus.label.toUpperCase()}</GlitchText></span>
            </div>
            <div className="label" style={{ textAlign: "center", marginBottom: 18 }}>
              CONSENSUS {(((st.verdict.consensus.score + 1) / 2) * 100).toFixed(1)}% · CONFIDENCE {(st.verdict.confidence * 100).toFixed(0)}% · ECE {st.verdict.ece.toFixed(2)}
            </div>
            <p className="lede" style={{ margin: "0 auto 18px", textAlign: "center" }}>{st.verdict.takeaway}</p>
            {st.verdict.minority_report.length > 0 && (
              <Panel title="MINORITY_REPORT" accent="violet" style={{ marginBottom: 18 }}>
                {st.verdict.minority_report.map((m, i) => <div key={i} className="code-sm" style={{ marginBottom: 8 }}><span className="t-violet">{m.jurors.map((j) => st.jurorsBySlot[j]?.name ?? j).join(", ")}:</span> {m.position}</div>)}
              </Panel>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Button ghost onClick={() => setShowVerdict(false)}>REVIEW_CHAMBER</Button>
              <Link href="/"><Button primary>RETURN_TO_GATEWAY</Button></Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .room-top { display: flex; align-items: center; gap: 18px; padding: 16px 24px; border-bottom: 1px solid var(--line); }
        .room-tabs { display: flex; gap: 16px; }
        .room-tab { font-size: 12px; letter-spacing: 0.12em; color: var(--muted); }
        .room-tab.on { color: var(--green); }
        .room-grid { display: grid; grid-template-columns: 200px 1fr 320px; gap: 16px; padding: 20px 24px 40px; align-items: start; }
        .stage { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .stage-claimbar { padding-bottom: 4px; }
        /* the chat is the hero of this page */
        .chatfeed { display: flex; flex-direction: column; gap: 14px; height: min(64vh, 620px); overflow-y: auto; padding-right: 8px; }
        .chat-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 30px; }
        .cmsg { border-left: 2px solid var(--c, var(--green)); background: rgba(255,255,255,0.015); padding: 12px 16px; }
        .cmsg.da { border-left-color: var(--da); background: rgba(255,122,60,0.06); }
        .cmsg-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 7px; }
        .cmsg-name { font-family: var(--font-display); font-weight: 700; font-size: 16px; color: var(--c, var(--green)); }
        .cmsg-model { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-variant); border: 1px solid var(--line-2); padding: 1px 7px; }
        .cmsg-axis { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
        .cmsg-fc { margin-left: auto; font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; }
        .cmsg-fc.supported { color: var(--green); } .cmsg-fc.unsupported { color: var(--red); } .cmsg-fc.partial { color: var(--amber); } .cmsg-fc.pending { color: var(--muted); }
        .cmsg-text { font-family: var(--font-display); font-weight: 500; font-size: 18px; line-height: 1.45; color: var(--ink); }
        .cmsg-cites { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
        .cmsg-cite { font-size: 11px; color: var(--ink-variant); border: 1px solid var(--line-2); padding: 2px 8px; }
        .room-side { display: flex; flex-direction: column; gap: 16px; align-self: start; }
        .council { display: flex; flex-direction: column; gap: 3px; max-height: 300px; overflow-y: auto; }
        .cmem { display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: center; font-size: 12px; padding: 5px 6px; border: 1px solid transparent; }
        .cmem.spk { border-color: var(--green); background: rgba(0,255,65,0.05); }
        .cdot { width: 8px; height: 8px; border-radius: 50%; }
        .cname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cvote { font-size: 10px; letter-spacing: 0.06em; }
        .transport { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .scrub { width: 100%; accent-color: var(--green); }
        .synth-bg { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); }
        .synth { width: min(820px, 96vw); max-height: 92vh; overflow: auto; background: var(--surface); border: 1px solid var(--green); box-shadow: 0 0 40px rgba(0,255,65,0.18); padding: 30px; }
        @media (max-width: 1080px) { .room-grid { grid-template-columns: 1fr; } .chatfeed { height: 56vh; } }
        @media (max-width: 640px) { .room-top { flex-wrap: wrap; gap: 10px; padding: 14px 16px; } .room-tabs { display: none; } .room-grid { padding: 16px; } }
      `}</style>
    </main>
  );
}
