"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crt, DigitalRain, Chip } from "@/components/hud";
import { INTERESTS, Interest, Topic, topicsFor } from "@/lib/topics";

export default function Stream() {
  const router = useRouter();
  const [sel, setSel] = useState<Interest[]>([]);
  const topics = topicsFor(sel);

  const toggle = (i: Interest) =>
    setSel((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const open = (t: Topic) => {
    if (t.mode === "replay") router.push(`/case/replay_${t.caseKey}`);
    else router.push(`/case/new?claim=${encodeURIComponent(t.claim)}&prior=0`);
  };

  return (
    <main className="scanlines" style={{ minHeight: "100vh", position: "relative" }}>
      <Crt />
      <DigitalRain opacity={0.4} fixed />

      <header className="shell shell-wide" style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 24px" }}>
        <Link href="/" className="label" style={{ color: "var(--ink-variant)" }}>← GATEWAY</Link>
        <span className="label" style={{ marginLeft: "auto" }}>PATH_02 // LIVE_STREAM</span>
      </header>

      <section className="shell shell-wide" style={{ padding: "36px 24px 80px", position: "relative", zIndex: 1 }}>
        <div className="label" style={{ marginBottom: 14 }}>SELECT_INTEREST_VECTORS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
          {INTERESTS.map((it) => {
            const on = sel.includes(it.id);
            return (
              <button key={it.id} className="vec" data-on={on} onClick={() => toggle(it.id)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{it.icon}</span>
                {it.label}
              </button>
            );
          })}
          {sel.length > 0 && (
            <button className="vec clear" onClick={() => setSel([])}>clear</button>
          )}
        </div>

        <div className="label" style={{ marginBottom: 16 }}>
          {sel.length ? `${topics.length} DELIBERATIONS // ${sel.join(" · ")}` : `${topics.length} DELIBERATIONS ON THE DOCKET`}
        </div>

        <div className="feed">
          {topics.map((t) => (
            <button key={t.id} className="topic" onClick={() => open(t)}>
              <div className="topic-top">
                <Chip tone={t.mode === "replay" ? "violet" : "green"}>{t.mode === "replay" ? "archive" : "live"}</Chip>
                {t.hot && <Chip tone="red">hot</Chip>}
                <span className="topic-tag">{t.tag}</span>
              </div>
              <div className="topic-claim">{t.claim}</div>
              <div className="topic-foot">
                <span className="topic-int">{t.interests.join(" · ")}</span>
                <span className="topic-go">WATCH&nbsp;<span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span></span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <style jsx>{`
        .vec {
          display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-mono);
          font-size: 12.5px; letter-spacing: 0.05em; text-transform: uppercase; padding: 9px 14px;
          background: transparent; color: var(--ink-variant); border: 1px solid var(--line-2); cursor: pointer; transition: all 0.15s;
        }
        .vec:hover { color: var(--ink); border-color: var(--line); }
        .vec[data-on="true"] { color: var(--blue); border-color: var(--blue); background: rgba(0, 218, 243, 0.06); box-shadow: 0 0 8px rgba(0, 218, 243, 0.16); }
        .vec.clear { color: var(--muted); }
        .feed { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }
        .topic {
          text-align: left; cursor: pointer; padding: 18px; background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--line); transition: border-color 0.18s, box-shadow 0.18s, transform 0.1s; color: var(--ink);
          display: flex; flex-direction: column; gap: 12px; min-height: 168px;
        }
        .topic:hover { border-color: var(--green); box-shadow: 0 0 16px rgba(0, 255, 65, 0.14); transform: translateY(-2px); }
        .topic-top { display: flex; align-items: center; gap: 8px; }
        .topic-tag { margin-left: auto; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
        .topic-claim { font-family: var(--font-display); font-weight: 500; font-size: 18px; line-height: 1.3; flex: 1; }
        .topic-foot { display: flex; align-items: center; justify-content: space-between; }
        .topic-int { font-size: 10.5px; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; }
        .topic-go { display: inline-flex; align-items: center; font-size: 12px; letter-spacing: 0.1em; color: var(--green); }
      `}</style>
    </main>
  );
}
