/**
 * Cosmetic catalog driving the redesigned Shop screen
 * (Figma "Магазин" — node 100:10329 et al).
 *
 * Caps (Фишки) — 11 player tokens.
 * Maps (Карты) — 6 board variants.
 * Chests (Сундуки Удачи) — 1 hero item shown in "Все товары".
 *
 * The hardcoded entries below are the *seed/defaults*: they're what the
 * client renders on cold boot before /api/shop/catalog answers, and what
 * the API auto-seeds an empty DB with so admin edits can take it from
 * there. After `loadShopCatalog()` resolves, the live arrays are replaced
 * with whatever the admin has configured (caps/maps may add a new
 * `imageUrl` field, chest art uses `artClosed/artOpen/cardArt` URLs as
 * before). Arrays are reactive so any computed/template that iterates
 * them re-runs once the live data lands.
 */
import { reactive } from "vue";
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
  /** Admin-uploaded illustration URL. Currently informational — the cap
   *  figurine is rendered by `type` in CosmeticsCaps.vue, not by URL. */
  imageUrl?: string;
}

export interface MapEntry {
  id: string;
  type: MapType;
  rarity: Rarity;
  name: BiName;
  starsPrice?: number;
  /** Admin-uploaded illustration URL. Currently informational — the
   *  board theme is rendered by `type` in CosmeticsMaps.vue. */
  imageUrl?: string;
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
const DEFAULT_CAPS: CapEntry[] = [
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

const DEFAULT_MAPS: MapEntry[] = [
  { id: "map-classic",       type: "classic",       rarity: "common", name: { ru: "Классика",         en: "Classic" } },
  { id: "map-space-station", type: "space_station", rarity: "rare",   name: { ru: "Космическая станция", en: "Space Station" }, starsPrice: 79 },
  { id: "map-mars",          type: "mars",          rarity: "epic",   name: { ru: "Марс",             en: "Mars" },          starsPrice: 99 },
  { id: "map-amsterdam",     type: "amsterdam",     rarity: "rare",   name: { ru: "Амстердам",        en: "Amsterdam" },     starsPrice: 79 },
  { id: "map-london",        type: "london",        rarity: "rare",   name: { ru: "Лондон",           en: "London" },        starsPrice: 19 },
  { id: "map-tokio",         type: "tokio",         rarity: "rare",   name: { ru: "Токио",            en: "Tokyo" },         starsPrice: 19 },
];

const DEFAULT_CHESTS: ChestEntry[] = [
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

/** Live, reactive arrays. Components import these directly; iteration
 *  inside templates / computeds re-runs after `loadShopCatalog()` swaps
 *  contents in. Pre-load they hold the seeded defaults below so SSR or
 *  the first paint isn't blank. */
export const SHOP_CAPS: CapEntry[] = reactive([...DEFAULT_CAPS]);
export const SHOP_MAPS: MapEntry[] = reactive([...DEFAULT_MAPS]);
export const SHOP_CHESTS: ChestEntry[] = reactive([...DEFAULT_CHESTS]);

/** Legacy `token-*` ids predate the redesigned shop — map them to the
 *  closest cap figurine so existing inventories don't suddenly fall back
 *  to the default. `token-crown` originally fell back to "hat" because no
 *  crown asset existed, but that visually duplicated `token-hat` in the
 *  lobby's free-token picker (playtester: «дублирование фишек снизу»).
 *  Remapped to `plane` so all 6 free tokens have distinct silhouettes —
 *  matched up by the `Plane / Самолёт` rename in SHOP_ITEMS. */
const LEGACY_TOKEN_TO_CAP: Record<string, CapType> = {
  "token-car": "car",
  "token-dog": "dog",
  "token-hat": "hat",
  "token-cat": "cat",
  "token-ufo": "ufo",
  "token-crown": "plane",
};

/** Resolve any equipped-token id (`cap-*`, legacy `token-*`, or empty)
 *  to a CapType the board can render as the actual game piece. Unknown
 *  ids hash deterministically across the live caps so legacy premium
 *  tokens (e.g. `token-dragon`) still get a distinct stable figurine.
 *
 *  Reads SHOP_CAPS on every call so it picks up admin-edited caps after
 *  loadShopCatalog() — the array is tiny (≤ ~15 entries), so the linear
 *  scan is fine. */
export function capTypeFor(token: string | undefined | null): CapType {
  if (!token) return "car";
  for (const c of SHOP_CAPS) {
    if (c.id === token) return c.type;
  }
  if (LEGACY_TOKEN_TO_CAP[token]) return LEGACY_TOKEN_TO_CAP[token];
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  const types = SHOP_CAPS.map((c) => c.type);
  if (types.length === 0) return "car";
  return types[Math.abs(h) % types.length];
}

// ── Live catalog loader ───────────────────────────────────────────
//
// Fetches the admin-managed catalog and replaces the contents of the
// reactive arrays. Called once at app boot from main.ts. Failure (server
// down, network blip, ad-blocker) is non-fatal — the seeded defaults
// stay live so the shop still renders.

interface ApiCap {
  id: string;
  type: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  starsPrice: number | null;
  chestOnly: boolean;
  imageUrl: string | null;
}
interface ApiMap {
  id: string;
  type: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  starsPrice: number | null;
  imageUrl: string | null;
}
interface ApiChest {
  id: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  descriptionRu: string | null;
  descriptionEn: string | null;
  artClosed: string | null;
  artOpen: string | null;
  cardArt: string | null;
  setBonusMapId: string | null;
  defaultQtyIdx: number;
  prices: { qty: number; stars: number }[];
  drops: { capId: string; chance: number }[];
}

function apiCapToEntry(c: ApiCap): CapEntry {
  const e: CapEntry = {
    id: c.id,
    type: c.type as CapType,
    rarity: c.rarity,
    name: { ru: c.nameRu, en: c.nameEn },
  };
  if (c.starsPrice != null) e.starsPrice = c.starsPrice;
  if (c.chestOnly) e.chestOnly = true;
  if (c.imageUrl) e.imageUrl = c.imageUrl;
  return e;
}

function apiMapToEntry(m: ApiMap): MapEntry {
  const e: MapEntry = {
    id: m.id,
    type: m.type as MapType,
    rarity: m.rarity,
    name: { ru: m.nameRu, en: m.nameEn },
  };
  if (m.starsPrice != null) e.starsPrice = m.starsPrice;
  if (m.imageUrl) e.imageUrl = m.imageUrl;
  return e;
}

function apiChestToEntry(c: ApiChest): ChestEntry {
  // The shop chest preview chips show three sample cap types — pick the
  // first three drop entries, fall back to whatever's in SHOP_CAPS.
  const dropTypes: CapType[] = c.drops
    .map((d) => SHOP_CAPS.find((cap) => cap.id === d.capId)?.type)
    .filter((t): t is CapType => !!t);
  const contains = dropTypes.slice(0, 3);
  const containsExtra = Math.max(0, dropTypes.length - contains.length);
  const e: ChestEntry = {
    id: c.id,
    rarity: c.rarity,
    name: { ru: c.nameRu, en: c.nameEn },
    contains,
    containsExtra,
  };
  if (c.descriptionRu || c.descriptionEn) {
    e.description = { ru: c.descriptionRu ?? "", en: c.descriptionEn ?? "" };
  }
  if (c.artClosed) e.artClosed = c.artClosed;
  if (c.artOpen) e.artOpen = c.artOpen;
  if (c.cardArt) e.cardArt = c.cardArt;
  if (c.prices.length) e.pricesByQty = c.prices.map((p) => ({ qty: p.qty, stars: p.stars }));
  if (c.defaultQtyIdx) e.defaultQtyIdx = c.defaultQtyIdx;
  if (c.drops.length) e.items = c.drops.map((d) => ({ capId: d.capId, chance: d.chance }));
  if (c.setBonusMapId) e.setBonusMapId = c.setBonusMapId;
  return e;
}

let catalogLoaded = false;

/** Fetch the admin-managed catalog from /api/shop/catalog and replace
 *  the contents of the live reactive arrays in place. Idempotent —
 *  safe to call multiple times (e.g. after a focus event). */
export async function loadShopCatalog(): Promise<void> {
  try {
    const res = await fetch("/api/shop/catalog");
    if (!res.ok) return;
    const data = await res.json() as { caps?: ApiCap[]; maps?: ApiMap[]; chests?: ApiChest[] };

    if (Array.isArray(data.maps)) {
      const next = data.maps.map(apiMapToEntry);
      SHOP_MAPS.splice(0, SHOP_MAPS.length, ...next);
    }
    if (Array.isArray(data.caps)) {
      const next = data.caps.map(apiCapToEntry);
      SHOP_CAPS.splice(0, SHOP_CAPS.length, ...next);
    }
    // Chests last — apiChestToEntry reads SHOP_CAPS to resolve drop → type.
    if (Array.isArray(data.chests)) {
      const next = data.chests.map(apiChestToEntry);
      SHOP_CHESTS.splice(0, SHOP_CHESTS.length, ...next);
    }
    catalogLoaded = true;
  } catch {
    // Network failure — seeded defaults stay live, no UI breakage.
  }
}

export function isCatalogLoaded(): boolean {
  return catalogLoaded;
}
