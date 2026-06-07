"use client";

import { CSSProperties } from "react";
import { CouncilIdentity, ShapeKind, identityForSlot, DA_IDENTITY, voteToken } from "@/lib/council";

// Renders a council member's distinct SHAPE (design.md geometry motif). The same shape
// is drawn three times — solid color, then a top-left highlight, then a bottom shade —
// so any color reads as a polished gem. States: speaking (glow), sealed (masked "?"),
// and a vote ring once a position is known.

function shapeEl(kind: ShapeKind, fill: string, key: string) {
  const p = (points: string) => <polygon key={key} points={points} fill={fill} />;
  switch (kind) {
    case "circle":   return <circle key={key} cx="50" cy="50" r="37" fill={fill} />;
    case "triangle": return p("50,13 87,84 13,84");
    case "square":   return <rect key={key} x="15" y="15" width="70" height="70" rx="13" fill={fill} />;
    case "hexagon":  return p("28,17 72,17 91,50 72,83 28,83 9,50");
    case "octagon":  return p("34,11 66,11 89,34 89,66 66,89 34,89 11,66 11,34");
    case "diamond":  return p("50,9 88,50 50,91 12,50");
    case "pentagon": return p("50,10 90,40 74,87 26,87 10,40");
    case "star":     return p("50,7 61,38 94,38 67,58 78,91 50,71 22,91 33,58 6,38 39,38");
    case "shield":   return <path key={key} fill={fill} d="M50 11 L85 24 V52 C85 73 68 85 50 91 C32 85 15 73 15 52 V24 Z" />;
    case "cross":    return <path key={key} fill={fill} d="M40 13 H60 V40 H87 V60 H60 V87 H40 V60 H13 V40 H40 Z" />;
    case "crescent": return <path key={key} fill={fill} d="M60 13 A37 37 0 1 0 60 87 A29 29 0 1 1 60 13 Z" />;
    case "droplet":  return <path key={key} fill={fill} d="M50 11 C70 39 82 53 82 65 A32 32 0 1 1 18 65 C18 53 30 39 50 11 Z" />;
    case "flame":    return <path key={key} fill={fill} d="M52 9 C58 30 78 38 70 60 C68 66 62 70 62 70 C70 66 70 56 70 56 C78 72 66 92 50 92 C33 92 24 76 34 61 C37 68 43 69 43 69 C36 58 47 50 50 36 C55 48 50 55 58 56 C66 49 52 30 52 9 Z" />;
  }
}

export function CouncilMark({
  slot,
  identity,
  da = false,
  size = 48,
  speaking = false,
  sealed = false,
  dimmed = false,
  vote,
}: {
  slot?: string;
  identity?: CouncilIdentity;
  da?: boolean;
  size?: number;
  speaking?: boolean;
  sealed?: boolean;
  dimmed?: boolean;
  vote?: number;
}) {
  const id = identity ?? (da ? DA_IDENTITY : identityForSlot(slot ?? "S1"));
  const uid = `cm-${id.shape}-${slot ?? "x"}`;
  const vt = voteToken(vote);
  const cls = [
    "mark", `mark-${vt}`,
    speaking ? "is-speaking" : "",
    sealed ? "is-sealed" : "",
    dimmed ? "is-dimmed" : "",
    vote !== undefined ? "has-vote" : "",
    da ? "is-da" : "",
  ].filter(Boolean).join(" ");

  return (
    <span className={cls} style={{ width: size, height: size, ["--mark" as keyof CSSProperties]: id.color } as CSSProperties}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={`${uid}-hi`} cx="0.32" cy="0.26" r="0.85">
            <stop offset="0" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="0.6" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id={`${uid}-lo`} cx="0.62" cy="0.84" r="0.75">
            <stop offset="0" stopColor="rgba(4,6,16,0.42)" />
            <stop offset="0.75" stopColor="rgba(4,6,16,0)" />
          </radialGradient>
        </defs>
        {shapeEl(id.shape, id.color, `${uid}-base`)}
        {shapeEl(id.shape, `url(#${uid}-hi)`, `${uid}-hi`)}
        {shapeEl(id.shape, `url(#${uid}-lo)`, `${uid}-lo`)}
      </svg>
      {sealed && <span className="mark-seal" aria-hidden>?</span>}
    </span>
  );
}
