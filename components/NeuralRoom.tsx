"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEventStream, StreamSource } from "@/lib/useEventStream";
import { API_BASE } from "@/lib/api";
import { Crt, DigitalRain, Panel, Chip, Button, SegBar, VectorDial, GlitchText, SidebarNav } from "@/components/hud";

const LABELS: Record<string, string> = {
  likely_true: "LIKELY_TRUE", leaning_true: "LEANING_TRUE", contested: "CONTESTED",
  leaning_false: "LEANING_FALSE", likely_false: "LIKELY_FALSE",
};
const ICON: Record<string, string> = { supported: "✔", unsupported: "✘", partial: "◐", pending: "…" };
const voteTone = (v?: number) => (v === 1 ? "green" : v === -1 ? "red" : v === 0 ? "blue" : undefined);
const voteWord = (v?: number) => (v === 1 ? "FOR" : v === -1 ? "AGAINST" : v === 0 ? "ABSTAIN" : "—");

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

  const con = st.consensus;
  const transcript = st.claims.slice(-12);

  return (
    <main className="scanlines" style={{ minHeight: "100vh", position: "relative" }}>
      <Crt />
      <DigitalRain opacity={0.32} fixed />

      {/* top bar */}
      <header className="shell shell-wide room-top">
        <span className="h-md t-green">VERDICT_AI</span>
        <nav className="room-tabs">
          {["NODES", "DELIBERATION", "LOG", "ARCHIVE"].map((t) => (
            <span key={t} className={`room-tab ${t === "DELIBERATION" ? "on" : ""}`}>{t}</span>
          ))}
        </nav>
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
          </div>
        </Panel>

        {/* center */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <Chip tone="blue">{PHASE[st.phase] ?? st.phase}</Chip>
              {st.round > 0 && st.phase === "debate" && <Chip>round {st.round}</Chip>}
              {st.turningPoint && <Chip tone="red">turning_point</Chip>}
            </div>
            <h1 className="h-lg">{st.claim ?? s.title ?? "AWAITING_CLAIM…"}</h1>
          </div>

          <Panel title="DELIBERATION_SYNC" accent="green">
            <div className="sync">
              <GlitchText anim={st.phase === "debate"}>
                {st.phase === "debate" && st.speaker
                  ? (st.jurorsBySlot[st.speaker]?.name?.toUpperCase() ?? "AGENT")
                  : st.phase === "verdict" ? "RESOLVED"
                  : st.phase === "blind" ? "SEALED_BALLOT"
                  : st.phase === "setup" ? "EMPANELING"
                  : "SYNCING"}
              </GlitchText>
              <span className="cursor" />
            </div>
            <div className="transcript">
              {transcript.length === 0 && <div className="code-sm muted">&gt; awaiting floor activity…</div>}
              {transcript.map((c) => (
                <div key={c.claim_ref} className="tline">
                  <span className={`tstat ${c.status}`}>{ICON[c.status]}</span>
                  <span className="tname">{st.jurorsBySlot[c.juror_id]?.name ?? c.juror_id}</span>
                  <span className="ttext">{c.text}</span>
                </div>
              ))}
            </div>
          </Panel>

          {st.speaker && st.jurorsBySlot[st.speaker] && (() => {
            const j = st.jurorsBySlot[st.speaker];
            const vv = st.votes[st.speaker!];
            const logs = st.claims.filter((c) => c.juror_id === st.speaker).slice(-3);
            return (
              <Panel title={`AGENT_FOCUS // ${(j.axis ?? "").toUpperCase()}`} accent="green">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="h-md">{j.name}</span>
                  <Chip tone="green">{j.model}</Chip>
                  <Chip>{j.lens}</Chip>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
                  <SegBar name="Conviction" value={vv?.confidence ?? 0.4} />
                  <SegBar name="Stance" value={vv ? (vv.vote + 1) / 2 : 0.5} tone="blue" format={() => voteWord(vv?.vote)} />
                </div>
                <div className="agent-log">
                  {logs.length === 0 && <div className="code-sm muted">&gt; no statements logged…</div>}
                  {logs.map((c) => (
                    <div key={c.claim_ref} className="code-sm" style={{ marginBottom: 6 }}>
                      <span className="t-green">&gt;</span> {c.text}
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })()}

          {st.daAttack && (
            <Panel title="MANDATED_DISSENT" accent="violet">
              <div className="t-violet" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>🔥 {st.daAttack.name}</div>
              <p className="code-sm" style={{ marginTop: 8 }}>&ldquo;{st.daAttack.argument}&rdquo;</p>
            </Panel>
          )}
        </div>

        {/* right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignSelf: "start" }}>
          <Panel title="CONSENSUS_RECORD" accent={con && con.score < -0.05 ? undefined : undefined}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <VectorDial value={con?.score ?? 0} label={con ? (LABELS[con.label] ?? con.label.toUpperCase()) : "—"}
                sub={con ? `score ${con.score.toFixed(2)}` : "awaiting"} tone={con && con.score < -0.05 ? "red" : con && con.score > 0.05 ? "green" : "blue"} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <SegBar name="Confidence" value={con?.confidence ?? 0} tone="blue" />
              <SegBar name="Convergence" value={con?.convergence ?? 0} tone="violet" />
            </div>
          </Panel>

          <Panel title={`THE_COUNCIL // ${st.jurors.length}`}>
            <div className="council">
              {st.jurors.map((j) => {
                const v = st.votes[j.slot]?.vote;
                const speaking = st.speaker === j.slot;
                return (
                  <div key={j.slot} className={`cmem ${speaking ? "spk" : ""}`} title={`${j.name} · ${j.lens} · ${j.model}`}>
                    <span className={`cdot ${voteTone(v) ?? ""}`} />
                    <span className="cname">{j.name}</span>
                    <span className={`cvote t-${voteTone(v) ?? "muted"}`}>{voteWord(v)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* transport */}
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
                {st.verdict.minority_report.map((m, i) => (
                  <div key={i} className="code-sm" style={{ marginBottom: 8 }}>
                    <span className="t-violet">{m.jurors.map((j) => st.jurorsBySlot[j]?.name ?? j).join(", ")}:</span> {m.position}
                  </div>
                ))}
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
        .room-top { display: flex; align-items: center; gap: 18px; padding: 18px 24px; border-bottom: 1px solid var(--line); }
        .room-tabs { display: flex; gap: 16px; }
        .room-tab { font-size: 12px; letter-spacing: 0.12em; color: var(--muted); cursor: default; }
        .room-tab.on { color: var(--green); }
        .room-grid { display: grid; grid-template-columns: 210px 1fr 340px; gap: 16px; padding: 22px 24px 80px; }
        .sync { text-align: center; padding: 26px 0; font-family: var(--font-display); font-weight: 700; font-size: 30px; border: 1px solid var(--line-2); background: radial-gradient(circle at center, rgba(0,255,65,0.05), transparent 70%); margin-bottom: 16px; }
        .transcript { display: flex; flex-direction: column; gap: 7px; max-height: 320px; overflow: auto; }
        .tline { display: grid; grid-template-columns: 16px auto 1fr; gap: 8px; align-items: baseline; font-size: 13px; }
        .tstat { font-weight: 800; }
        .tstat.supported { color: var(--green); } .tstat.unsupported { color: var(--red); } .tstat.partial { color: var(--amber); } .tstat.pending { color: var(--muted); }
        .tname { color: var(--blue); font-weight: 600; white-space: nowrap; }
        .ttext { color: var(--ink-variant); min-width: 0; }
        .council { display: flex; flex-direction: column; gap: 4px; }
        .cmem { display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: center; font-size: 12px; padding: 5px 6px; border: 1px solid transparent; }
        .cmem.spk { border-color: var(--green); background: rgba(0,255,65,0.05); }
        .cdot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
        .cdot.green { background: var(--green); box-shadow: 0 0 5px var(--green); }
        .cdot.red { background: var(--red); box-shadow: 0 0 5px var(--red); }
        .cdot.blue { background: var(--blue); box-shadow: 0 0 5px var(--blue); }
        .cname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cvote { font-size: 10px; letter-spacing: 0.06em; }
        .transport { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .scrub { width: 100%; accent-color: var(--green); }
        .synth-bg { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,0.78); backdrop-filter: blur(8px); }
        .synth { width: min(820px, 96vw); max-height: 92vh; overflow: auto; background: var(--surface); border: 1px solid var(--green); box-shadow: 0 0 40px rgba(0,255,65,0.18); padding: 30px; }
        @media (max-width: 1024px) { .room-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .room-top { flex-wrap: wrap; gap: 10px; padding: 14px 16px; } .room-tabs { display: none; } .room-grid { padding: 16px; } }
      `}</style>
    </main>
  );
}
