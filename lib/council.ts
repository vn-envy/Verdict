// The Council of 12 — fixed visual identities (design.md §"Council of 12 Profiles").
// Each structural slot (S1..S12) gets a distinct SHAPE + COLOR so the eye can parse the
// council at a glance. Identity is keyed by slot number, so it's stable across topics
// (the live name/lens/model still comes from the backend cast).

export type ShapeKind =
  | "circle" | "triangle" | "square" | "hexagon" | "shield" | "octagon"
  | "diamond" | "cross" | "crescent" | "star" | "pentagon" | "droplet" | "flame";

export interface CouncilIdentity {
  shape: ShapeKind;
  color: string;   // vivid fill, tuned to read on both Day and Night themes
  archetype: string;
}

// Order matches design.md profiles 1..12.
const ORDER: CouncilIdentity[] = [
  { shape: "circle",   color: "#4f7cff", archetype: "The Visionary" },
  { shape: "triangle", color: "#ff5d72", archetype: "The Skeptic" },
  { shape: "square",   color: "#2dd4a7", archetype: "The Pragmatist" },
  { shape: "hexagon",  color: "#f5b740", archetype: "The Analyst" },
  { shape: "shield",   color: "#a875ff", archetype: "The Ethicist" },
  { shape: "octagon",  color: "#ff944d", archetype: "The Historian" },
  { shape: "diamond",  color: "#6d6dff", archetype: "The Innovator" },
  { shape: "cross",    color: "#ff6fae", archetype: "The Provocateur" },
  { shape: "crescent", color: "#2bd1c4", archetype: "The Diplomat" },
  { shape: "star",     color: "#45c8ff", archetype: "The Futurist" },
  { shape: "pentagon", color: "#8aa0c8", archetype: "The Realist" },
  { shape: "droplet",  color: "#ff8fb0", archetype: "The Mediator" },
];

export const DA_IDENTITY: CouncilIdentity = { shape: "flame", color: "#ff7a3c", archetype: "The Provocateur" };

export function slotIndex(slot: string): number {
  const n = parseInt((slot || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 1 ? (n - 1) % 12 : 0;
}

export function identityForSlot(slot: string): CouncilIdentity {
  return ORDER[slotIndex(slot)];
}

// Convert a vote (-1|0|1) to a semantic token used in classNames.
export function voteToken(v?: number): "for" | "against" | "undecided" | "unknown" {
  if (v === 1) return "for";
  if (v === -1) return "against";
  if (v === 0) return "undecided";
  return "unknown";
}
