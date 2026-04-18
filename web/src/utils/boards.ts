// 10 themed boards + rarity meta. Ported from design-ref/Mini Poly (5)/boards.js.

export type BoardRarity = "free" | "rare" | "epic" | "legendary";

export interface BoardPalette {
  bg: string;
  land: string;
  line: string;
  accent: string;
  water: string;
  gold: string;
  text?: string;
}

export interface BoardTiles {
  brown: string; teal: string; pink: string; orange: string;
  red: string; yellow: string; green: string; blue: string;
}

export interface BoardDef {
  id: string;
  name: string;
  ru: string;
  rarity: BoardRarity;
  price: number;
  unit?: "★" | "◈";
  owned?: boolean;
  desc: { en: string; ru: string };
  palette: BoardPalette;
  tiles: BoardTiles;
  dark?: boolean;
  border?: string;
}

// 10 скинов доски — классическая Монополия и города мира.
// id остаются прежними, чтобы не ломать сохранённые покупки / выбор в лобби.
// Палитры не трогаем — они уже подобраны под визуал. Меняем только name/ru/desc.
export const BOARDS: BoardDef[] = [
  { id: "eldmark", name: "Classic", ru: "Классика", rarity: "free", price: 0, owned: true,
    desc: { en: "The original Monopoly board. Familiar colors and streets.", ru: "Оригинальная доска Монополии. Знакомые цвета и улицы." },
    palette: { bg: "#f0e4c8", land: "#d9c79a", line: "#8a7152", accent: "#4a2e82", water: "#8fb8c8", gold: "#b8892e" },
    tiles: { brown: "#8b5a3c", teal: "#3a7a8a", pink: "#c17aa8", orange: "#c17a3a", red: "#9a3a3a", yellow: "#c9a84a", green: "#5a8a3a", blue: "#3a5a9a" } },
  { id: "silvermere", name: "London", ru: "Лондон", rarity: "rare", price: 800,
    desc: { en: "The foggy capital. Big Ben, red buses and the Thames.", ru: "Туманная столица. Биг-Бен, красные автобусы и Темза." },
    palette: { bg: "#e0e8ee", land: "#b8c8d4", line: "#4a6578", accent: "#2a5a8a", water: "#6a8fa8", gold: "#8a9fb0" },
    tiles: { brown: "#5a7590", teal: "#2a8a9a", pink: "#8a7aa8", orange: "#a8703a", red: "#8a3a5a", yellow: "#9a9a3a", green: "#4a7a6a", blue: "#2a4a7a" } },
  { id: "emberhold", name: "Tokyo", ru: "Токио", rarity: "rare", price: 950,
    desc: { en: "Neon metropolis. Shibuya crossings and skyscraper lights.", ru: "Неоновый мегаполис. Перекрёсток Сибуя и огни высоток." },
    palette: { bg: "#2a1810", land: "#4a2a1a", line: "#8a4a2a", accent: "#d4703a", water: "#6a2a1a", gold: "#e8a03a", text: "#f0d4a0" },
    tiles: { brown: "#6a3a1a", teal: "#c04a2a", pink: "#c07a5a", orange: "#e07a3a", red: "#c03030", yellow: "#e8a83a", green: "#8a6a2a", blue: "#8a4a6a" },
    dark: true },
  { id: "thornwood", name: "Amsterdam", ru: "Амстердам", rarity: "rare", price: 900,
    desc: { en: "City of canals and bikes. Green parks and cozy streets.", ru: "Город каналов и велосипедов. Зелёные парки и уютные улочки." },
    palette: { bg: "#e8e4d0", land: "#c8d4b0", line: "#4a6a3a", accent: "#2a6a3a", water: "#6a9a7a", gold: "#a8a03a" },
    tiles: { brown: "#6a4a2a", teal: "#3a8a6a", pink: "#a86a8a", orange: "#c08a3a", red: "#8a3a2a", yellow: "#b8a82a", green: "#4a7a2a", blue: "#3a5a6a" } },
  { id: "frostpeak", name: "Stockholm", ru: "Стокгольм", rarity: "epic", price: 15, unit: "★",
    desc: { en: "The Nordic capital. Snowy squares and icy fjords.", ru: "Северная столица. Снежные площади и ледяные фьорды." },
    palette: { bg: "#eaf0f5", land: "#c8d8e4", line: "#5a7890", accent: "#5a8ab8", water: "#8ab0c8", gold: "#b8c0d0" },
    tiles: { brown: "#6a7a8a", teal: "#3aa0b0", pink: "#a8a0c8", orange: "#9a8a7a", red: "#8a5a7a", yellow: "#b8b8a0", green: "#5a8a8a", blue: "#4a7aa8" } },
  { id: "scarletmarch", name: "Rome", ru: "Рим", rarity: "epic", price: 18, unit: "★",
    desc: { en: "The eternal city. Red rooftops, the Colosseum and piazzas.", ru: "Вечный город. Красные черепицы, Колизей и пьяцца." },
    palette: { bg: "#f0dcd0", land: "#d8a898", line: "#6a2a2a", accent: "#9a1c3a", water: "#a87878", gold: "#c08a2a" },
    tiles: { brown: "#7a3a2a", teal: "#8a4a4a", pink: "#b85a7a", orange: "#c0602a", red: "#a81c2a", yellow: "#c89a2a", green: "#6a7a3a", blue: "#6a3a6a" } },
  { id: "goldensteppe", name: "Dubai", ru: "Дубай", rarity: "epic", price: 20, unit: "★",
    desc: { en: "Desert metropolis. Gold skyscrapers and yachts by the shore.", ru: "Пустынный мегаполис. Золотые небоскрёбы и яхты у берега." },
    palette: { bg: "#f8ecc0", land: "#e8c878", line: "#8a6a2a", accent: "#d08a1a", water: "#c8a868", gold: "#e8a020" },
    tiles: { brown: "#8a5a2a", teal: "#d09a3a", pink: "#c88a5a", orange: "#e07a2a", red: "#a83a2a", yellow: "#f0b820", green: "#8a8a2a", blue: "#6a7a4a" } },
  { id: "moonspire", name: "Hong Kong", ru: "Гонконг", rarity: "legendary", price: 40, unit: "★",
    desc: { en: "The city of fire. Neon harbours and rooftop races.", ru: "Город-огонь. Подсвеченные бухты и гонки на крышах." },
    palette: { bg: "#1a1832", land: "#2a2a4a", line: "#6a5aa0", accent: "#a878e0", water: "#4a4a7a", gold: "#d4b0e8", text: "#ead8f0" },
    tiles: { brown: "#5a4a6a", teal: "#4a90c0", pink: "#c080e0", orange: "#c07a90", red: "#a04870", yellow: "#e0c870", green: "#6a9a8a", blue: "#5a6ac0" },
    dark: true },
  { id: "dragonreach", name: "Shanghai", ru: "Шанхай", rarity: "legendary", price: 45, unit: "★",
    desc: { en: "Eastern metropolis. Red lanterns and the Bund promenade.", ru: "Восточный мегаполис. Красные фонари и набережная Бунд." },
    palette: { bg: "#1a0808", land: "#2a1010", line: "#a03030", accent: "#e8a020", water: "#3a1818", gold: "#f0c040", text: "#f0d8a0" },
    tiles: { brown: "#6a2a1a", teal: "#8a2a3a", pink: "#c85070", orange: "#e06020", red: "#e02020", yellow: "#f0c020", green: "#8a6a2a", blue: "#5a2a4a" },
    dark: true },
  { id: "sunderhall", name: "Las Vegas", ru: "Лас-Вегас", rarity: "legendary", price: 50, unit: "★",
    desc: { en: "City of casinos and neon. Loud, bright, and never asleep.", ru: "Город казино и неона. Яркий, громкий и никогда не спит." },
    palette: { bg: "#e8dcc0", land: "#d0b898", line: "#7a4a8a", accent: "#6a3a9a", water: "#8a8ac0", gold: "#c0a040" },
    tiles: { brown: "#7a5a3a", teal: "#4a8ac0", pink: "#c060a0", orange: "#d08a3a", red: "#a03060", yellow: "#d0b030", green: "#6a9a4a", blue: "#4a4aa0" },
    border: "arcane" },
];

export const RARITY_META: Record<BoardRarity, { en: string; ru: string; color: string }> = {
  free:      { en: "Included",  ru: "Доступна",  color: "var(--ink-3)" },
  rare:      { en: "Rare",      ru: "Редкая",    color: "var(--primary)" },
  epic:      { en: "Epic",      ru: "Эпическая", color: "#9a3aa3" },
  legendary: { en: "Legendary", ru: "Легенда",   color: "var(--gold)" },
};

export function findBoard(id: string | null | undefined): BoardDef {
  return BOARDS.find((b) => b.id === id) ?? BOARDS[0];
}
