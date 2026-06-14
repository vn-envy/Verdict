"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MatrixRain, Crt, Chip, GlitchText } from "@/components/hud";
import { TOPICS } from "@/lib/topics";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.55, ease: "easeOut" },
} as const;

const WARP_CHARS = "アカサタナハマヤラワABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

// What's broken (TV + social) and how Verdict answers it — the clear problem→solution story.
const PROBLEM = [
  { k: "TV NEWS", body: "Punditry and outrage drive ratings. Panels perform for their side — nobody actually adjudicates the facts." },
  { k: "SOCIAL MEDIA", body: "Algorithms amplify whatever provokes. Echo chambers harden your priors; engagement beats accuracy every time." },
  { k: "THE RESULT", body: "Confident takes with no reasoning and no visible dissent. You can't tell a 95/5 consensus from a 55/45 coin-flip." },
];
const FIX = [
  { k: "12 INDEPENDENT JURORS", body: "Five different AI model families with no shared priors — so there's no monoculture to fall into groupthink." },
  { k: "BLIND VOTE, THEN DEBATE", body: "Jurors vote before they see each other, then argue it out — with a mandated Devil's Advocate against any forming consensus." },
  { k: "GROUNDED IN EVIDENCE", body: "Every claim is checked against live web sources, not the models' memory — and flagged when it doesn't hold up." },
  { k: "CALIBRATED, DISSENT KEPT", body: "You get a calibrated confidence score and a preserved Minority Report. The split is shown, never erased." },
];

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
      <MatrixRain opacity={0.28} />

      {/* top nav */}
      <nav className="gw-nav">
        <span className="h-md t-green">VERDICT</span>
        <span className="label" style={{ opacity: 0.7 }}>COUNCIL_OF_12</span>
        <span className="gw-navlinks">
          <a onClick={enter("/submit")} href="/submit">Submit</a>
          <a onClick={enter("/stream")} href="/stream">Stream</a>
        </span>
        <span style={{ marginLeft: "auto" }}><Chip tone="green">system: online</Chip></span>
      </nav>

      {/* hero — name the problem plainly, then the fix */}
      <section className="shell gw-hero" style={{ position: "relative", zIndex: 1 }}>
        <div className="code-sm t-red upper" style={{ letterSpacing: "0.2em", marginBottom: 16 }}>[ SIGNAL // NOISE ]</div>
        <h1 className="h-xl" style={{ lineHeight: 1.02 }}>
          THE NEWS IS OPTIMIZED FOR<br /><GlitchText>CLICKS, NOT TRUTH</GlitchText>
        </h1>
        <p className="lede gw-lede">
          TV news sells outrage and punditry. Social feeds reward whatever keeps you scrolling.
          Both bury the evidence. <span className="t-green">Verdict</span> convenes twelve independent
          AI jurors to weigh a claim on the facts — adversarially, grounded in live sources, with the
          dissent kept intact — and shows its work.
        </p>

        {/* the two paths */}
        <div className="paths">
          <a href="/submit" onClick={enter("/submit")} className="path-card path-primary">
            <div className="path-row"><span className="material-symbols-outlined" style={{ fontSize: 24 }}>terminal</span><Chip tone="green">path_01</Chip></div>
            <div className="h-md" style={{ marginTop: 14 }}>I have a claim.</div>
            <p className="code-sm muted" style={{ margin: "8px 0 18px" }}>Type any statement. Twelve jurors convene, debate the evidence, and return a cited, calibrated verdict.</p>
            <span className="btn primary clip" style={{ width: "100%" }}>&gt;&nbsp; SUBMIT_A_CLAIM</span>
          </a>
          <a href="/stream" onClick={enter("/stream")} className="path-card path-secondary">
            <div className="path-row"><span className="material-symbols-outlined" style={{ fontSize: 24 }}>stream</span><Chip tone="blue">path_02</Chip></div>
            <div className="h-md" style={{ marginTop: 14 }}>Show me one live.</div>
            <p className="code-sm muted" style={{ margin: "8px 0 18px" }}>Pick a topic and watch the jury deliberate a real claim in real time — vote, then watch it move.</p>
            <span className="btn blue clip" style={{ width: "100%" }}>&gt;&nbsp; ENTER_THE_STREAM</span>
          </a>
        </div>
      </section>

      {/* problem → fix, side by side */}
      <section className="shell gw-sec" style={{ position: "relative", zIndex: 1 }}>
        <div className="gw-2col">
          <motion.div className="gw-panel gw-prob" {...reveal}>
            <div className="label t-red" style={{ marginBottom: 16 }}>/// WHY YOU CAN'T TRUST THE FEED</div>
            {PROBLEM.map((p, i) => (
              <div className="prob" key={i}>
                <div className="prob-k t-red">{p.k}</div>
                <p className="prob-b">{p.body}</p>
              </div>
            ))}
          </motion.div>
          <motion.div className="gw-panel gw-fix" {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
            <div className="label t-green" style={{ marginBottom: 16 }}>/// HOW VERDICT FIXES IT</div>
            {FIX.map((p, i) => (
              <div className="prob" key={i}>
                <div className="prob-k t-green">{p.k}</div>
                <p className="prob-b">{p.body}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="shell gw-foot" style={{ position: "relative", zIndex: 1 }}>
        <span className="code-sm muted">VERDICT // ADVERSARIAL_JURY_PROTOCOL</span>
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
        .gw-hero { padding: 64px 24px 44px; max-width: 1040px; }
        .gw-lede { margin: 22px 0 34px; font-size: 16px; line-height: 1.7; max-width: 68ch; }
        .paths { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 820px; }
        @media (max-width: 760px) { .paths { grid-template-columns: 1fr; } }
        .path-card { display: block; padding: 22px; border: 1px solid var(--line); background: rgba(0,0,0,0.4); text-decoration: none; color: var(--ink); transition: border-color .2s, box-shadow .2s, transform .1s; cursor: pointer; }
        .path-card:hover { transform: translateY(-2px); }
        .path-primary:hover { border-color: var(--green); box-shadow: 0 0 18px rgba(0,255,65,0.16); }
        .path-secondary:hover { border-color: var(--blue); box-shadow: 0 0 18px rgba(0,218,243,0.16); }
        .path-row { display: flex; align-items: center; justify-content: space-between; color: var(--ink-variant); }
        .gw-sec { padding: 16px 24px 30px; max-width: 1040px; }
        .gw-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 860px) { .gw-2col { grid-template-columns: 1fr; } }
        .gw-panel { background: rgba(0,0,0,0.4); border: 1px solid var(--line); padding: 24px; }
        .gw-prob { border-color: rgba(255,93,86,0.32); }
        .gw-fix { border-color: var(--green); box-shadow: 0 0 16px rgba(0,255,65,0.10) inset; }
        .prob { padding: 13px 0; border-top: 1px solid var(--line-2); }
        .prob:first-of-type { border-top: none; padding-top: 4px; }
        .prob-k { font-size: 12px; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 6px; }
        .prob-b { font-family: var(--font-mono); font-size: 12.5px; color: var(--ink-variant); line-height: 1.6; margin: 0; }
        .gw-foot { display: flex; justify-content: space-between; align-items: center; padding: 24px; border-top: 1px solid var(--line); margin-bottom: 40px; gap: 12px; flex-wrap: wrap; }
        .ticker-rail { position: fixed; bottom: 0; left: 0; right: 0; height: 40px; z-index: 20; display: flex; align-items: center; border-top: 1px solid var(--line); background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); overflow: hidden; }
        .ticker-track { display: flex; white-space: nowrap; animation: ticker 60s linear infinite; }
        .ticker-item { font-size: 13px; color: var(--ink-variant); }
        .warp { position: fixed; inset: 0; z-index: 9999; background: #000; }
        .warp canvas { width: 100%; height: 100%; }
      `}</style>
    </main>
  );
}
