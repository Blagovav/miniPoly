// Ported from design-ref/components.v3.jsx

export const GROUP_COLORS = {
  brown: "var(--g-brown)",
  teal: "var(--g-teal)",
  pink: "var(--g-pink)",
  orange: "var(--g-orange)",
  red: "var(--g-red)",
  yellow: "var(--g-yellow)",
  green: "var(--g-green)",
  blue: "var(--g-blue)",
  lightBlue: "var(--g-teal)",
  darkBlue: "var(--g-blue)",
} as const;

export const PLAYER_COLORS = {
  you: "#8b1a1a",
  elara: "#c07028",
  magnus: "#2d7a4f",
  lady: "#5a3a9a",
  oren: "#3a7a8a",
  finn: "#b8892e",
} as const;

// Deterministic color for a player by index (mapped to the 6 medieval player hues)
export const ORDERED_PLAYER_COLORS: string[] = [
  PLAYER_COLORS.you,
  PLAYER_COLORS.magnus,
  PLAYER_COLORS.lady,
  PLAYER_COLORS.elara,
  PLAYER_COLORS.oren,
  PLAYER_COLORS.finn,
];

// Bright, distinct backgrounds for bot avatar circles. The teal (#31e4c9)
// is the canonical one from the designer's Figma; the rest mirror its
// saturation/brightness so any bot in a roster reads as a friendly mascot.
export const BOT_AVATAR_COLORS: string[] = [
  "#31e4c9", // mint/teal
  "#ffb648", // amber
  "#ff7aa8", // pink
  "#7ec8ff", // sky
  "#b48cff", // lavender
  "#9be072", // lime
];

// Stable hash → BOT_AVATAR_COLORS index. Same bot name (or id) always
// gets the same background, so a returning bot looks consistent across
// rejoins and across the lobby/in-game views.
export function botAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return BOT_AVATAR_COLORS[Math.abs(h) % BOT_AVATAR_COLORS.length];
}

export function lighten(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const factor = amt >= 0 ? amt : 0;
  const dark = amt < 0 ? -amt : 0;
  r = Math.min(255, Math.round(r + (255 - r) * factor));
  g = Math.min(255, Math.round(g + (255 - g) * factor));
  b = Math.min(255, Math.round(b + (255 - b) * factor));
  if (dark > 0) {
    r = Math.max(0, Math.round(r * (1 - dark)));
    g = Math.max(0, Math.round(g * (1 - dark)));
    b = Math.max(0, Math.round(b * (1 - dark)));
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// Map shop-item id → heraldic TokenArt id. Cycles through 8 heraldic pieces
// so every in-game token (car/dog/dragon/etc.) gets a medieval statuette.
const TOKEN_ART_ORDER = [
  "knight", "shield", "tower", "crown",
  "griffin", "wyrm", "dragon", "phoenix",
] as const;

export function tokenArtFor(shopItemId: string): typeof TOKEN_ART_ORDER[number] {
  // Stable hash by id so same token always maps to same heraldic art.
  let h = 0;
  for (let i = 0; i < shopItemId.length; i++) h = (h * 31 + shopItemId.charCodeAt(i)) | 0;
  return TOKEN_ART_ORDER[Math.abs(h) % TOKEN_ART_ORDER.length];
}
