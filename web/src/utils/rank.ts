export interface Rank {
  id: string;
  label: string;
  icon: string;
  minWins: number;
  color: string;
}

export const RANKS: Rank[] = [
  { id: "peasant",  label: "Новичок",  icon: "🪶", minWins: 0,   color: "#94a3b8" },
  { id: "merchant", label: "Купец",    icon: "🪙", minWins: 1,   color: "#b8860b" },
  { id: "baron",    label: "Барон",    icon: "🛡️", minWins: 5,   color: "#14b8a6" },
  { id: "count",    label: "Граф",     icon: "⚔️", minWins: 15,  color: "#a855f7" },
  { id: "duke",     label: "Герцог",   icon: "👑", minWins: 40,  color: "#ec4899" },
  { id: "king",     label: "Король",   icon: "♛",  minWins: 100, color: "#fbbf24" },
];

export function computeRank(gamesWon: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (gamesWon >= r.minWins) current = r;
  }
  return current;
}

export function nextRank(gamesWon: number): Rank | null {
  const cur = computeRank(gamesWon);
  const idx = RANKS.findIndex((r) => r.id === cur.id);
  return RANKS[idx + 1] ?? null;
}
