import { watch } from "vue";
import { useInventoryStore } from "../stores/inventory";

interface ThemeColors {
  accent: string;
  gold: string;
  bg0: string;
  bg1: string;
  // Board-specific
  boardFrom: string; // центр радиального градиента доски
  boardTo: string; // край
  tileBg: string; // базовый фон клетки
  centerGlow: string; // свечение центра доски
}

const THEMES: Record<string, ThemeColors> = {
  "theme-classic": {
    accent: "#a855f7", gold: "#fbbf24",
    bg0: "#05070f", bg1: "#0a0e1a",
    boardFrom: "rgba(22, 28, 45, 0.9)", boardTo: "rgba(5, 7, 15, 0.95)",
    tileBg: "rgba(12, 17, 33, 0.85)",
    centerGlow: "rgba(168, 85, 247, 0.08)",
  },
  "theme-emerald": {
    accent: "#10b981", gold: "#fbbf24",
    bg0: "#031c12", bg1: "#052e1f",
    boardFrom: "rgba(6, 47, 32, 0.9)", boardTo: "rgba(3, 18, 12, 0.95)",
    tileBg: "rgba(8, 35, 24, 0.85)",
    centerGlow: "rgba(16, 185, 129, 0.12)",
  },
  "theme-gold": {
    accent: "#f59e0b", gold: "#fcd34d",
    bg0: "#1a1003", bg1: "#2a1b00",
    boardFrom: "rgba(56, 35, 5, 0.92)", boardTo: "rgba(20, 12, 0, 0.96)",
    tileBg: "rgba(38, 24, 5, 0.88)",
    centerGlow: "rgba(245, 158, 11, 0.14)",
  },
  "theme-neon": {
    accent: "#ec4899", gold: "#22d3ee",
    bg0: "#0a0020", bg1: "#1a0033",
    boardFrom: "rgba(35, 10, 70, 0.92)", boardTo: "rgba(10, 0, 32, 0.96)",
    tileBg: "rgba(25, 10, 50, 0.85)",
    centerGlow: "rgba(236, 72, 153, 0.14)",
  },
  "theme-rose": {
    accent: "#f472b6", gold: "#fbbf24",
    bg0: "#1a0512", bg1: "#2a0e1e",
    boardFrom: "rgba(55, 15, 40, 0.92)", boardTo: "rgba(20, 5, 15, 0.96)",
    tileBg: "rgba(40, 10, 28, 0.85)",
    centerGlow: "rgba(244, 114, 182, 0.14)",
  },
  "theme-ocean": {
    accent: "#0ea5e9", gold: "#fbbf24",
    bg0: "#020a18", bg1: "#04182b",
    boardFrom: "rgba(6, 40, 65, 0.92)", boardTo: "rgba(2, 12, 24, 0.96)",
    tileBg: "rgba(6, 30, 50, 0.85)",
    centerGlow: "rgba(14, 165, 233, 0.14)",
  },
  "theme-sunset": {
    accent: "#f97316", gold: "#fde047",
    bg0: "#1a0700", bg1: "#2b0f00",
    boardFrom: "rgba(60, 25, 8, 0.92)", boardTo: "rgba(22, 8, 0, 0.96)",
    tileBg: "rgba(42, 18, 5, 0.85)",
    centerGlow: "rgba(249, 115, 22, 0.14)",
  },
  "theme-forest": {
    accent: "#16a34a", gold: "#a3e635",
    bg0: "#020d06", bg1: "#031a0d",
    boardFrom: "rgba(10, 42, 22, 0.92)", boardTo: "rgba(2, 14, 8, 0.96)",
    tileBg: "rgba(8, 28, 16, 0.85)",
    centerGlow: "rgba(22, 163, 74, 0.14)",
  },
  "theme-cosmos": {
    accent: "#8b5cf6", gold: "#f472b6",
    bg0: "#05020e", bg1: "#0a0416",
    boardFrom: "rgba(28, 12, 60, 0.92)", boardTo: "rgba(8, 4, 20, 0.96)",
    tileBg: "rgba(20, 10, 42, 0.85)",
    centerGlow: "rgba(139, 92, 246, 0.16)",
  },
  "theme-vapor": {
    accent: "#ec4899", gold: "#06b6d4",
    bg0: "#0c0220", bg1: "#1a0530",
    boardFrom: "rgba(45, 12, 70, 0.92)", boardTo: "rgba(14, 4, 36, 0.96)",
    tileBg: "rgba(30, 10, 55, 0.85)",
    centerGlow: "rgba(6, 182, 212, 0.16)",
  },
};

export function useTheme() {
  const inv = useInventoryStore();

  function apply(themeId: string) {
    const t = THEMES[themeId] ?? THEMES["theme-classic"];
    const r = document.documentElement.style;
    r.setProperty("--purple", t.accent);
    r.setProperty("--gold", t.gold);
    r.setProperty("--bg-0", t.bg0);
    r.setProperty("--bg-1", t.bg1);
    r.setProperty("--board-from", t.boardFrom);
    r.setProperty("--board-to", t.boardTo);
    r.setProperty("--tile-bg", t.tileBg);
    r.setProperty("--center-glow", t.centerGlow);
  }

  watch(
    () => inv.equippedTheme,
    (id) => apply(id),
    { immediate: true },
  );
}
