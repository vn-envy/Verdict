"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crt, DigitalRain, TerminalInput, Button, Chip } from "@/components/hud";

const STANCES: { id: string; label: string; prior: number; tone: "green" | "blue" | "red" }[] = [
  { id: "true", label: "I think it's TRUE", prior: 0.5, tone: "green" },
  { id: "unsure", label: "I'm UNSURE", prior: 0, tone: "blue" },
  { id: "false", label: "I think it's FALSE", prior: -0.5, tone: "red" },
];

export default function Submit() {
  const router = useRouter();
  const [claim, setClaim] = useState("");
  const [stance, setStance] = useState("unsure");

  const ready = claim.trim().length > 8;
  const go = () => {
    if (!ready) return;
    const prior = STANCES.find((s) => s.id === stance)?.prior ?? 0;
    router.push(`/case/new?claim=${encodeURIComponent(claim.trim())}&prior=${prior}`);
  };

  return (
    <main className="scanlines" style={{ minHeight: "100vh", position: "relative" }}>
      <Crt />
      <DigitalRain opacity={0.45} fixed />

      <header className="shell" style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 24px" }}>
        <Link href="/" className="label" style={{ color: "var(--ink-variant)" }}>← GATEWAY</Link>
        <span className="label" style={{ marginLeft: "auto" }}>PATH_01 // ADJUDICATION</span>
      </header>

      <section className="shell" style={{ maxWidth: 820, padding: "48px 24px", position: "relative", zIndex: 1 }}>
        <div className="label" style={{ marginBottom: 14 }}>SUBMIT_A_CLAIM</div>
        <h1 className="h-lg" style={{ marginBottom: 8 }}>State the claim to put on trial.</h1>
        <p className="lede" style={{ marginBottom: 28 }}>
          One contested statement. The jury decomposes it, gathers evidence, debates, and returns a
          calibrated verdict.
        </p>

        <TerminalInput
          className="lg"
          autoFocus
          placeholder="e.g.  Remote work lowers overall team productivity."
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />

        <div style={{ marginTop: 28 }}>
          <div className="label" style={{ marginBottom: 12 }}>YOUR PRIOR — CAST BEFORE THE ROOM DOES</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {STANCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStance(s.id)}
                className="stance"
                data-on={stance === s.id}
                data-tone={s.tone}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 16 }}>
          <Button primary lg disabled={!ready} onClick={go}>
            &gt;&nbsp; INITIATE_DELIBERATION
          </Button>
          {!ready && <Chip>enter a claim to begin</Chip>}
        </div>
      </section>

      <style jsx>{`
        .stance {
          font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase;
          padding: 10px 16px; background: transparent; color: var(--ink-variant);
          border: 1px solid var(--line-2); cursor: pointer; transition: all 0.15s;
        }
        .stance:hover { color: var(--ink); }
        .stance[data-on="true"][data-tone="green"] { color: var(--green); border-color: var(--green); box-shadow: 0 0 8px rgba(0, 255, 65, 0.2); }
        .stance[data-on="true"][data-tone="blue"] { color: var(--blue); border-color: var(--blue); box-shadow: 0 0 8px rgba(0, 218, 243, 0.2); }
        .stance[data-on="true"][data-tone="red"] { color: var(--red); border-color: var(--red); box-shadow: 0 0 8px rgba(255, 93, 86, 0.2); }
      `}</style>
    </main>
  );
}
