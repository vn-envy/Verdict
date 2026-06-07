"use client";

import { useEffect, useState } from "react";

// Reveals text progressively (broadcast cadence). Re-types only when `id` changes,
// so a fact-check arriving for the same claim doesn't restart it. Reduced-motion
// users get the full text immediately.
export function Typewriter({ text, id, cps = 90 }: { text: string; id?: string; cps?: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(text.length);
      return;
    }
    setN(0);
    const step = Math.max(1, Math.round(cps / 40)); // chars per ~25ms tick
    let i = 0;
    const t = setInterval(() => {
      i += step;
      setN(i);
      if (i >= text.length) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, [text, id, cps]);

  const done = n >= text.length;
  return (
    <>
      {text.slice(0, n)}
      <span className={`caret ${done ? "done" : ""}`} aria-hidden>
        ▌
      </span>
    </>
  );
}
