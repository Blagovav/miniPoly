import { nanoid } from "nanoid";
import { BOARD, GO_SALARY, GROUP_SIZE, HOTEL_BANK_SIZE, HOUSE_BANK_SIZE, JAIL_FINE, JAIL_POSITION, MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, STARTING_CASH } from "../../../shared/board";
import { CHANCE_CARDS, CHEST_CARDS, type CardDef } from "../../../shared/cards";
import type {
  DrawnCard,
  GameLogEntry,
  I18nText,
  OwnedProperty,
  Player,
  PreRollBracket,
  PropertyTile,
  RoomState,
  StreetTile,
  Tile,
  TxnInfo,
} from "../../../shared/types";

const RAILROAD_RENTS = [25, 50, 100, 200];

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function log(room: RoomState, text: I18nText, txn?: TxnInfo): void {
  const entry: GameLogEntry = { id: nanoid(8), ts: Date.now(), text, ...(txn ? { txn } : {}) };
  room.log.push(entry);
  if (room.log.length > 200) room.log.shift();
}

export function createRoom(hostId: string, isPublic = true, maxPlayers = MAX_PLAYERS): RoomState {
  const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(maxPlayers)));
  return {
    id: nanoid(6).toUpperCase(),
    hostId,
    isPublic,
    maxPlayers: clamped,
    players: [],
    currentTurn: 0,
    phase: "lobby",
    dice: null,
    doublesInARow: 0,
    properties: {},
    log: [],
    lastCard: null,
    cardHistory: [],
    auction: null,
    pendingTrade: null,
    winnerId: null,
    houseBank: HOUSE_BANK_SIZE,
    hotelBank: HOTEL_BANK_SIZE,
    createdAt: Date.now(),
    startedAt: null,
    preRollBrackets: [],
    preRollOrder: [],
    preRollRolls: {},
  };
}

export function addPlayer(
  room: RoomState,
  tgUserId: number,
  name: string,
  avatar?: string,
): Player | null {
  // Reconnect of an existing player must work in any phase (rolling,
  // action, auction, ...). The lobby-only gate below applies strictly to
  // NEW joins — otherwise a player who refreshed mid-match would be
  // permanently locked out of their own game.
  const existing = room.players.find((p) => p.tgUserId === tgUserId);
  if (existing) {
    existing.connected = true;
    if (name && name !== existing.name) existing.name = name;
    return existing;
  }
  if (room.phase !== "lobby") return null;
  // Capacity counts only "viable" seats — connected humans + bots. An
  // offline player still occupying a slot during the 3-minute rejoin
  // grace would otherwise block strangers from filling the lobby.
  const seated = room.players.filter((p) => p.connected || p.isBot).length;
  if (seated >= (room.maxPlayers ?? MAX_PLAYERS)) return null;

  const defaultTokens = ["token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo"];
  const player: Player = {
    id: nanoid(10),
    tgUserId,
    name,
    avatar,
    color: PLAYER_COLORS[room.players.length],
    token: defaultTokens[room.players.length] ?? "token-car",
    position: 0,
    cash: STARTING_CASH,
    inJail: false,
    jailTurns: 0,
    getOutCards: 0,
    bankrupt: false,
    ready: false,
    connected: true,
  };

  room.players.push(player);
  return player;
}

export function startGame(room: RoomState): boolean {
  if (room.phase !== "lobby") return false;
  // Bots count as active seats even though they're not connected via WS.
  const active = room.players.filter((p) => p.connected || p.isBot);
  if (active.length < MIN_PLAYERS) return false;
  if (!active.every((p) => p.ready)) return false;

  // drop players who never connected/ready (bots survive — they're `ready`).
  room.players = active;
  room.phase = "preRoll";
  room.currentTurn = 0;
  room.startedAt = Date.now();
  // Seed the first bracket with every active player in join order. The head
  // of `pending` is who rolls next; seats resolve as rolls come in.
  room.preRollBrackets = [
    {
      playerIds: active.map((p) => p.id),
      rolls: {},
      pending: active.map((p) => p.id),
      isReRoll: false,
    },
  ];
  room.preRollOrder = [];
  room.preRollRolls = {};
  log(room, { en: "Roll for turn order!", ru: "Бросаем на порядок хода!" });
  return true;
}

/** Current roller during the pre-roll phase (null if not in preRoll). */
export function preRollCurrentPlayer(room: RoomState): Player | null {
  if (room.phase !== "preRoll") return null;
  const bracket = room.preRollBrackets[0];
  const pid = bracket?.pending[0];
  if (!pid) return null;
  return room.players.find((p) => p.id === pid) ?? null;
}

/** Roll for seat order. Returns dice rolled, or null if it's not the caller's
 *  turn or phase is wrong. Resolves the active bracket when its queue empties.
 *  Transitions the room to phase "rolling" once all seats are determined. */
export function rollForOrder(
  room: RoomState,
): { by: string; dice: [number, number] } | null {
  if (room.phase !== "preRoll") return null;
  const bracket = room.preRollBrackets[0];
  if (!bracket) return null;
  const pid = bracket.pending[0];
  if (!pid) return null;
  const p = room.players.find((pl) => pl.id === pid);
  if (!p) return null;

  const d1 = rollDie();
  const d2 = rollDie();
  const sum = d1 + d2;
  bracket.rolls[pid] = sum;
  room.preRollRolls[pid] = sum;
  // Also expose via `room.dice` so the Dice component in the HUD snaps to the
  // real values after tumble — same path as in-game rolls.
  room.dice = [d1, d2];
  bracket.pending.shift();

  log(room, {
    en: `${p.name} rolled ${d1} + ${d2} = ${sum}`,
    ru: `${p.name} выбросил ${d1} + ${d2} = ${sum}`,
  });

  if (bracket.pending.length === 0) {
    resolveBracket(room);
  }
  return { by: pid, dice: [d1, d2] };
}

function resolveBracket(room: RoomState): void {
  const bracket = room.preRollBrackets[0];
  if (!bracket) return;

  // Group by roll value (desc). Singletons resolve to final seats; still-tied
  // groups become new brackets queued ahead of the rest.
  const byValue = new Map<number, string[]>();
  for (const pid of bracket.playerIds) {
    const v = bracket.rolls[pid] ?? 0;
    const arr = byValue.get(v) ?? [];
    arr.push(pid);
    byValue.set(v, arr);
  }
  const sortedValues = [...byValue.keys()].sort((a, b) => b - a);

  const newBrackets: PreRollBracket[] = [];
  for (const v of sortedValues) {
    const group = byValue.get(v)!;
    if (group.length === 1) {
      room.preRollOrder.push(group[0]);
    } else {
      newBrackets.push({
        playerIds: [...group],
        rolls: {},
        pending: [...group],
        isReRoll: true,
      });
      const names = group
        .map((id) => room.players.find((pl) => pl.id === id)?.name ?? "?")
        .join(", ");
      log(room, {
        en: `Tie at ${v}: ${names} roll again`,
        ru: `Ничья ${v}: ${names} перебрасывают`,
      });
    }
  }

  room.preRollBrackets.shift();
  room.preRollBrackets.unshift(...newBrackets);

  if (room.preRollBrackets.length === 0) {
    finalizePreRoll(room);
  }
}

function finalizePreRoll(room: RoomState): void {
  const byId = new Map(room.players.map((p) => [p.id, p]));
  room.players = room.preRollOrder
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p);
  room.preRollOrder = [];
  room.preRollBrackets = [];
  room.preRollRolls = {};
  room.currentTurn = 0;
  room.phase = "rolling";
  room.dice = null;
  const first = room.players[0];
  if (first) {
    log(room, {
      en: `${first.name} goes first!`,
      ru: `${first.name} ходит первым!`,
    });
  }
}

/**
 * True iff a lobby has nobody who could keep it alive — every remaining
 * "player" is a bot, or there are no players at all. Bots can't host or
 * start a match, so a bot-only lobby is just as abandoned as an empty
 * one. Used by the WS layer to delete the room from the in-memory Map
 * instead of letting it zombie around in `/api/rooms/public`.
 */
export function isLobbyAbandoned(room: RoomState): boolean {
  if (room.phase !== "lobby") return false;
  return room.players.every((p) => p.isBot);
}

/** Передать хоста следующему подключённому игроку. Боты хостить не могут. */
export function reassignHostIfNeeded(room: RoomState): void {
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && host.connected && !host.isBot) return;
  const next = room.players.find((p) => p.connected && !p.isBot);
  if (next) {
    room.hostId = next.id;
    log(room, { en: `${next.name} is now host`, ru: `${next.name} теперь хост` });
  }
}

const BOT_NAMES = [
  "Alfred", "Bianca", "Cato", "Diana", "Edgar", "Fiona",
  "Godric", "Helena", "Ivor", "Juno", "Kenric", "Lyra",
];

/**
 * Добавить бота-игрока в лобби. Бот: `isBot: true`, `connected: false`,
 * `ready: true`, уникальный отрицательный tgUserId, имя "Bot <Имя>" без
 * коллизий внутри комнаты. Игровая логика ходит за него через turn-timer.
 */
export function addBot(room: RoomState): Player | null {
  if (room.phase !== "lobby") return null;
  // Same capacity rule as addPlayer — offline humans during grace
  // shouldn't stop the host from filling out the lobby with bots.
  const seated = room.players.filter((p) => p.connected || p.isBot).length;
  if (seated >= (room.maxPlayers ?? MAX_PLAYERS)) return null;

  const usedNames = new Set(room.players.map((p) => p.name));
  const freeName = BOT_NAMES.find((n) => !usedNames.has(`Bot ${n}`));
  const name = freeName ? `Bot ${freeName}` : `Bot ${nanoid(4)}`;

  // Negative IDs never collide with real Telegram user IDs (which are positive).
  const tgUserId = -(Date.now() + Math.floor(Math.random() * 1000));

  const defaultTokens = ["token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo"];
  const usedTokens = new Set(room.players.map((p) => p.token));
  const token = defaultTokens.find((t) => !usedTokens.has(t)) ?? "token-car";

  const bot: Player = {
    id: nanoid(10),
    tgUserId,
    name,
    color: PLAYER_COLORS[room.players.length],
    token,
    position: 0,
    cash: STARTING_CASH,
    inJail: false,
    jailTurns: 0,
    getOutCards: 0,
    bankrupt: false,
    ready: true,
    connected: false,
    isBot: true,
  };
  room.players.push(bot);
  log(room, { en: `${name} joined the game`, ru: `${name} присоединился` });
  return bot;
}

/** Убрать игрока (добровольно или при дисконнекте на этапе лобби). */
export function removePlayer(room: RoomState, playerId: string): void {
  if (room.phase !== "lobby") return;
  room.players = room.players.filter((p) => p.id !== playerId);
  reassignHostIfNeeded(room);
}

/** Игрок вышел из активной партии — объявляем банкротом и передаём имущество банку. */
export function leaveActiveGame(room: RoomState, playerId: string): void {
  if (room.phase === "lobby" || room.phase === "ended") return;
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p || p.bankrupt) return;

  // Pre-roll: game hasn't really started, so just yank the leaver from all
  // brackets and the accumulated order. If that empties a bracket, resolve
  // it so the flow continues. No bankruptcy book-keeping needed.
  if (room.phase === "preRoll") {
    for (const b of room.preRollBrackets) {
      b.pending = b.pending.filter((id) => id !== playerId);
      b.playerIds = b.playerIds.filter((id) => id !== playerId);
      delete b.rolls[playerId];
    }
    room.preRollBrackets = room.preRollBrackets.filter((b) => b.playerIds.length > 0);
    room.preRollOrder = room.preRollOrder.filter((id) => id !== playerId);
    delete room.preRollRolls[playerId];
    room.players = room.players.filter((pl) => pl.id !== playerId);
    log(room, { en: `${p.name} left before rolling`, ru: `${p.name} вышел до броска` });
    const first = room.preRollBrackets[0];
    if (first && first.pending.length === 0) resolveBracket(room);
    if (room.players.length < MIN_PLAYERS) {
      // Not enough players to continue — end the game cleanly.
      room.phase = "ended";
      room.winnerId = room.players[0]?.id ?? null;
    }
    reassignHostIfNeeded(room);
    return;
  }
  p.bankrupt = true;
  p.cash = 0;
  // освобождаем его собственность + возвращаем постройки в банк
  for (const idx in room.properties) {
    const prop = room.properties[idx];
    if (prop.ownerId !== p.id) continue;
    returnBuildingsToBank(room, prop);
    delete room.properties[idx];
  }
  log(room, { en: `${p.name} left the game`, ru: `${p.name} вышел из игры` });
  // если ушёл текущий игрок — пропускаем ход
  if (room.players[room.currentTurn]?.id === p.id) {
    room.phase = "rolling";
    room.dice = null;
    room.doublesInARow = 0;
    do {
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
    } while (room.players[room.currentTurn].bankrupt);
  }
  // проверка победы
  const alive = room.players.filter((pl) => !pl.bankrupt);
  if (alive.length <= 1 && room.players.length > 1) {
    room.phase = "ended";
    room.winnerId = alive[0]?.id ?? null;
    if (alive[0]) log(room, { en: `${alive[0].name} wins!`, ru: `${alive[0].name} победил!` });
  }
  reassignHostIfNeeded(room);
}

/** Сменить токен игрока (только в лобби). */
export function selectToken(room: RoomState, playerId: string, tokenId: string): boolean {
  if (room.phase !== "lobby") return false;
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  p.token = tokenId;
  return true;
}

/** Купить дом на улице (нужна монополия + деньги). */
export function buildHouse(room: RoomState, playerId: string, tileIndex: number): { ok: boolean; error?: string } {
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  const tile = BOARD[tileIndex];
  if (!tile || tile.kind !== "street") return { ok: false, error: "not a street" };
  const owned = room.properties[tileIndex];
  if (!owned || owned.ownerId !== playerId) return { ok: false, error: "not your property" };
  if (owned.mortgaged) return { ok: false, error: "mortgaged" };
  if (owned.hotel) return { ok: false, error: "hotel already" };
  if (!hasMonopoly(room, tile, playerId)) return { ok: false, error: "need monopoly" };

  // Равномерность (Hasbro): нельзя строить, пока на других улицах группы домов меньше.
  const others = groupOthers(room, tile);
  const otherMin = Math.min(...others.map(buildingLevel));
  if (owned.houses > otherMin) return { ok: false, error: "build evenly" };

  if (owned.houses >= 4) {
    // Hasbro: upgrading to hotel returns the 4 houses to the bank and takes 1 hotel.
    if (room.hotelBank <= 0) return { ok: false, error: "no hotels in bank" };
    if (p.cash < tile.houseCost) return { ok: false, error: "not enough cash" };
    p.cash -= tile.houseCost;
    room.houseBank += 4;
    room.hotelBank--;
    owned.houses = 0;
    owned.hotel = true;
    log(room, { en: `${p.name} built a hotel on ${tile.name.en}`, ru: `${p.name} построил отель на ${tile.name.ru}` });
    return { ok: true };
  }
  if (room.houseBank <= 0) return { ok: false, error: "no houses in bank" };
  if (p.cash < tile.houseCost) return { ok: false, error: "not enough cash" };
  p.cash -= tile.houseCost;
  room.houseBank--;
  owned.houses++;
  log(room, { en: `${p.name} built a house on ${tile.name.en} (${owned.houses}/4)`, ru: `${p.name} построил дом на ${tile.name.ru} (${owned.houses}/4)` });
  return { ok: true };
}

function buildingLevel(o: OwnedProperty): number {
  return o.hotel ? 5 : o.houses;
}

function groupOthers(room: RoomState, tile: StreetTile): OwnedProperty[] {
  return BOARD
    .filter((t): t is StreetTile => t.kind === "street" && t.group === tile.group && t.index !== tile.index)
    .map((t) => room.properties[t.index])
    .filter((o): o is OwnedProperty => !!o);
}

/** Продать дом/отель за половину стоимости. */
export function sellHouse(room: RoomState, playerId: string, tileIndex: number): { ok: boolean; error?: string } {
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  const tile = BOARD[tileIndex];
  if (!tile || tile.kind !== "street") return { ok: false, error: "not a street" };
  const owned = room.properties[tileIndex];
  if (!owned || owned.ownerId !== playerId) return { ok: false, error: "not your property" };
  const refund = Math.floor(tile.houseCost / 2);

  // Равномерность при продаже: нельзя сносить, если на других улицах группы домов больше.
  const others = groupOthers(room, tile);
  const otherMax = others.length ? Math.max(...others.map(buildingLevel)) : 0;
  const myLevel = buildingLevel(owned);
  if (myLevel < otherMax) return { ok: false, error: "sell evenly" };

  if (owned.hotel) {
    // Downgrading hotel → 4 houses requires 4 houses in the bank (Hasbro rule).
    // If none available, the player must sell the hotel straight down to 0.
    if (room.houseBank >= 4) {
      owned.hotel = false;
      owned.houses = 4;
      room.houseBank -= 4;
      room.hotelBank++;
      p.cash += refund;
      log(room, { en: `${p.name} sold hotel on ${tile.name.en} (+$${refund})`, ru: `${p.name} продал отель на ${tile.name.ru} (+$${refund})` });
    } else {
      owned.hotel = false;
      owned.houses = 0;
      room.hotelBank++;
      p.cash += refund;
      log(room, { en: `${p.name} sold hotel on ${tile.name.en} (+$${refund}, no houses in bank)`, ru: `${p.name} продал отель на ${tile.name.ru} (+$${refund}, в банке нет домов)` });
    }
    return { ok: true };
  }
  if (owned.houses <= 0) return { ok: false, error: "nothing to sell" };
  owned.houses--;
  room.houseBank++;
  p.cash += refund;
  log(room, { en: `${p.name} sold a house on ${tile.name.en} (+$${refund})`, ru: `${p.name} продал дом на ${tile.name.ru} (+$${refund})` });
  return { ok: true };
}

/** Заложить собственность банку: +mortgage-стоимость, аренда не берётся. */
export function mortgageProperty(room: RoomState, playerId: string, tileIndex: number): { ok: boolean; error?: string } {
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  const tile = BOARD[tileIndex];
  if (!tile || (tile.kind !== "street" && tile.kind !== "railroad" && tile.kind !== "utility"))
    return { ok: false, error: "not property" };
  const owned = room.properties[tileIndex];
  if (!owned || owned.ownerId !== playerId) return { ok: false, error: "not your property" };
  if (owned.mortgaged) return { ok: false, error: "already mortgaged" };
  if (owned.houses > 0 || owned.hotel) return { ok: false, error: "sell buildings first" };
  owned.mortgaged = true;
  p.cash += tile.mortgage;
  log(room, { en: `${p.name} mortgaged ${tile.name.en} (+$${tile.mortgage})`, ru: `${p.name} заложил ${tile.name.ru} (+$${tile.mortgage})` });
  return { ok: true };
}

/** Выкупить заложенную собственность: залог + 10% комиссии. */
export function unmortgageProperty(room: RoomState, playerId: string, tileIndex: number): { ok: boolean; error?: string } {
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  const tile = BOARD[tileIndex];
  if (!tile || (tile.kind !== "street" && tile.kind !== "railroad" && tile.kind !== "utility"))
    return { ok: false, error: "not property" };
  const owned = room.properties[tileIndex];
  if (!owned || owned.ownerId !== playerId) return { ok: false, error: "not your property" };
  if (!owned.mortgaged) return { ok: false, error: "not mortgaged" };
  const cost = Math.ceil(tile.mortgage * 1.1);
  if (p.cash < cost) return { ok: false, error: "not enough cash" };
  p.cash -= cost;
  owned.mortgaged = false;
  log(room, { en: `${p.name} unmortgaged ${tile.name.en} (-$${cost})`, ru: `${p.name} выкупил залог ${tile.name.ru} (-$${cost})` });
  return { ok: true };
}

export interface TradeProposal {
  toId: string;
  giveTiles: number[];
  giveCash: number;
  giveJailCards: number;
  takeTiles: number[];
  takeCash: number;
  takeJailCards: number;
}

/** Предложить двусторонний обмен: улицы + кэш + карточки тюрьмы ↔ улицы + кэш + карточки. */
export function proposeTrade(
  room: RoomState,
  fromId: string,
  offer: TradeProposal,
): { ok: boolean; error?: string } {
  if (room.phase === "lobby" || room.phase === "ended") return { ok: false, error: "not in game" };
  if (room.pendingTrade) return { ok: false, error: "a trade is already pending" };

  const from = room.players.find((p) => p.id === fromId);
  const to = room.players.find((p) => p.id === offer.toId);
  if (!from || !to) return { ok: false, error: "no player" };
  if (from.id === to.id) return { ok: false, error: "cannot trade with yourself" };
  if (from.bankrupt || to.bankrupt) return { ok: false, error: "bankrupt player" };

  // Инициировать можно только в свой ход.
  if (room.players[room.currentTurn].id !== fromId) return { ok: false, error: "not your turn" };

  const giveCash = Math.max(0, Math.floor(offer.giveCash));
  const takeCash = Math.max(0, Math.floor(offer.takeCash));
  const giveJail = Math.max(0, Math.floor(offer.giveJailCards));
  const takeJail = Math.max(0, Math.floor(offer.takeJailCards));
  const giveTiles = Array.from(new Set(offer.giveTiles));
  const takeTiles = Array.from(new Set(offer.takeTiles));

  // Хоть что-то должно быть на столе.
  if (
    giveCash + takeCash + giveJail + takeJail + giveTiles.length + takeTiles.length ===
    0
  ) {
    return { ok: false, error: "empty trade" };
  }

  // Ничего на двух сторонах одновременно быть не должно.
  for (const i of giveTiles) {
    if (takeTiles.includes(i)) return { ok: false, error: "tile on both sides" };
  }

  if (from.cash < giveCash) return { ok: false, error: "not enough cash" };
  if (to.cash < takeCash) return { ok: false, error: "recipient lacks cash" };
  if (from.getOutCards < giveJail) return { ok: false, error: "not enough jail cards" };
  if (to.getOutCards < takeJail) return { ok: false, error: "recipient lacks jail cards" };

  // Заложенные участки нельзя трогать (дома — можно, переходят к новому владельцу).
  for (const idx of giveTiles) {
    const owned = room.properties[idx];
    if (!owned || owned.ownerId !== from.id) return { ok: false, error: "you don't own a tile" };
    if (owned.mortgaged) return { ok: false, error: "mortgaged tile in offer" };
  }
  for (const idx of takeTiles) {
    const owned = room.properties[idx];
    if (!owned || owned.ownerId !== to.id) return { ok: false, error: "they don't own a tile" };
    if (owned.mortgaged) return { ok: false, error: "mortgaged tile requested" };
  }

  room.pendingTrade = {
    id: nanoid(8),
    fromId,
    toId: to.id,
    giveTiles,
    giveCash,
    giveJailCards: giveJail,
    takeTiles,
    takeCash,
    takeJailCards: takeJail,
    ts: Date.now(),
  };
  log(room, {
    en: `${from.name} sends a trade offer to ${to.name}`,
    ru: `${from.name} шлёт предложение обмена игроку ${to.name}`,
  });
  return { ok: true };
}

export function resolveTrade(
  room: RoomState,
  responderId: string,
  accept: boolean,
): { ok: boolean; error?: string } {
  const t = room.pendingTrade;
  if (!t) return { ok: false, error: "no pending trade" };
  if (t.toId !== responderId) return { ok: false, error: "not your offer" };

  const from = room.players.find((p) => p.id === t.fromId);
  const to = room.players.find((p) => p.id === t.toId);
  room.pendingTrade = null;

  if (!accept) {
    log(room, {
      en: `${to?.name ?? "?"} declined the trade from ${from?.name ?? "?"}`,
      ru: `${to?.name ?? "?"} отклонил обмен от ${from?.name ?? "?"}`,
    });
    return { ok: true };
  }

  if (!from || !to || from.bankrupt || to.bankrupt) return { ok: false, error: "trade invalid" };

  // Перепроверяем состояние — за время ожидания ответа могло всё поменяться.
  if (from.cash < t.giveCash) return { ok: false, error: "initiator no longer has cash" };
  if (to.cash < t.takeCash) return { ok: false, error: "recipient no longer has cash" };
  if (from.getOutCards < t.giveJailCards) return { ok: false, error: "initiator no longer has jail cards" };
  if (to.getOutCards < t.takeJailCards) return { ok: false, error: "recipient no longer has jail cards" };
  for (const idx of t.giveTiles) {
    const o = room.properties[idx];
    if (!o || o.ownerId !== from.id || o.mortgaged) return { ok: false, error: "tile unavailable" };
  }
  for (const idx of t.takeTiles) {
    const o = room.properties[idx];
    if (!o || o.ownerId !== to.id || o.mortgaged) return { ok: false, error: "tile unavailable" };
  }

  from.cash += t.takeCash - t.giveCash;
  to.cash += t.giveCash - t.takeCash;
  from.getOutCards += t.takeJailCards - t.giveJailCards;
  to.getOutCards += t.giveJailCards - t.takeJailCards;
  // Дома/отели остаются на клетке и переходят к новому владельцу.
  for (const idx of t.giveTiles) room.properties[idx].ownerId = to.id;
  for (const idx of t.takeTiles) room.properties[idx].ownerId = from.id;

  log(room, {
    en: `${from.name} and ${to.name} completed a trade`,
    ru: `${from.name} и ${to.name} совершили обмен`,
  });
  return { ok: true };
}

function hasMonopoly(
  room: RoomState,
  street: StreetTile,
  ownerId: string,
): boolean {
  const groupTiles = BOARD.filter(
    (t): t is StreetTile => t.kind === "street" && t.group === street.group,
  );
  if (groupTiles.length !== GROUP_SIZE[street.group]) return false;
  return groupTiles.every((t) => room.properties[t.index]?.ownerId === ownerId && !room.properties[t.index].mortgaged);
}

export function currentPlayer(room: RoomState): Player | null {
  return room.players[room.currentTurn] ?? null;
}

export function rollAndMove(
  room: RoomState,
): {
  dice: [number, number];
  from: number;
  to: number;
} | null {
  const p = currentPlayer(room);
  if (!p || room.phase !== "rolling") return null;

  const d1 = rollDie();
  const d2 = rollDie();
  const dice: [number, number] = [d1, d2];
  const sum = d1 + d2;
  const isDoubles = d1 === d2;

  room.dice = dice;

  // Jail handling
  if (p.inJail) {
    if (isDoubles) {
      p.inJail = false;
      p.jailTurns = 0;
      log(room, { en: `${p.name} rolled doubles and left jail`, ru: `${p.name} выбросил дубль и вышел из тюрьмы` });
    } else {
      p.jailTurns++;
      if (p.jailTurns >= 3) {
        if (p.cash >= JAIL_FINE) {
          p.cash -= JAIL_FINE;
          p.inJail = false;
          p.jailTurns = 0;
          log(room, { en: `${p.name} paid $${JAIL_FINE} and left jail`, ru: `${p.name} заплатил $${JAIL_FINE} и вышел из тюрьмы` });
        } else {
          bankruptPlayer(room, p);
          nextTurn(room);
          return { dice, from: p.position, to: p.position };
        }
      } else {
        room.phase = "action";
        log(room, { en: `${p.name} stays in jail`, ru: `${p.name} остаётся в тюрьме` });
        return { dice, from: p.position, to: p.position };
      }
    }
  }

  if (isDoubles) {
    room.doublesInARow++;
    if (room.doublesInARow >= 3) {
      sendToJail(room, p);
      room.phase = "action";
      return { dice, from: p.position, to: p.position };
    }
  } else {
    room.doublesInARow = 0;
  }

  const from = p.position;
  const to = advance(p, from, sum, room);

  p.position = to;
  room.phase = "moving";

  resolveTile(room, p);

  return { dice, from, to };
}

function advance(p: Player, from: number, steps: number, room: RoomState): number {
  const to = (from + steps) % BOARD.length;
  if (to < from || steps >= BOARD.length) {
    p.cash += GO_SALARY;
    log(room, { en: `${p.name} passed GO (+$${GO_SALARY})`, ru: `${p.name} прошёл СТАРТ (+$${GO_SALARY})` });
  }
  return to;
}

function resolveTile(room: RoomState, p: Player): void {
  const tile = BOARD[p.position];
  room.phase = "action";

  switch (tile.kind) {
    case "go":
    case "freeParking":
    case "jail":
      break;
    case "goToJail":
      sendToJail(room, p);
      break;
    case "tax":
      payOrBankrupt(room, p, tile.amount, { en: `Tax -$${tile.amount}`, ru: `Налог -$${tile.amount}` });
      break;
    case "chance":
    case "chest":
      drawCard(room, p, tile.kind);
      break;
    case "street":
    case "railroad":
    case "utility":
      handleProperty(room, p, tile);
      break;
  }
}

function handleProperty(room: RoomState, p: Player, tile: PropertyTile): void {
  const owned = room.properties[tile.index];
  if (!owned) {
    if (p.cash >= tile.price) {
      room.phase = "buyPrompt";
    } else {
      log(room, { en: `${p.name} can't afford ${tile.name.en}`, ru: `${p.name} не может купить ${tile.name.ru}` });
    }
    return;
  }
  if (owned.ownerId === p.id || owned.mortgaged) return;

  const owner = room.players.find((pl) => pl.id === owned.ownerId);
  if (!owner || owner.bankrupt) return;

  const rent = calculateRent(room, tile, owned);
  const paid = Math.min(rent, p.cash);
  p.cash -= paid;
  owner.cash += paid;
  log(
    room,
    {
      en: `${p.name} paid ${owner.name} $${paid} rent on ${tile.name.en}`,
      ru: `${p.name} заплатил ${owner.name} $${paid} аренды за ${tile.name.ru}`,
    },
    { kind: "rent", amount: paid, actorId: p.id, counterpartyId: owner.id, tileIndex: tile.index },
  );
  if (p.cash < 0 || rent > paid) {
    bankruptPlayer(room, p, owner);
  }
}

function calculateRent(
  room: RoomState,
  tile: PropertyTile,
  owned: OwnedProperty,
): number {
  if (tile.kind === "street") {
    const street = tile as StreetTile;
    if (owned.hotel) return street.rent[5];
    if (owned.houses > 0) return street.rent[owned.houses];
    const base = street.rent[0];
    return hasMonopoly(room, street, owned.ownerId) ? base * 2 : base;
  }
  if (tile.kind === "railroad") {
    const count = countOwnedOfKind(room, "railroad", owned.ownerId);
    return RAILROAD_RENTS[Math.max(0, count - 1)] ?? 25;
  }
  // utility
  const count = countOwnedOfKind(room, "utility", owned.ownerId);
  const multiplier = count === 2 ? 10 : 4;
  const sum = (room.dice?.[0] ?? 0) + (room.dice?.[1] ?? 0);
  return sum * multiplier;
}

function countOwnedOfKind(
  room: RoomState,
  kind: "railroad" | "utility",
  ownerId: string,
): number {
  return BOARD.filter(
    (t) => t.kind === kind && room.properties[t.index]?.ownerId === ownerId,
  ).length;
}

export function buyCurrentProperty(room: RoomState): boolean {
  if (room.phase !== "buyPrompt") return false;
  const p = currentPlayer(room);
  if (!p) return false;
  const tile = BOARD[p.position];
  if (tile.kind !== "street" && tile.kind !== "railroad" && tile.kind !== "utility")
    return false;
  if (p.cash < tile.price) return false;
  if (room.properties[tile.index]) return false;

  p.cash -= tile.price;
  room.properties[tile.index] = {
    tileIndex: tile.index,
    ownerId: p.id,
    houses: 0,
    hotel: false,
    mortgaged: false,
  };
  log(
    room,
    {
      en: `${p.name} bought ${tile.name.en} for $${tile.price}`,
      ru: `${p.name} купил ${tile.name.ru} за $${tile.price}`,
    },
    { kind: "buy", amount: tile.price, actorId: p.id, tileIndex: tile.index },
  );
  room.phase = "action";
  return true;
}

export function skipBuy(room: RoomState): void {
  if (room.phase !== "buyPrompt") return;
  const p = currentPlayer(room);
  if (!p) { room.phase = "action"; return; }
  const tile = BOARD[p.position];
  if (tile.kind !== "street" && tile.kind !== "railroad" && tile.kind !== "utility") {
    room.phase = "action";
    return;
  }
  startAuction(room, tile.index);
}

/**
 * Hasbro: добровольно заплатить $50 и выйти из тюрьмы ДО броска кубиков.
 * Вызывается в начале своего хода в фазе "rolling", пока игрок in jail.
 */
export function payJailFine(room: RoomState, playerId: string): { ok: boolean; error?: string } {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  if (!p.inJail) return { ok: false, error: "not in jail" };
  if (room.players[room.currentTurn].id !== playerId) return { ok: false, error: "not your turn" };
  if (room.phase !== "rolling") return { ok: false, error: "wrong phase" };
  if (p.cash < JAIL_FINE) return { ok: false, error: "not enough cash" };
  p.cash -= JAIL_FINE;
  p.inJail = false;
  p.jailTurns = 0;
  log(room, { en: `${p.name} paid $${JAIL_FINE} and left jail`, ru: `${p.name} заплатил $${JAIL_FINE} и вышел из тюрьмы` });
  return { ok: true };
}

/** Hasbro: использовать карту "Get Out of Jail Free" вместо оплаты. */
export function useGetOutCard(room: RoomState, playerId: string): { ok: boolean; error?: string } {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  if (!p.inJail) return { ok: false, error: "not in jail" };
  if (room.players[room.currentTurn].id !== playerId) return { ok: false, error: "not your turn" };
  if (room.phase !== "rolling") return { ok: false, error: "wrong phase" };
  if (p.getOutCards <= 0) return { ok: false, error: "no jail card" };
  p.getOutCards--;
  p.inJail = false;
  p.jailTurns = 0;
  log(room, { en: `${p.name} used Get Out of Jail card`, ru: `${p.name} использовал карту «Освобождение»` });
  return { ok: true };
}

/** Аукцион Hasbro: когда игрок отказался покупать клетку — она уходит с молотка. */
export function startAuction(room: RoomState, tileIndex: number): void {
  const tile = BOARD[tileIndex];
  if (tile.kind !== "street" && tile.kind !== "railroad" && tile.kind !== "utility") return;
  if (room.properties[tileIndex]) return;
  room.auction = {
    tileIndex,
    highBid: 0,
    highBidderId: null,
    passedIds: [],
    startedAt: Date.now(),
  };
  room.phase = "auction";
  log(room, {
    en: `Auction! ${tile.name.en} is on the block`,
    ru: `Аукцион! ${tile.name.ru} уходит с молотка`,
  });
  maybeEndAuction(room);
}

export function placeBid(
  room: RoomState,
  playerId: string,
  amount: number,
): { ok: boolean; error?: string } {
  if (room.phase !== "auction" || !room.auction) return { ok: false, error: "no auction" };
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p || p.bankrupt) return { ok: false, error: "bankrupt" };
  if (room.auction.passedIds.includes(playerId)) return { ok: false, error: "passed" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "bad amount" };
  if (amount <= room.auction.highBid) return { ok: false, error: "bid too low" };
  if (amount > p.cash) return { ok: false, error: "not enough cash" };

  room.auction.highBid = Math.floor(amount);
  room.auction.highBidderId = playerId;
  log(room, {
    en: `${p.name} bids $${room.auction.highBid}`,
    ru: `${p.name} ставит $${room.auction.highBid}`,
  });
  return { ok: true };
}

export function passAuction(
  room: RoomState,
  playerId: string,
): { ok: boolean; error?: string } {
  if (room.phase !== "auction" || !room.auction) return { ok: false, error: "no auction" };
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return { ok: false, error: "no player" };
  if (room.auction.passedIds.includes(playerId)) return { ok: false, error: "already passed" };
  if (room.auction.highBidderId === playerId) return { ok: false, error: "can't pass own bid" };

  room.auction.passedIds.push(playerId);
  log(room, { en: `${p.name} passed`, ru: `${p.name} спасовал` });
  maybeEndAuction(room);
  return { ok: true };
}

function auctionActiveBidders(room: RoomState): Player[] {
  const a = room.auction;
  if (!a) return [];
  return room.players.filter((pl) => !pl.bankrupt && !a.passedIds.includes(pl.id));
}

function maybeEndAuction(room: RoomState): void {
  const a = room.auction;
  if (!a) return;
  const active = auctionActiveBidders(room);

  if (active.length === 0) {
    // Никто не поставил, либо всех остающихся спасовали при нулевой ставке.
    log(room, {
      en: `Auction ended — no bids`,
      ru: `Аукцион окончен — ставок нет`,
    });
    room.auction = null;
    room.phase = "action";
    return;
  }

  if (active.length === 1 && a.highBidderId === active[0].id) {
    finishAuction(room);
  }
}

function finishAuction(room: RoomState): void {
  const a = room.auction;
  if (!a || !a.highBidderId) {
    room.auction = null;
    room.phase = "action";
    return;
  }
  const winner = room.players.find((pl) => pl.id === a.highBidderId);
  const tile = BOARD[a.tileIndex];
  if (winner && (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility")) {
    winner.cash -= a.highBid;
    room.properties[a.tileIndex] = {
      tileIndex: a.tileIndex,
      ownerId: winner.id,
      houses: 0,
      hotel: false,
      mortgaged: false,
    };
    log(room, {
      en: `${winner.name} won auction: ${tile.name.en} for $${a.highBid}`,
      ru: `${winner.name} выиграл аукцион: ${tile.name.ru} за $${a.highBid}`,
    });
  }
  room.auction = null;
  room.phase = "action";
}

export function endTurn(room: RoomState): boolean {
  if (room.phase !== "action") return false;
  nextTurn(room);
  return true;
}

function nextTurn(room: RoomState): void {
  // Doubles: same player rolls again unless in jail / just sent to jail
  const p = currentPlayer(room);
  const rolledDoubles =
    room.dice && room.dice[0] === room.dice[1] && p && !p.inJail && room.doublesInARow > 0;
  if (!rolledDoubles) {
    room.doublesInARow = 0;
    do {
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
    } while (room.players[room.currentTurn].bankrupt);
  }
  room.phase = "rolling";
  room.dice = null;

  checkWinCondition(room);
}

function checkWinCondition(room: RoomState): void {
  const alive = room.players.filter((p) => !p.bankrupt);
  if (alive.length <= 1 && room.players.length > 1) {
    room.phase = "ended";
    room.winnerId = alive[0]?.id ?? null;
    if (alive[0]) {
      log(room, { en: `${alive[0].name} wins!`, ru: `${alive[0].name} победил!` });
    }
    // Лениво записываем результат в БД (не блокируя игру).
    import("../db")
      .then(({ recordMatch, upsertUser }) => {
        const winnerId = room.winnerId;
        const allIds = room.players.map((p) => p.tgUserId);
        for (const p of room.players) {
          upsertUser(p.tgUserId, p.name).catch(() => {});
          recordMatch({
            roomId: room.id,
            tgUserId: p.tgUserId,
            name: p.name,
            won: p.id === winnerId,
            cashAtEnd: p.cash,
            playedWith: allIds.filter((id) => id !== p.tgUserId),
          }).catch((err) => console.error("[db] recordMatch failed:", err?.message));
        }
      })
      .catch(() => {});
  }
}

function sendToJail(room: RoomState, p: Player): void {
  p.position = JAIL_POSITION;
  p.inJail = true;
  p.jailTurns = 0;
  room.doublesInARow = 0;
  log(room, { en: `${p.name} went to jail`, ru: `${p.name} отправлен в тюрьму` });
}

function payOrBankrupt(
  room: RoomState,
  p: Player,
  amount: number,
  reason: I18nText,
): void {
  if (p.cash >= amount) {
    p.cash -= amount;
    log(room, { en: `${p.name}: ${reason.en}`, ru: `${p.name}: ${reason.ru}` });
  } else {
    bankruptPlayer(room, p);
  }
}

function bankruptPlayer(room: RoomState, p: Player, to?: Player): void {
  p.bankrupt = true;
  p.cash = 0;
  // transfer properties. When returning to the bank, buildings are freed too;
  // when handing to a creditor, Hasbro rule says the creditor must immediately
  // sell any buildings at half price — we approximate by liquidating on transfer.
  for (const idx in room.properties) {
    const prop = room.properties[idx];
    if (prop.ownerId !== p.id) continue;
    if (to) {
      liquidateBuildings(room, prop, to);
      prop.ownerId = to.id;
    } else {
      returnBuildingsToBank(room, prop);
      delete room.properties[idx];
    }
  }
  log(room, { en: `${p.name} went bankrupt`, ru: `${p.name} обанкротился` });
}

function returnBuildingsToBank(room: RoomState, prop: OwnedProperty): void {
  if (prop.hotel) {
    room.hotelBank++;
    prop.hotel = false;
  }
  if (prop.houses > 0) {
    room.houseBank += prop.houses;
    prop.houses = 0;
  }
}

function liquidateBuildings(room: RoomState, prop: OwnedProperty, creditor: Player): void {
  const tile = BOARD[prop.tileIndex];
  if (tile.kind !== "street") return;
  let units = 0;
  if (prop.hotel) {
    room.hotelBank++;
    prop.hotel = false;
    units += 5;
  }
  if (prop.houses > 0) {
    room.houseBank += prop.houses;
    units += prop.houses;
    prop.houses = 0;
  }
  if (units > 0) {
    creditor.cash += Math.floor((tile.houseCost * units) / 2);
  }
}

function drawCard(room: RoomState, p: Player, kind: "chance" | "chest"): void {
  const deck = kind === "chance" ? CHANCE_CARDS : CHEST_CARDS;
  const card = deck[Math.floor(Math.random() * deck.length)];
  applyCardEffect(room, p, card);
  const drawn: DrawnCard = {
    by: p.id,
    deck: kind,
    cardId: card.id,
    text: card.text,
    ts: Date.now(),
  };
  room.lastCard = drawn;
  room.cardHistory.push(drawn);
  if (room.cardHistory.length > 30) room.cardHistory.shift();
  log(room, { en: `${p.name}: ${card.text.en}`, ru: `${p.name}: ${card.text.ru}` });
}

function applyCardEffect(room: RoomState, p: Player, card: CardDef): void {
  const e = card.effect;
  switch (e.kind) {
    case "cash":
      if (e.amount >= 0) p.cash += e.amount;
      else payOrBankrupt(room, p, -e.amount, card.text);
      return;
    case "advance": {
      if (e.collectGo && e.to < p.position) p.cash += GO_SALARY;
      p.position = e.to;
      resolveTile(room, p);
      return;
    }
    case "back": {
      p.position = (p.position - e.steps + BOARD.length) % BOARD.length;
      resolveTile(room, p);
      return;
    }
    case "jail":
      sendToJail(room, p);
      return;
    case "getOutCard":
      p.getOutCards++;
      return;
    case "payEach": {
      const others = room.players.filter((pl) => !pl.bankrupt && pl.id !== p.id);
      const total = e.amount * others.length;
      if (p.cash < total) {
        bankruptPlayer(room, p);
        return;
      }
      p.cash -= total;
      for (const o of others) o.cash += e.amount;
      return;
    }
    case "collectEach": {
      const others = room.players.filter((pl) => !pl.bankrupt && pl.id !== p.id);
      for (const o of others) {
        const take = Math.min(e.amount, o.cash);
        o.cash -= take;
        p.cash += take;
      }
      return;
    }
    case "repairs": {
      let total = 0;
      for (const prop of Object.values(room.properties)) {
        if (prop.ownerId !== p.id) continue;
        if (prop.hotel) total += e.perHotel;
        else total += prop.houses * e.perHouse;
      }
      if (total > 0) payOrBankrupt(room, p, total, { en: `Repairs -$${total}`, ru: `Ремонт -$${total}` });
      return;
    }
    case "nearestRailroad": {
      const rrs = BOARD.filter((t) => t.kind === "railroad").map((t) => t.index);
      const target = findNext(p.position, rrs);
      if (target < p.position) p.cash += GO_SALARY;
      p.position = target;
      resolveTile(room, p);
      return;
    }
    case "nearestUtility": {
      const uts = BOARD.filter((t) => t.kind === "utility").map((t) => t.index);
      const target = findNext(p.position, uts);
      if (target < p.position) p.cash += GO_SALARY;
      p.position = target;
      resolveTile(room, p);
      return;
    }
  }
}

function findNext(from: number, candidates: number[]): number {
  const len = BOARD.length;
  for (let i = 1; i <= len; i++) {
    const idx = (from + i) % len;
    if (candidates.includes(idx)) return idx;
  }
  return from;
}
