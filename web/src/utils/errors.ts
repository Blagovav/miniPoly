// Человеко-читаемый перевод технических server-error строк.
// Сервер шлёт короткие английские коды вроде "wrong phase", "not enough cash".
// Мапим их в RU/EN понятные фразы. Если кода нет в словаре — показываем как есть.

type Locale = "ru" | "en";

const DICT_RU: Record<string, string> = {
  "no player": "Игрок не найден",
  "not in jail": "Ты не в тюрьме",
  "not your turn": "Сейчас не твой ход",
  "wrong phase": "Сейчас не то время для этого действия",
  "not enough cash": "Недостаточно денег",
  "no jail card": "Нет карты освобождения",
  "not a street": "Это не улица",
  "not your property": "Это не твоя собственность",
  "mortgaged": "Участок заложен",
  "hotel already": "Отель уже построен",
  "need monopoly": "Нужна монополия (все участки цвета)",
  "build evenly": "Строй равномерно по группе",
  "sell evenly": "Продавай равномерно",
  "nothing to sell": "Нечего продавать",
  "not property": "Нельзя заложить эту клетку",
  "already mortgaged": "Уже заложено",
  "sell buildings first": "Сначала продай постройки",
  "not mortgaged": "Не в залоге",
  "not in game": "Игра ещё не началась",
  "a trade is already pending": "Обмен уже в процессе",
  "no buyer": "Покупатель недоступен",
  "nobody owns this": "Клетка ничья",
  "already yours": "Уже твоё",
  "sell houses first": "Сначала продай дома",
  "no pending trade": "Нет активного обмена",
  "not your offer": "Обмен адресован не тебе",
  "trade invalid": "Обмен больше невозможен",
  "buyer no longer has cash": "У покупателя не хватает денег",
  "no auction": "Аукцион не идёт",
  "bankrupt": "Игрок банкрот",
  "passed": "Ты уже пасанул",
  "bad amount": "Неверная сумма",
  "bid too low": "Ставка слишком мала",
  "room not found": "Комната закрыта или не существует",
  "not host": "Только хост может это сделать",
};

const DICT_EN: Record<string, string> = {
  "no player": "Player not found",
  "not in jail": "You're not in jail",
  "not your turn": "It's not your turn",
  "wrong phase": "Can't do this right now",
  "not enough cash": "Not enough cash",
  "no jail card": "No Get-Out-of-Jail card",
  "not a street": "Not a street tile",
  "not your property": "Not your property",
  "mortgaged": "Property is mortgaged",
  "hotel already": "Hotel already built",
  "need monopoly": "Need the full color set",
  "build evenly": "Build evenly across the set",
  "sell evenly": "Sell evenly across the set",
  "nothing to sell": "Nothing to sell",
  "not property": "Can't mortgage this tile",
  "already mortgaged": "Already mortgaged",
  "sell buildings first": "Sell buildings first",
  "not mortgaged": "Not mortgaged",
  "not in game": "Game hasn't started",
  "a trade is already pending": "A trade is already pending",
  "no buyer": "Buyer unavailable",
  "nobody owns this": "Nobody owns this",
  "already yours": "Already yours",
  "sell houses first": "Sell houses first",
  "no pending trade": "No pending trade",
  "not your offer": "Offer is not addressed to you",
  "trade invalid": "Trade no longer valid",
  "buyer no longer has cash": "Buyer is short on cash",
  "no auction": "No auction running",
  "bankrupt": "Player is bankrupt",
  "passed": "You already passed",
  "bad amount": "Bad amount",
  "bid too low": "Bid too low",
  "room not found": "Room is closed or gone",
  "not host": "Only the host can do that",
};

export function humanError(raw: string | null | undefined, locale: Locale | string): string {
  if (!raw) return "";
  const dict = locale === "ru" ? DICT_RU : DICT_EN;
  return dict[raw] ?? raw;
}
