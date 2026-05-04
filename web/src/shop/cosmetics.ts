/**
 * Cosmetic catalog driving the redesigned Shop screen
 * (Figma "Магазин" — node 100:10329 et al).
 *
 * Caps (Фишки) — 11 player tokens.
 * Maps (Карты) — 6 board variants.
 * Chests (Сундуки Удачи) — 1 hero item shown in "Все товары".
 *
 * Every item references the inventory store via `id`. Pricing and rarity
 * are inlined here; once production data is settled, this file can be
 * generated from the same source as SHOP_ITEMS.
 */
import type { CapType } from "../components/CosmeticsCaps.vue";
import type { MapType } from "../components/CosmeticsMaps.vue";
import type { Rarity } from "../components/RarityGlow.vue";

export interface BiName { en: string; ru: string }

export interface CapEntry {
  id: string;
  type: CapType;
  rarity: Rarity;
  name: BiName;
  /** Star price for premium caps; undefined → free / coin-based / chest-only. */
  starsPrice?: number;
  /** True if cap can only be unlocked via a chest, not direct purchase. */
  chestOnly?: boolean;
}

export interface MapEntry {
  id: string;
  type: MapType;
  rarity: Rarity;
  name: BiName;
  starsPrice?: number;
}

export interface ChestEntry {
  id: string;
  rarity: Rarity;
  name: BiName;
  /** Sample of cap/map types shown as preview chips on the chest card. */
  contains: CapType[];
  containsExtra: number;
  /** Short blurb shown in the open-chest modal under the title. */
  description?: BiName;
  /** Path to the closed-chest illustration (192×192 webp). */
  artClosed?: string;
  /** Path to the open-chest illustration with light rays (covers ~268×192). */
  artOpen?: string;
  /** Path to the marketing-style preview composition shown ONLY on the
   *  shop card (closed chest + floating cap figurines + halo). The modal
   *  hero keeps using artClosed/artOpen so its details/result states stay
   *  semantic. Falls back to artClosed when not set. */
  cardArt?: string;
  /** Quantity options + Star price for each. */
  pricesByQty?: { qty: number; stars: number }[];
  /** Default selected qty in the modal — index into pricesByQty. */
  defaultQtyIdx?: number;
  /** Cap items inside this chest with the chance to roll each. Sum can be
   *  ≤ 100% — leftover rolls re-roll until a cap drops. */
  items?: { capId: string; chance: number }[];
  /** Map id awarded when the user has collected ALL `items` (set-bonus). */
  setBonusMapId?: string;
}

/** Order matters — drives default grid order in the shop. */
export const SHOP_CAPS: readonly CapEntry[] = [
  { id: "cap-plane",   type: "plane",   rarity: "common",  name: { ru: "Самолёт",          en: "Plane" },        starsPrice: 19 },
  { id: "cap-ship",    type: "ship",    rarity: "rare",    name: { ru: "Лайнер",           en: "Liner" } },
  { id: "cap-car",     type: "car",     rarity: "epic",    name: { ru: "Классическое авто", en: "Classic Car" } },
  { id: "cap-hat",     type: "hat",     rarity: "exotic",  name: { ru: "Мини-шляпа",       en: "Top Hat" },      chestOnly: true },
  { id: "cap-cat",     type: "cat",     rarity: "epic",    name: { ru: "Котик",            en: "Kitty" },        chestOnly: true },
  { id: "cap-dog",     type: "dog",     rarity: "rare",    name: { ru: "Пёс",              en: "Dog" },          chestOnly: true },
  { id: "cap-ufo",     type: "ufo",     rarity: "epic",    name: { ru: "НЛО",              en: "UFO" } },
  { id: "cap-robot",   type: "robot",   rarity: "rare",    name: { ru: "Робот",            en: "Robot" },        starsPrice: 39 },
  { id: "cap-balloon", type: "balloon", rarity: "exotic",  name: { ru: "Воздушный шар",    en: "Balloon" },      starsPrice: 79 },
  { id: "cap-dyno",    type: "dyno",    rarity: "epic",    name: { ru: "Дино",             en: "Dyno" } },
  { id: "cap-duck",    type: "duck",    rarity: "epic",    name: { ru: "Утёнок",           en: "Duckling" },     chestOnly: true },
];

export const SHOP_MAPS: readonly MapEntry[] = [
  { id: "map-classic",       type: "classic",       rarity: "common", name: { ru: "Классика",         en: "Classic" } },
  { id: "map-space-station", type: "space_station", rarity: "rare",   name: { ru: "Космическая станция", en: "Space Station" }, starsPrice: 79 },
  { id: "map-mars",          type: "mars",          rarity: "epic",   name: { ru: "Марс",             en: "Mars" },          starsPrice: 99 },
  { id: "map-amsterdam",     type: "amsterdam",     rarity: "rare",   name: { ru: "Амстердам",        en: "Amsterdam" },     starsPrice: 79 },
  { id: "map-london",        type: "london",        rarity: "rare",   name: { ru: "Лондон",           en: "London" },        starsPrice: 19 },
  { id: "map-tokio",         type: "tokio",         rarity: "rare",   name: { ru: "Токио",            en: "Tokyo" },         starsPrice: 19 },
];

export const SHOP_CHESTS: readonly ChestEntry[] = [
  {
    id: "chest-business",
    rarity: "exotic",
    name: { ru: "Бизнес-Сундук", en: "Business Chest" },
    description: {
      ru: "Откройте сундук и получите редкую фишку. Соберите все, чтобы получить эксклюзивную карту.",
      en: "Open the chest to claim a rare token. Collect them all to unlock an exclusive map.",
    },
    contains: ["hat", "cat", "ufo"],
    containsExtra: 3,
    /* The asset filenames were named opposite to what they depict —
     * "business-closed.webp" is a wide-open chest with light beam,
     * and "business-open.webp" is the locked/closed chest. We map
     * them by their actual visuals: the shop card + modal-details
     * show the locked chest (haven't opened yet), and the modal-result
     * state reveals the beaming chest. */
    artClosed: "/figma/shop/chests/business-open.webp",
    artOpen: "/figma/shop/chests/business-closed.webp",
    cardArt: "/figma/shop/chests/business-preview.webp",
    pricesByQty: [
      { qty: 1, stars: 299 },
      { qty: 3, stars: 799 },
      { qty: 6, stars: 1499 },
    ],
    defaultQtyIdx: 0,
    items: [
      { capId: "cap-cat",  chance: 30 },
      { capId: "cap-ufo",  chance: 25 },
      { capId: "cap-dyno", chance: 20 },
      { capId: "cap-duck", chance: 15 },
      { capId: "cap-hat",  chance: 10 },
    ],
    setBonusMapId: "map-space-station",
  },
];

export type RarityKey = Rarity;

export const RARITY_LABEL_RU: Record<Rarity, string> = {
  common: "Обычный",
  rare:   "Редкий",
  epic:   "Эпический",
  exotic: "Экзотический",
};

export const RARITY_LABEL_EN: Record<Rarity, string> = {
  common: "Common",
  rare:   "Rare",
  epic:   "Epic",
  exotic: "Exotic",
};

export const RARITY_BADGE_BG: Record<Rarity, string> = {
  common: "#8d8d8d",
  rare:   "#357ddb",
  epic:   "#dd43c8",
  exotic: "#db3535",
};

const CAP_BY_ID = new Map<string, CapEntry>(SHOP_CAPS.map((c) => [c.id, c]));

/** Legacy `token-*` ids predate the redesigned shop — map them to the
 *  closest cap figurine so existing inventories don't suddenly fall back
 *  to the default. `token-crown` had no direct equivalent; the hat reads
 *  as the closest "fancy/regal" piece. */
const LEGACY_TOKEN_TO_CAP: Record<string, CapType> = {
  "token-car": "car",
  "token-dog": "dog",
  "token-hat": "hat",
  "token-cat": "cat",
  "token-ufo": "ufo",
  "token-crown": "hat",
};

const ALL_CAP_TYPES: readonly CapType[] = SHOP_CAPS.map((c) => c.type);

/** Resolve any equipped-token id (`cap-*`, legacy `token-*`, or empty)
 *  to a CapType the board can render as the actual game piece. Unknown
 *  ids hash deterministically across the 11 caps so legacy premium
 *  tokens (e.g. `token-dragon`) still get a distinct stable figurine. */
export function capTypeFor(token: string | undefined | null): CapType {
  if (!token) return "car";
  if (CAP_BY_ID.has(token)) return CAP_BY_ID.get(token)!.type;
  if (LEGACY_TOKEN_TO_CAP[token]) return LEGACY_TOKEN_TO_CAP[token];
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  return ALL_CAP_TYPES[Math.abs(h) % ALL_CAP_TYPES.length];
}
