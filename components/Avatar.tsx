"use client";

// Deterministic broadcast-anchor avatar. Faceless silhouette on a seeded gradient
// = a newsroom headshot with a layer of mystery. Identity stays "sealed" (shadowed)
// until a juror takes the floor or their vote is revealed.

// Curated gradient pairs — picked by hash so the panel looks designed, not random.
const PALETTES: [string, string][] = [
  ["#7d8bff", "#3b2db5"], // indigo
  ["#38d6c3", "#0e7490"], // teal
  ["#b07cff", "#5b21b6"], // violet
  ["#ff8fab", "#9d174d"], // rose
  ["#ffd166", "#b45309"], // amber
  ["#5eead4", "#155e75"], // aqua
  ["#7dd3fc", "#1e3a8a"], // sky
  ["#fca5a5", "#7f1d1d"], // ember
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Avatar({
  name,
  axis,
  size = 64,
  speaking = false,
  mystery = false,
}: {
  name: string;
  axis?: string;
  size?: number;
  speaking?: boolean;
  mystery?: boolean;
}) {
  const h = hash(name);
  const [c1, c2] = PALETTES[h % PALETTES.length];
  const gid = `av${h}`;
  const cls = ["avatar", speaking ? "speaking" : "", mystery ? "mystery" : "", `axisr-${axis ?? "none"}`]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} style={{ width: size, height: size }}>
      <span className="avatar-ring" aria-hidden />
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={name}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          <radialGradient id={`${gid}l`} cx="0.5" cy="0.28" r="0.85">
            <stop offset="0" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="0.55" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="24" fill={`url(#${gid})`} />
        <g fill="rgba(7,9,18,0.46)">
          <circle cx="50" cy="39" r="17" />
          <path d="M21 88c0-17.5 13-28 29-28s29 10.5 29 28z" />
        </g>
        <rect x="0" y="0" width="100" height="100" rx="24" fill={`url(#${gid}l)`} />
      </svg>
      {mystery && (
        <span className="avatar-seal" aria-hidden>
          ?
        </span>
      )}
    </span>
  );
}
