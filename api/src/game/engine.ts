import { nanoid } from "nanoid";
import { BOARD, GO_SALARY, GROUP_SIZE, JAIL_FINE, JAIL_POSITION, MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, STARTING_CASH } from "../../../shared/board";
import { CHANCE_CARDS, CHEST_CARDS, type CardDef } from "../../../shared/cards";
import type {
  DrawnCard,
  GameLogEntry,
  I18nText,
  OwnedProperty,
  Player,
  PropertyTile,
  RoomState,
  SpeedDieFace,
  StreetTile,
  Tile,
} from "../../../shared/types";

const RAILROAD_RENTS = [25, 50, 100, 200];

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Speed Die faces: 1, 2, 3, Bus, Mr. Monopoly, Mr. Monopoly */
export function rollSpeedDie(): SpeedDieFace {
  const faces: SpeedDieFace[] = [1, 2, 3, "bus", "monopoly", "monopoly"];
  return faces[Math.floor(Math.random() * faces.length)];
}

/** Сколько собственностей у игрока — Speed Die включается с 3+. */
function ownedCount(room: RoomState, playerId: string): number {
  return Object.values(room.properties).filter((p) => p.ownerId === playerId).length;
}

export function log(room: RoomState, text: I18nText): void {
  const entry: GameLogEntry = { id: nanoid(8), ts: Date.now(), text };
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
    speedDie: null,
    doublesInARow: 0,
    properties: {},
    log: [],
    lastCard: null,
    winnerId: null,
    createdAt: Date.now(),
    startedAt: null,
  };
}

export function addPlayer(
  room: RoomState,
  tgUserId: number,
  name: string,
  avatar?: string,
): Player | null {
  if (room.phase !== "lobby") return null;
  const existing = room.players.find((p) => p.tgUserId === tgUserId);
  if (existing) {
    existing.connected = true;
    // Обновляем имя, если пользователь ввёл новое при пере-входе.
    if (name && name !== existing.name) existing.name = name;
    return existing;
  }
  if (room.players.length >= (room.maxPlayers ?? MAX_PLAYERS)) return null;

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
  const active = room.players.filter((p) => p.connected);
  if (active.length < MIN_PLAYERS) return false;
  if (!active.every((p) => p.ready)) return false;

  // drop players who never connected/ready
  room.players = active;
  room.phase = "rolling";
  room.currentTurn = 0;
  room.startedAt = Date.now();
  log(room, { en: "Game started!", ru: "Игра началась!" });
  return true;
}

/** Передать хоста следующему подключённому игроку. */
export function reassignHostIfNeeded(room: RoomState): void {
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && host.connected) return;
  const next = room.players.find((p) => p.connected);
  if (next) {
    room.hostId = next.id;
    log(room, { en: `${next.name} is now host`, ru: `${next.name} теперь хост` });
  }
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
  p.bankrupt = true;
  p.cash = 0;
  // освобождаем его собственность
  for (const idx in room.properties) {
    if (room.properties[idx].ownerId === p.id) delete room.properties[idx];
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
  if (owned.houses >= 4) {
    // строим отель
    if (p.cash < tile.houseCost) return { ok: false, error: "not enough cash" };
    p.cash -= tile.houseCost;
    owned.houses = 0;
    owned.hotel = true;
    log(room, { en: `${p.name} built a hotel on ${tile.name.en}`, ru: `${p.name} построил отель на ${tile.name.ru}` });
    return { ok: true };
  }
  if (p.cash < tile.houseCost) return { ok: false, error: "not enough cash" };
  p.cash -= tile.houseCost;
  owned.houses++;
  log(room, { en: `${p.name} built a house on ${tile.name.en} (${owned.houses}/4)`, ru: `${p.name} построил дом на ${tile.name.ru} (${owned.houses}/4)` });
  return { ok: true };
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
  if (owned.hotel) {
    owned.hotel = false;
    owned.houses = 4;
    p.cash += refund;
    log(room, { en: `${p.name} sold hotel on ${tile.name.en} (+$${refund})`, ru: `${p.name} продал отель на ${tile.name.ru} (+$${refund})` });
    return { ok: true };
  }
  if (owned.houses <= 0) return { ok: false, error: "nothing to sell" };
  owned.houses--;
  p.cash += refund;
  log(room, { en: `${p.name} sold a house on ${tile.name.en} (+$${refund})`, ru: `${p.name} продал дом на ${tile.name.ru} (+$${refund})` });
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
  speedDie: SpeedDieFace | null;
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

  // Speed Die активируется после 3+ собственностей
  const useSpeedDie = ownedCount(room, p.id) >= 3;
  const speedDie: SpeedDieFace | null = useSpeedDie ? rollSpeedDie() : null;

  room.dice = dice;
  room.speedDie = speedDie;

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
          return { dice, speedDie, from: p.position, to: p.position };
        }
      } else {
        room.phase = "action";
        log(room, { en: `${p.name} stays in jail`, ru: `${p.name} остаётся в тюрьме` });
        return { dice, speedDie, from: p.position, to: p.position };
      }
    }
  }

  if (isDoubles) {
    room.doublesInARow++;
    if (room.doublesInARow >= 3) {
      sendToJail(room, p);
      room.phase = "action";
      return { dice, speedDie, from: p.position, to: p.position };
    }
  } else {
    room.doublesInARow = 0;
  }

  const from = p.position;
  // Speed Die: 1/2/3 добавляются к движению
  const extra = typeof speedDie === "number" ? speedDie : 0;
  let to = advance(p, from, sum + extra, room);

  // Bus: можно остановиться на ближайшей Chance/Community Chest между from и to
  if (speedDie === "bus") {
    const stopIdx = nearestCardTile(from, to);
    if (stopIdx !== null) {
      to = stopIdx;
      p.position = stopIdx;
      log(room, { en: `${p.name} caught the Bus`, ru: `${p.name} поймал автобус` });
    }
  }

  p.position = to;
  room.phase = "moving";

  resolveTile(room, p);

  // Mr. Monopoly: после базового хода — до ближайшей свободной собственности
  if (speedDie === "monopoly" && !p.bankrupt && !p.inJail) {
    const nextUnowned = nearestUnownedProperty(room, to);
    if (nextUnowned !== null) {
      if (nextUnowned < to) {
        p.cash += GO_SALARY;
        log(room, { en: `${p.name} passed GO (+$${GO_SALARY})`, ru: `${p.name} прошёл СТАРТ (+$${GO_SALARY})` });
      }
      p.position = nextUnowned;
      log(room, { en: `Mr. Monopoly sends ${p.name} to ${BOARD[nextUnowned].name.en}`, ru: `Мистер Монополия отправил ${p.name} на ${BOARD[nextUnowned].name.ru}` });
      resolveTile(room, p);
    }
  }

  return { dice, speedDie, from, to };
}

function advance(p: Player, from: number, steps: number, room: RoomState): number {
  const to = (from + steps) % BOARD.length;
  if (to < from || steps >= BOARD.length) {
    p.cash += GO_SALARY;
    log(room, { en: `${p.name} passed GO (+$${GO_SALARY})`, ru: `${p.name} прошёл СТАРТ (+$${GO_SALARY})` });
  }
  return to;
}

function nearestCardTile(from: number, to: number): number | null {
  const cardIndices = new Set(
    BOARD.filter((t) => t.kind === "chance" || t.kind === "chest").map((t) => t.index),
  );
  const len = BOARD.length;
  const steps = to >= from ? to - from : len - from + to;
  for (let i = 1; i <= steps; i++) {
    const idx = (from + i) % len;
    if (cardIndices.has(idx)) return idx;
  }
  return null;
}

function nearestUnownedProperty(room: RoomState, from: number): number | null {
  for (let i = 1; i <= BOARD.length; i++) {
    const idx = (from + i) % BOARD.length;
    const tile = BOARD[idx];
    if (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility") {
      if (!room.properties[idx]) return idx;
    }
  }
  return null;
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
  log(room, {
    en: `${p.name} paid ${owner.name} $${paid} rent on ${tile.name.en}`,
    ru: `${p.name} заплатил ${owner.name} $${paid} аренды за ${tile.name.ru}`,
  });
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
  log(room, {
    en: `${p.name} bought ${tile.name.en} for $${tile.price}`,
    ru: `${p.name} купил ${tile.name.ru} за $${tile.price}`,
  });
  room.phase = "action";
  return true;
}

export function skipBuy(room: RoomState): void {
  if (room.phase === "buyPrompt") room.phase = "action";
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
  // transfer properties
  for (const idx in room.properties) {
    const prop = room.properties[idx];
    if (prop.ownerId !== p.id) continue;
    if (to) {
      prop.ownerId = to.id;
    } else {
      delete room.properties[idx];
    }
  }
  log(room, { en: `${p.name} went bankrupt`, ru: `${p.name} обанкротился` });
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
