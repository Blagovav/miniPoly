import type { I18nText } from "./types";

export type CardEffect =
  | { kind: "cash"; amount: number } // +/- cash
  | { kind: "advance"; to: number; collectGo?: boolean } // move to tile index
  | { kind: "back"; steps: number } // move back N
  | { kind: "jail" } // send to jail
  | { kind: "getOutCard" } // get-out-of-jail-free
  | { kind: "payEach"; amount: number } // pay each player
  | { kind: "collectEach"; amount: number } // collect from each
  | { kind: "repairs"; perHouse: number; perHotel: number }
  | { kind: "nearestRailroad"; double?: boolean } // advance to nearest RR
  | { kind: "nearestUtility" }; // advance to nearest utility

export interface CardDef {
  id: string;
  text: I18nText;
  effect: CardEffect;
}

/** Chance — 16 cards (как Hasbro). */
export const CHANCE_CARDS: CardDef[] = [
  {
    id: "ch-go",
    text: { en: "Advance to GO (collect $200)", ru: "Иди на СТАРТ (получи $200)" },
    effect: { kind: "advance", to: 0, collectGo: true },
  },
  {
    id: "ch-illinois",
    text: { en: "Advance to Illinois Ave", ru: "На Иллинойс-авеню" },
    effect: { kind: "advance", to: 24, collectGo: true },
  },
  {
    id: "ch-stcharles",
    text: { en: "Advance to St. Charles Place", ru: "На Сент-Чарлз Плейс" },
    effect: { kind: "advance", to: 11, collectGo: true },
  },
  {
    id: "ch-boardwalk",
    text: { en: "Take a trip to Boardwalk", ru: "Ступай на Бродвок" },
    effect: { kind: "advance", to: 39, collectGo: true },
  },
  {
    id: "ch-reading",
    text: { en: "Take a trip to Reading Railroad", ru: "Поездом Рединг" },
    effect: { kind: "advance", to: 5, collectGo: true },
  },
  {
    id: "ch-back3",
    text: { en: "Go back 3 spaces", ru: "Назад 3 клетки" },
    effect: { kind: "back", steps: 3 },
  },
  {
    id: "ch-jail",
    text: { en: "Go directly to Jail", ru: "Прямиком в тюрьму" },
    effect: { kind: "jail" },
  },
  {
    id: "ch-dividend",
    text: { en: "Bank pays dividend $50", ru: "Банк платит $50" },
    effect: { kind: "cash", amount: 50 },
  },
  {
    id: "ch-gooj",
    text: { en: "Get Out of Jail Free", ru: "Выход из тюрьмы бесплатно" },
    effect: { kind: "getOutCard" },
  },
  {
    id: "ch-loan",
    text: { en: "Building loan matures: collect $150", ru: "Кредит закрыт: получи $150" },
    effect: { kind: "cash", amount: 150 },
  },
  {
    id: "ch-speeding",
    text: { en: "Speeding fine $15", ru: "Штраф за превышение $15" },
    effect: { kind: "cash", amount: -15 },
  },
  {
    id: "ch-chairman",
    text: { en: "Elected Chairman: pay each player $50", ru: "Избран председателем: заплати всем по $50" },
    effect: { kind: "payEach", amount: 50 },
  },
  {
    id: "ch-crossword",
    text: { en: "You won crossword competition: collect $100", ru: "Выиграл кроссворд: получи $100" },
    effect: { kind: "cash", amount: 100 },
  },
  {
    id: "ch-repairs",
    text: { en: "Make repairs: $25/house, $100/hotel", ru: "Ремонт: $25/дом, $100/отель" },
    effect: { kind: "repairs", perHouse: 25, perHotel: 100 },
  },
  {
    id: "ch-nearest-rr",
    text: { en: "Advance to nearest Railroad (pay 2x)", ru: "К ближайшей ж/д (аренда ×2)" },
    effect: { kind: "nearestRailroad", double: true },
  },
  {
    id: "ch-nearest-ut",
    text: { en: "Advance to nearest Utility", ru: "К ближайшей инфраструктуре" },
    effect: { kind: "nearestUtility" },
  },
];

/** Community Chest — 16 cards. */
export const CHEST_CARDS: CardDef[] = [
  {
    id: "cc-go",
    text: { en: "Advance to GO (collect $200)", ru: "На СТАРТ (получи $200)" },
    effect: { kind: "advance", to: 0, collectGo: true },
  },
  {
    id: "cc-bank-error",
    text: { en: "Bank error in your favor: collect $200", ru: "Банк ошибся в твою пользу: получи $200" },
    effect: { kind: "cash", amount: 200 },
  },
  {
    id: "cc-doctor",
    text: { en: "Doctor's fee: pay $50", ru: "Врач: заплати $50" },
    effect: { kind: "cash", amount: -50 },
  },
  {
    id: "cc-stock",
    text: { en: "Sale of stock: collect $50", ru: "Продал акции: получи $50" },
    effect: { kind: "cash", amount: 50 },
  },
  {
    id: "cc-gooj",
    text: { en: "Get Out of Jail Free", ru: "Выход из тюрьмы бесплатно" },
    effect: { kind: "getOutCard" },
  },
  {
    id: "cc-jail",
    text: { en: "Go directly to Jail", ru: "В тюрьму" },
    effect: { kind: "jail" },
  },
  {
    id: "cc-holiday",
    text: { en: "Holiday fund matures: collect $100", ru: "Отпускной фонд: получи $100" },
    effect: { kind: "cash", amount: 100 },
  },
  {
    id: "cc-tax-refund",
    text: { en: "Income tax refund: collect $20", ru: "Возврат налога: получи $20" },
    effect: { kind: "cash", amount: 20 },
  },
  {
    id: "cc-birthday",
    text: { en: "Birthday! Each player gives you $10", ru: "Твой ДР! Каждый даёт $10" },
    effect: { kind: "collectEach", amount: 10 },
  },
  {
    id: "cc-insurance",
    text: { en: "Life insurance: collect $100", ru: "Страховка: получи $100" },
    effect: { kind: "cash", amount: 100 },
  },
  {
    id: "cc-hospital",
    text: { en: "Hospital fees: pay $100", ru: "Больница: $100" },
    effect: { kind: "cash", amount: -100 },
  },
  {
    id: "cc-school",
    text: { en: "School fees: pay $50", ru: "Школа: $50" },
    effect: { kind: "cash", amount: -50 },
  },
  {
    id: "cc-consultancy",
    text: { en: "Consultancy fee: collect $25", ru: "Консалтинг: получи $25" },
    effect: { kind: "cash", amount: 25 },
  },
  {
    id: "cc-street-repairs",
    text: { en: "Street repairs: $40/house, $115/hotel", ru: "Ремонт улиц: $40/дом, $115/отель" },
    effect: { kind: "repairs", perHouse: 40, perHotel: 115 },
  },
  {
    id: "cc-beauty",
    text: { en: "Won beauty contest: $10", ru: "Победил на конкурсе красоты: $10" },
    effect: { kind: "cash", amount: 10 },
  },
  {
    id: "cc-inherit",
    text: { en: "Inheritance: $100", ru: "Наследство: $100" },
    effect: { kind: "cash", amount: 100 },
  },
];
