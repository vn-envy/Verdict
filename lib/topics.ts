// Curated interest packs for Path 2 (the curious user). Static for now; promoted to a
// backend GET /api/topics endpoint in Phase 5. Each topic is either a cached ARCHIVE replay
// (one of the house-case tapes) or a LIVE custom-claim deliberation.

export type Interest =
  | "TECH_AI" | "POLITICS" | "ECONOMY" | "SCIENCE" | "SPORTS" | "CULTURE" | "HEALTH" | "CLIMATE";

export const INTERESTS: { id: Interest; label: string; icon: string }[] = [
  { id: "TECH_AI", label: "Tech / AI", icon: "smart_toy" },
  { id: "POLITICS", label: "Politics", icon: "gavel" },
  { id: "ECONOMY", label: "Economy", icon: "monitoring" },
  { id: "SCIENCE", label: "Science", icon: "science" },
  { id: "HEALTH", label: "Health", icon: "cardiology" },
  { id: "CLIMATE", label: "Climate", icon: "eco" },
  { id: "CULTURE", label: "Culture", icon: "theater_comedy" },
  { id: "SPORTS", label: "Sports", icon: "sports_score" },
];

export interface Topic {
  id: string;
  claim: string;
  interests: Interest[];
  mode: "replay" | "live";
  caseKey?: string;   // replay tape key (A/B/C)
  tag: string;        // short descriptor shown on the card
  hot?: boolean;      // surfaced as "hot" in the feed
}

export const TOPICS: Topic[] = [
  // --- Cached archive runs (instant, no spend) ---
  { id: "arc-C", claim: "Tariffs lower domestic prices for consumers.", interests: ["ECONOMY", "POLITICS"], mode: "replay", caseKey: "C", tag: "Trade policy", hot: true },
  { id: "arc-A", claim: "Dynamic 'surge' pricing for 2026 World Cup tickets is fair to fans.", interests: ["SPORTS", "ECONOMY"], mode: "replay", caseKey: "A", tag: "Markets & fairness" },
  { id: "arc-B", claim: "A one-time 50% wealth tax on AI companies would benefit the public.", interests: ["TECH_AI", "ECONOMY", "POLITICS"], mode: "replay", caseKey: "B", tag: "AI policy", hot: true },

  // --- Live deliberations (custom claims; grounded once Phase 4 lands) ---
  { id: "liv-1", claim: "AI coding assistants make senior engineers more productive, not less.", interests: ["TECH_AI"], mode: "live", tag: "Developer productivity" },
  { id: "liv-2", claim: "Nuclear power is essential to reaching net-zero by 2050.", interests: ["CLIMATE", "SCIENCE"], mode: "live", tag: "Energy transition", hot: true },
  { id: "liv-3", claim: "Social-media bans for under-16s improve teen mental health.", interests: ["HEALTH", "CULTURE", "POLITICS"], mode: "live", tag: "Youth & platforms" },
  { id: "liv-4", claim: "Electric vehicles are already cheaper to own than gas cars.", interests: ["CLIMATE", "ECONOMY"], mode: "live", tag: "Total cost of ownership" },
  { id: "liv-5", claim: "Universal basic income reduces the incentive to work.", interests: ["ECONOMY", "POLITICS"], mode: "live", tag: "Welfare design" },
  { id: "liv-6", claim: "Generative AI will create more jobs than it destroys.", interests: ["TECH_AI", "ECONOMY"], mode: "live", tag: "Labor markets", hot: true },
  { id: "liv-7", claim: "Ultra-processed foods are the primary driver of the obesity epidemic.", interests: ["HEALTH", "SCIENCE"], mode: "live", tag: "Nutrition science" },
  { id: "liv-8", claim: "Hosting a World Cup delivers net economic benefit to the host nation.", interests: ["SPORTS", "ECONOMY"], mode: "live", tag: "Mega-events" },
];

export function topicsFor(selected: Interest[]): Topic[] {
  if (selected.length === 0) return TOPICS;
  const set = new Set(selected);
  return TOPICS.filter((t) => t.interests.some((i) => set.has(i)));
}
