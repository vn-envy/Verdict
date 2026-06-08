"use client";

// Neural OS — reusable HUD primitives. Thin wrappers over the design-system classes in
// app/globals.css. Source of truth: stitch_agent_jury_live/neural_interface/DESIGN.md.

import { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";

type Tone = "green" | "violet" | "blue" | "red";

// --- Global CRT overlay (mount once, near the app root) ---
export function Crt() {
  return <div className="crt-global" aria-hidden />;
}

// --- Digital-rain backdrop layer (absolute fill inside a positioned parent) ---
export function DigitalRain({ opacity = 0.5, fixed = false }: { opacity?: number; fixed?: boolean }) {
  return (
    <div
      className="digital-rain"
      aria-hidden
      style={{ position: fixed ? "fixed" : "absolute", inset: 0, opacity, pointerEvents: "none", zIndex: 0 }}
    />
  );
}

// --- Blinking terminal cursor block ---
export function Cursor() {
  return <span className="cursor" aria-hidden />;
}

// --- Data-cluster panel ---
export function Panel({
  title, right, accent, rain = true, className = "", style, children,
}: {
  title?: ReactNode; right?: ReactNode; accent?: Tone; rain?: boolean;
  className?: string; style?: CSSProperties; children: ReactNode;
}) {
  return (
    <div className={`hud-panel scanlines ${rain ? "rain" : ""} ${accent ? `hud-panel--${accent}` : ""} ${className}`} style={style}>
      {title !== undefined && (
        <div className="hud-panel-head">
          <span className="hud-panel-title">{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// --- Bracketed status chip: [ LABEL ] ---
export function Chip({ tone, solid, children }: { tone?: Tone; solid?: boolean; children: ReactNode }) {
  return <span className={`chip ${tone ?? ""} ${solid ? "solid" : ""}`}>{children}</span>;
}

// --- Clipped-corner CTA button. `primary` = the one dominant action per view (filled). ---
export function Button({
  tone = "green", clip = true, lg, ghost, primary, className = "", children, ...rest
}: { tone?: "green" | "violet" | "blue"; clip?: boolean; lg?: boolean; ghost?: boolean; primary?: boolean } &
  ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`btn ${tone} ${clip ? "clip" : ""} ${lg ? "lg" : ""} ${ghost ? "ghost" : ""} ${primary ? "primary" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// --- Terminal prompt input ---
export function TerminalInput({
  prefix = ">", className = "", ...rest
}: { prefix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`term ${className}`}>
      <span className="term-prefix">{prefix}</span>
      <input className="term-input" spellCheck={false} autoComplete="off" {...rest} />
    </label>
  );
}

// --- Segmented "bit-block" telemetry bar (value 0..1) ---
export function SegBar({
  name, value, segments = 20, tone = "green", format,
}: { name: string; value: number; segments?: number; tone?: Tone; format?: (v: number) => string }) {
  const v = Math.max(0, Math.min(1, value));
  const on = Math.round(v * segments);
  return (
    <div className={`seg ${tone}`}>
      <div className="seg-top">
        <span className="seg-name">{name}</span>
        <span className="seg-val">{format ? format(value) : `${Math.round(v * 100)}%`}</span>
      </div>
      <div className="seg-track">
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className={`seg-cell ${i < on ? "on" : ""}`} />
        ))}
      </div>
    </div>
  );
}

// --- Radial vector dial: a half-gauge for a -1..1 (or 0..1) reading ---
const TONE_HEX: Record<Tone, string> = { green: "#00ff41", violet: "#b600f8", blue: "#00daf3", red: "#ff5d56" };
export function VectorDial({
  value, label, sub, tone = "green", bipolar = true, size = 168,
}: { value: number; label: string; sub?: string; tone?: Tone; bipolar?: boolean; size?: number }) {
  // Map value to a fraction 0..1 across the half-gauge.
  const frac = bipolar ? (Math.max(-1, Math.min(1, value)) + 1) / 2 : Math.max(0, Math.min(1, value));
  const a = Math.PI * (1 - frac); // angle from left(π) to right(0)
  const cx = 50, cy = 50, r = 40;
  const nx = cx + r * Math.cos(a), ny = cy - r * Math.sin(a);
  const col = TONE_HEX[tone];
  // value arc path (from left to needle)
  const sx = cx - r, sy = cy;
  const large = frac > 0.5 ? 0 : 0;
  return (
    <div style={{ width: size, textAlign: "center" }}>
      <svg viewBox="0 0 100 60" width={size} height={size * 0.6}>
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${nx} ${ny}`} fill="none" stroke={col} strokeWidth="6"
          style={{ filter: `drop-shadow(0 0 6px ${col})`, transition: "all .7s cubic-bezier(.2,.8,.2,1)" }} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth="2" style={{ filter: `drop-shadow(0 0 5px ${col})`, transition: "all .7s cubic-bezier(.2,.8,.2,1)" }} />
        <circle cx={cx} cy={cy} r="3" fill={col} />
      </svg>
      <div className="h-md" style={{ color: col, textShadow: `0 0 10px ${col}88`, marginTop: -6 }}>{label}</div>
      {sub && <div className="code-sm muted" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// --- Glitch headline (static by default; `anim` for the verdict reveal beat) ---
export function GlitchText({ children, anim, className = "" }: { children: string; anim?: boolean; className?: string }) {
  return <span className={`glitch ${anim ? "anim" : ""} ${className}`} data-text={children}>{children}</span>;
}

// --- Vertical sidebar nav with active-node indicator ---
export function SidebarNav({
  items, active, onSelect,
}: { items: { id: string; label: string; icon?: string }[]; active?: string; onSelect?: (id: string) => void }) {
  return (
    <nav className="sidenav">
      {items.map((it) => (
        <div key={it.id} className={`sidenav-item ${active === it.id ? "active" : ""}`} onClick={() => onSelect?.(it.id)}>
          <span className="node" aria-hidden />
          {it.icon && <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{it.icon}</span>}
          {it.label}
        </div>
      ))}
    </nav>
  );
}
