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
    contains: ["hat", "cat", "ship", "ufo"],
    containsExtra: 7,
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
