"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MatrixRain, Crt, Chip, GlitchText, SegBar } from "@/components/hud";
import { TOPICS } from "@/lib/topics";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.55, ease: "easeOut" },
} as const;

const WARP_CHARS = "アカサタナハマヤラワABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

export default function Gateway() {
  const router = useRouter();
  const warpRef = useRef<HTMLCanvasElement>(null);
  const [warp, setWarp] = useState<string | null>(null);
  const ticker = TOPICS.concat(TOPICS);

  // "Enter the Matrix" wormhole: accelerate the rain, then route.
  useEffect(() => {
    if (!warp) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { const t = setTimeout(() => router.push(warp), 120); return () => clearTimeout(t); }
    const canvas = warpRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const fs = 16; const cols = Math.floor(canvas.width / fs);
    const drops = Array.from({ length: cols }, () => Math.random() * 20);
    const start = Date.now(), dur = 1400; let raf = 0;
    const step = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      const speed = 1 + p * 18, scale = 1 + p * 3;
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.05 * speed, 0.6)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41"; ctx.font = `${fs * scale}px "JetBrains Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(WARP_CHARS[(Math.random() * WARP_CHARS.length) | 0], i * fs * scale, drops[i] * fs * scale);
        if (drops[i] * fs * scale > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += speed;
      }
      if (p < 1) raf = requestAnimationFrame(step);
      else router.push(warp);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [warp, router]);

  const enter = (href: string) => (e: React.MouseEvent) => { e.preventDefault(); setWarp(href); };

  return (
    <main className="scanlines gw" style={{ minHeight: "100vh", position: "relative" }}>
      <Crt />
      <MatrixRain opacity={0.32} />

      {/* top nav */}
      <nav className="gw-nav">
        <span className="h-md t-green">VERDICT_AI</span>
        <span className="label" style={{ opacity: 0.7 }}>NEURAL_OS_v2.1</span>
        <span className="gw-navlinks">
          <a onClick={enter("/submit")} href="/submit">Submit</a>
          <a onClick={enter("/stream")} href="/stream">Stream</a>
        </span>
        <span style={{ marginLeft: "auto" }}><Chip tone="green">system: online</Chip></span>
      </nav>

      {/* hero / manifesto */}
      <section className="shell gw-hero" style={{ position: "relative", zIndex: 1 }}>
        <div className="code-sm t-red upper" style={{ letterSpacing: "0.2em", marginBottom: 16 }}>[ CRITICAL_ALERT ]</div>
        <h1 className="h-xl" style={{ lineHeight: 1.02 }}>
          SYSTEM_FAILURE:<br /><GlitchText>TRADITIONAL_MEDIA_OFFLINE</GlitchText>
        </h1>
        <div className="manifesto">
          <div>&gt; The news cycle is broken.</div>
          <div>&gt; Polarized echo chambers detected.</div>
          <div>&gt; Engagement optimized over truth.</div>
          <div>&gt; Information noise at 99%.</div>
          <div>&gt; Where do you find the signal?<span className="cursor" /></div>
        </div>

        {/* the two paths */}
        <div className="paths">
          <a href="/submit" onClick={enter("/submit")} className="path-card path-primary">
            <div className="path-row"><span className="material-symbols-outlined" style={{ fontSize: 24 }}>terminal</span><Chip tone="green">path_01</Chip></div>
            <div className="h-md" style={{ marginTop: 14 }}>I have a claim.</div>
            <p className="code-sm muted" style={{ margin: "8px 0 18px" }}>Type any statement. The jury convenes and returns a cited verdict.</p>
            <span className="btn primary clip" style={{ width: "100%" }}>&gt;&nbsp; SUBMIT_A_CLAIM</span>
          </a>
          <a href="/stream" onClick={enter("/stream")} className="path-card path-secondary">
            <div className="path-row"><span className="material-symbols-outlined" style={{ fontSize: 24 }}>stream</span><Chip tone="blue">path_02</Chip></div>
            <div className="h-md" style={{ marginTop: 14 }}>Show me something.</div>
            <p className="code-sm muted" style={{ margin: "8px 0 18px" }}>Pick what you care about. Watch a live deliberation on a recent claim.</p>
            <span className="btn blue clip" style={{ width: "100%" }}>&gt;&nbsp; ENTER_THE_STREAM</span>
          </a>
        </div>
      </section>

      {/* diagnostic readout */}
      <section className="shell gw-sec" style={{ position: "relative", zIndex: 1 }}>
        <motion.div className="label gw-seclabel" {...reveal}>/// DIAGNOSTIC_READOUT</motion.div>
        <div className="gw-3col">
          {[
            { k: "[ DISTORTION ]", tone: "t-red", b: "rgba(255,93,86,0.4)", body: "Media optimized for clicks, not truth. Content degraded to maximize engagement. Signal-to-noise critically low." },
            { k: "[ FRAGMENTATION ]", tone: "t-violet", b: "rgba(182,0,248,0.4)", body: "Algorithms thrive on division. Echo chambers reinforced through confirmation-bias loops. Consensus impossible." },
            { k: "[ RECOVERY ]", tone: "t-green", b: "var(--green)", body: "VERDICT. Twelve heterogeneous agents. Grounded evidence. Calibrated, preserved dissent. Initialization complete.", glow: true },
          ].map((p, i) => (
            <motion.div key={i} className="gw-panel" style={{ borderColor: p.b, boxShadow: p.glow ? "0 0 14px rgba(0,255,65,0.12) inset" : undefined }} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
              <div className={`label ${p.tone}`} style={{ marginBottom: 12 }}>{p.k}</div>
              <p className="code-sm" style={{ color: p.glow ? "var(--ink)" : "var(--ink-variant)", fontWeight: p.glow ? 700 : 400, lineHeight: 1.6 }}>{p.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* core functions */}
      <section className="shell gw-sec" style={{ position: "relative", zIndex: 1 }}>
        <motion.div className="label gw-seclabel" {...reveal}>/// CORE_FUNCTIONS</motion.div>
        <div className="gw-bento">
          <motion.div className="gw-panel gw-wide" {...reveal}>
            <div className="gw-fhead"><span className="material-symbols-outlined t-green" style={{ fontSize: 28 }}>account_tree</span><span className="h-md upper">Logic Coherence</span></div>
            <p className="code-sm muted" style={{ margin: "10px 0 18px", maxWidth: "46ch" }}>Every argument scored against shared evidence. Unsupported claims and contradictions flagged in real time.</p>
            <SegBar name="Argument integrity" value={0.85} />
          </motion.div>
          <motion.div className="gw-panel" {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
            <div className="gw-fhead"><span className="material-symbols-outlined t-violet" style={{ fontSize: 28 }}>groups_3</span><span className="h-md upper">Agent Deliberation</span></div>
            <p className="code-sm muted" style={{ margin: "10px 0 18px" }}>12 heterogeneous AI nodes debate without shared priors — adversarially, until consensus is calibrated.</p>
            <Chip tone="violet">nodes_active: 12 / 12</Chip>
          </motion.div>
          <motion.div className="gw-panel gw-full" {...reveal}>
            <div style={{ flex: 1 }}>
              <div className="gw-fhead"><span className="material-symbols-outlined t-blue" style={{ fontSize: 28 }}>data_exploration</span><span className="h-md upper">Real-time Influence</span></div>
              <p className="code-sm muted" style={{ margin: "10px 0 18px", maxWidth: "52ch" }}>Cast your own prior and watch consensus shift as evidence enters the chamber. You vs. the room.</p>
              <a href="/stream" onClick={enter("/stream")} className="btn blue clip" style={{ display: "inline-flex" }}>&gt;&nbsp; ENTER_THE_STREAM</a>
            </div>
            <div className="gw-graph" aria-hidden>
              {[30, 70, 40, 90, 60, 75].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="shell gw-foot" style={{ position: "relative", zIndex: 1 }}>
        <span className="code-sm muted">VERDICT_AI // ADVERSARIAL_JURY_PROTOCOL</span>
        <span className="code-sm t-green" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px var(--green)" }} /> SYSTEM_STATUS: NOMINAL
        </span>
      </footer>

      {/* ticker */}
      <div className="ticker-rail">
        <div className="label" style={{ flex: "none", padding: "0 16px", borderRight: "1px solid var(--line-2)" }}>ON_THE_DOCKET</div>
        <div className="ticker-track">{ticker.map((t, i) => <span key={i} className="ticker-item"><span className="t-green">&gt;</span> {t.claim}<span className="muted">&nbsp;&nbsp;//&nbsp;&nbsp;</span></span>)}</div>
      </div>

      {/* warp overlay */}
      {warp && <div className="warp"><canvas ref={warpRef} /></div>}

      <style jsx>{`
        .gw-nav { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 16px; padding: 14px 24px; border-bottom: 1px solid var(--line); background: rgba(6,8,7,0.7); backdrop-filter: blur(10px); }
        .gw-navlinks { display: flex; gap: 16px; }
        .gw-navlinks a { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-variant); cursor: pointer; }
        .gw-navlinks a:hover { color: var(--green); }
        .gw-hero { padding: 64px 24px 48px; max-width: 1100px; }
        .manifesto { border-left: 2px solid var(--green-dim); padding: 6px 0 6px 16px; margin: 26px 0 34px; color: var(--ink-variant); font-size: 15px; line-height: 1.9; }
        .paths { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 820px; }
        @media (max-width: 760px) { .paths { grid-template-columns: 1fr; } }
        .path-card { display: block; padding: 22px; border: 1px solid var(--line); background: rgba(0,0,0,0.4); text-decoration: none; color: var(--ink); transition: border-color .2s, box-shadow .2s, transform .1s; cursor: pointer; }
        .path-card:hover { transform: translateY(-2px); }
        .path-primary:hover { border-color: var(--green); box-shadow: 0 0 18px rgba(0,255,65,0.16); }
        .path-secondary:hover { border-color: var(--blue); box-shadow: 0 0 18px rgba(0,218,243,0.16); }
        .path-row { display: flex; align-items: center; justify-content: space-between; color: var(--ink-variant); }
        .gw-sec { padding: 30px 24px; max-width: 1100px; }
        .gw-seclabel { border-bottom: 1px solid var(--line-2); padding-bottom: 10px; margin-bottom: 22px; }
        .gw-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .gw-bento { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
        .gw-panel { background: rgba(0,0,0,0.4); border: 1px solid var(--line); padding: 22px; }
        .gw-wide { grid-column: span 1; }
        .gw-full { grid-column: 1 / -1; display: flex; gap: 24px; align-items: center; }
        .gw-fhead { display: flex; align-items: center; gap: 12px; }
        .gw-graph { display: flex; align-items: flex-end; gap: 6px; width: 220px; height: 110px; border-left: 1px solid var(--blue); border-bottom: 1px solid var(--blue); padding: 0 4px 0 8px; flex: none; }
        .gw-graph span { flex: 1; background: var(--blue); box-shadow: 0 0 6px rgba(0,218,243,0.4); }
        @media (max-width: 860px) { .gw-3col, .gw-bento { grid-template-columns: 1fr; } .gw-full { flex-direction: column; align-items: stretch; } .gw-graph { width: 100%; } }
        .gw-foot { display: flex; justify-content: space-between; align-items: center; padding: 24px; border-top: 1px solid var(--line); margin-bottom: 40px; }
        .ticker-rail { position: fixed; bottom: 0; left: 0; right: 0; height: 40px; z-index: 20; display: flex; align-items: center; border-top: 1px solid var(--line); background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); overflow: hidden; }
        .ticker-track { display: flex; white-space: nowrap; animation: ticker 60s linear infinite; }
        .ticker-item { font-size: 13px; color: var(--ink-variant); }
        .warp { position: fixed; inset: 0; z-index: 9999; background: #000; }
        .warp canvas { width: 100%; height: 100%; }
      `}</style>
    </main>
  );
}
