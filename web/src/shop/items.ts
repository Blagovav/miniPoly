import type { ShopItem } from "../../../shared/types";

export const SHOP_ITEMS: ShopItem[] = [
  // ========== Tokens (фишки) ==========
  { id: "token-car",     kind: "token", name: { en: "Race Car",   ru: "Гонщик" },        price: 0,    icon: "🏎️" },
  { id: "token-dog",     kind: "token", name: { en: "Dog",        ru: "Пёс" },           price: 0,    icon: "🐕" },
  { id: "token-hat",     kind: "token", name: { en: "Top Hat",    ru: "Цилиндр" },       price: 0,    icon: "🎩" },
  { id: "token-cat",     kind: "token", name: { en: "Cat",        ru: "Кот" },           price: 0,    icon: "🐈" },
  // Originally "Crown" but no crown art existed — the figurine fell back
  // to the top-hat asset, visually duplicating `token-hat` in the lobby
  // picker. Renamed to Plane (matches the cosmetics.ts mapping) so the 6
  // free tokens have distinct silhouettes.
  { id: "token-crown",   kind: "token", name: { en: "Plane",      ru: "Самолёт" },       price: 0,    icon: "✈️" },
  { id: "token-ufo",     kind: "token", name: { en: "UFO",        ru: "НЛО" },           price: 0,    icon: "🛸" },

  { id: "token-rocket",  kind: "token", name: { en: "Rocket",     ru: "Ракета" },        price: 300,  icon: "🚀" },
  { id: "token-dragon",  kind: "token", name: { en: "Dragon",     ru: "Дракон" },        price: 800,  icon: "🐉", starsPrice: 50 },
  { id: "token-unicorn", kind: "token", name: { en: "Unicorn",    ru: "Единорог" },      price: 800,  icon: "🦄", starsPrice: 50 },
  { id: "token-panda",   kind: "token", name: { en: "Panda",      ru: "Панда" },         price: 400,  icon: "🐼" },
  { id: "token-fox",     kind: "token", name: { en: "Fox",        ru: "Лис" },           price: 400,  icon: "🦊" },
  { id: "token-tiger",   kind: "token", name: { en: "Tiger",      ru: "Тигр" },          price: 500,  icon: "🐯" },
  { id: "token-alien",   kind: "token", name: { en: "Alien",      ru: "Пришелец" },      price: 600,  icon: "👽" },
  { id: "token-robot",   kind: "token", name: { en: "Robot",      ru: "Робот" },         price: 700,  icon: "🤖" },
  { id: "token-ghost",   kind: "token", name: { en: "Ghost",      ru: "Призрак" },       price: 500,  icon: "👻" },
  { id: "token-ninja",   kind: "token", name: { en: "Ninja",      ru: "Ниндзя" },        price: 900,  icon: "🥷" },
  { id: "token-zombie",  kind: "token", name: { en: "Zombie",     ru: "Зомби" },         price: 600,  icon: "🧟" },
  { id: "token-vampire", kind: "token", name: { en: "Vampire",    ru: "Вампир" },        price: 1000, icon: "🧛" },
  { id: "token-wizard",  kind: "token", name: { en: "Wizard",     ru: "Маг" },           price: 1100, icon: "🧙", starsPrice: 75 },
  { id: "token-mermaid", kind: "token", name: { en: "Mermaid",    ru: "Русалка" },       price: 1100, icon: "🧜", starsPrice: 75 },
  { id: "token-octopus", kind: "token", name: { en: "Octopus",    ru: "Осьминог" },      price: 700,  icon: "🐙" },
  { id: "token-whale",   kind: "token", name: { en: "Whale",      ru: "Кит" },           price: 900,  icon: "🐳" },
  { id: "token-shark",   kind: "token", name: { en: "Shark",      ru: "Акула" },         price: 900,  icon: "🦈" },
  { id: "token-penguin", kind: "token", name: { en: "Penguin",    ru: "Пингвин" },       price: 400,  icon: "🐧" },
  { id: "token-owl",     kind: "token", name: { en: "Owl",        ru: "Сова" },          price: 500,  icon: "🦉" },
  { id: "token-lion",    kind: "token", name: { en: "Lion",       ru: "Лев" },           price: 800,  icon: "🦁" },
  { id: "token-gem",     kind: "token", name: { en: "Diamond",    ru: "Бриллиант" },     price: 2000, icon: "💎", starsPrice: 150 },
  { id: "token-pumpkin", kind: "token", name: { en: "Pumpkin",    ru: "Тыква" },         price: 400,  icon: "🎃" },
  { id: "token-santa",   kind: "token", name: { en: "Santa",      ru: "Дед Мороз" },     price: 600,  icon: "🎅" },
  { id: "token-mustache",kind: "token", name: { en: "Gentleman",  ru: "Джентельмен" },   price: 500,  icon: "🧔" },

  // ========== Themes (темы доски) ==========
  { id: "theme-classic", kind: "theme", name: { en: "Midnight",     ru: "Полночь" },       price: 0,    icon: "🌙" },
  { id: "theme-emerald", kind: "theme", name: { en: "Emerald",      ru: "Изумруд" },       price: 300,  icon: "💚" },
  { id: "theme-gold",    kind: "theme", name: { en: "Gold",          ru: "Золото" },        price: 800, icon: "💛" },
  { id: "theme-neon",    kind: "theme", name: { en: "Neon City",    ru: "Неон-сити" },     price: 1200, icon: "🌆" },
  { id: "theme-rose",    kind: "theme", name: { en: "Rose Quartz",  ru: "Розовый кварц" }, price: 600,  icon: "💗" },
  { id: "theme-ocean",   kind: "theme", name: { en: "Ocean Deep",   ru: "Глубокий океан" },price: 700,  icon: "🌊" },
  { id: "theme-sunset",  kind: "theme", name: { en: "Sunset",       ru: "Закат" },         price: 600,  icon: "🌅" },
  { id: "theme-forest",  kind: "theme", name: { en: "Forest",       ru: "Лес" },           price: 500,  icon: "🌲" },
  { id: "theme-cosmos",  kind: "theme", name: { en: "Cosmos",       ru: "Космос" },        price: 1500, icon: "🌌", starsPrice: 100 },
  { id: "theme-vapor",   kind: "theme", name: { en: "Vaporwave",    ru: "Вапорвэйв" },     price: 1800, icon: "🌴", starsPrice: 120 },

  // ========== Emotes ==========
  { id: "emote-fire",     kind: "emote", name: { en: "Fire",        ru: "Огонь" },          price: 50,  icon: "🔥" },
  { id: "emote-gg",       kind: "emote", name: { en: "GG",          ru: "GG" },             price: 50,  icon: "🤝" },
  { id: "emote-facepalm", kind: "emote", name: { en: "Facepalm",    ru: "Фейспалм" },       price: 100, icon: "🤦" },
  { id: "emote-money",    kind: "emote", name: { en: "Money",       ru: "Бабки" },          price: 150, icon: "💰" },
  { id: "emote-clown",    kind: "emote", name: { en: "Clown",       ru: "Клоун" },          price: 250, icon: "🤡" },
  { id: "emote-skull",    kind: "emote", name: { en: "Skull",       ru: "Черепушка" },      price: 100, icon: "💀" },
  { id: "emote-laugh",    kind: "emote", name: { en: "Laughing",    ru: "Угар" },           price: 50,  icon: "😂" },
  { id: "emote-crying",   kind: "emote", name: { en: "Crying",      ru: "Плачу" },          price: 50,  icon: "😭" },
  { id: "emote-salt",     kind: "emote", name: { en: "Salty",       ru: "Соль" },           price: 100, icon: "🧂" },
  { id: "emote-heart",    kind: "emote", name: { en: "Love",        ru: "Любовь" },         price: 50,  icon: "❤️" },
  { id: "emote-cheers",   kind: "emote", name: { en: "Cheers",      ru: "За победу" },      price: 100, icon: "🍻" },
  { id: "emote-explode",  kind: "emote", name: { en: "Exploded",    ru: "Взрыв мозга" },    price: 200, icon: "🤯" },
  { id: "emote-rage",     kind: "emote", name: { en: "Rage",        ru: "Ярость" },         price: 150, icon: "😡" },
  { id: "emote-sleep",    kind: "emote", name: { en: "Sleeping",    ru: "Спит" },           price: 100, icon: "😴" },
  { id: "emote-cool",     kind: "emote", name: { en: "Cool",        ru: "Крут" },           price: 150, icon: "😎" },
  { id: "emote-devil",    kind: "emote", name: { en: "Devil",       ru: "Злой" },           price: 200, icon: "😈" },
  { id: "emote-shock",    kind: "emote", name: { en: "Shocked",     ru: "Шок" },            price: 100, icon: "😱" },
  { id: "emote-hand-up",  kind: "emote", name: { en: "Victory",     ru: "Победа" },         price: 100, icon: "✊" },
  { id: "emote-rocket",   kind: "emote", name: { en: "To the moon", ru: "На Луну" },        price: 200, icon: "🚀" },
  { id: "emote-trophy",   kind: "emote", name: { en: "Trophy",      ru: "Чемпион" },        price: 300, icon: "🏆" },
];
