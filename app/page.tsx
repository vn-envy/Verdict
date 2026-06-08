"use client";

import Link from "next/link";
import { Crt, DigitalRain, GlitchText, Chip } from "@/components/hud";
import { TOPICS } from "@/lib/topics";

export default function Gateway() {
  const ticker = TOPICS.concat(TOPICS); // duplicate for seamless loop
  return (
    <main className="scanlines" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <Crt />
      <DigitalRain opacity={0.5} fixed />

      <header className="shell" style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 24px" }}>
        <span className="h-md t-green">VERDICT</span>
        <span className="label">// ROOT_ACCESS</span>
        <span style={{ marginLeft: "auto" }}><Chip tone="green">system: online</Chip></span>
      </header>

      <section className="shell" style={{ padding: "40px 24px 24px", position: "relative", zIndex: 1 }}>
        <div className="label" style={{ marginBottom: 18 }}>AN ADVERSARIAL AI JURY</div>
        <h1 className="h-xl" style={{ maxWidth: "16ch" }}>
          TWELVE AGENTS.<br />ONE <GlitchText>VERDICT</GlitchText>.
        </h1>
        <p className="lede" style={{ marginTop: 22 }}>
          A heterogeneous jury of AI agents adjudicates any contested claim — grounded in evidence,
          calibrated, and unbiased by construction.
        </p>

        {/* Two paths — the only choices on this page. */}
        <div className="paths">
          <Link href="/submit" className="path-card path-primary">
            <div className="path-row">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>terminal</span>
              <Chip tone="green">path_01</Chip>
            </div>
            <div className="h-md" style={{ marginTop: 14 }}>I have a claim.</div>
            <p className="code-sm muted" style={{ margin: "8px 0 20px" }}>
              Type any statement. The jury convenes and returns a cited verdict.
            </p>
            <span className="btn primary clip" style={{ width: "100%" }}>&gt;&nbsp; SUBMIT_A_CLAIM</span>
          </Link>

          <Link href="/stream" className="path-card path-secondary">
            <div className="path-row">
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>stream</span>
              <Chip tone="blue">path_02</Chip>
            </div>
            <div className="h-md" style={{ marginTop: 14 }}>Show me something.</div>
            <p className="code-sm muted" style={{ margin: "8px 0 20px" }}>
              Pick what you care about. Watch a live deliberation on a recent claim.
            </p>
            <span className="btn blue clip" style={{ width: "100%" }}>&gt;&nbsp; ENTER_THE_STREAM</span>
          </Link>
        </div>
      </section>

      {/* Recent-claims ticker */}
      <div className="ticker-rail">
        <div className="label" style={{ flex: "none", padding: "0 16px", borderRight: "1px solid var(--line-2)" }}>
          ON_THE_DOCKET
        </div>
        <div className="ticker-track">
          {ticker.map((t, i) => (
            <span key={i} className="ticker-item">
              <span className="t-green">&gt;</span> {t.claim}
              <span className="muted">&nbsp;&nbsp;//&nbsp;&nbsp;</span>
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .paths { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 48px; max-width: 900px; }
        @media (max-width: 760px) { .paths { grid-template-columns: 1fr; } }
        .path-card {
          display: block; padding: 24px; border: 1px solid var(--line);
          background: rgba(0, 0, 0, 0.4); text-decoration: none; color: var(--ink);
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.1s;
        }
        .path-card:hover { transform: translateY(-2px); }
        .path-primary:hover { border-color: var(--green); box-shadow: 0 0 18px rgba(0, 255, 65, 0.18); }
        .path-secondary:hover { border-color: var(--blue); box-shadow: 0 0 18px rgba(0, 218, 243, 0.18); }
        .path-row { display: flex; align-items: center; justify-content: space-between; color: var(--ink-variant); }
        .ticker-rail {
          position: fixed; bottom: 0; left: 0; right: 0; height: 40px; z-index: 5;
          display: flex; align-items: center; border-top: 1px solid var(--line);
          background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); overflow: hidden;
        }
        .ticker-track { display: flex; white-space: nowrap; animation: ticker 60s linear infinite; }
        .ticker-item { font-size: 13px; color: var(--ink-variant); }
      `}</style>
    </main>
  );
}
