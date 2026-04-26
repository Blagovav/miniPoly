import type { RoomState, ServerMessage } from "../../../shared/types";
import { BOARD } from "../../../shared/board";
import { config } from "../config";
import { notifyTurn } from "../telegram";
import {
  currentPlayer,
  endTurn as engineEndTurn,
  passAuction,
  payJailFine,
  preRollCurrentPlayer,
  resolveTrade,
  rollAndMove,
  rollForOrder,
  skipBuy,
} from "../game/engine";

// Bots move fast so 2+1 or 2+2 human-vs-bot games stay snappy.
const BOT_TURN_DELAY_MS = 2500;
// Auction bidding cadence — slightly faster than a full turn so an
// all-bot auction doesn't drag, but not instant so humans can read
// the bidding war.
const BOT_AUCTION_DELAY_MS = 1200;

const rooms = new Map<string, RoomState>();
const turnTimers = new Map<string, NodeJS.Timeout>();
// Separate timer for non-current bots in an auction. The regular
// turnTimer only ticks for `currentPlayer`; an auction can stretch
// across multiple bots who aren't the current turn — each needs to be
// nudged into placing a bid or passing, otherwise the auction freezes.
const auctionTimers = new Map<string, NodeJS.Timeout>();
const notifiedTurns = new Map<string, string>();

// Broadcasters are injected by the WS server on startup so the bot-turn
// timer can push `diceRolled` + `state` to clients. Without these, the bot
// would mutate state silently and the client would stall on "Ход Bot X".
let broadcastMsg: ((roomId: string, msg: ServerMessage) => void) | null = null;
let broadcastState: ((roomId: string) => void) | null = null;

export function registerBroadcasters(
  msg: (roomId: string, m: ServerMessage) => void,
  state: (roomId: string) => void,
): void {
  broadcastMsg = msg;
  broadcastState = state;
}

export function saveRoom(room: RoomState): void {
  rooms.set(room.id, room);
}

export function getRoom(id: string): RoomState | null {
  return rooms.get(id) ?? null;
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
  const t = turnTimers.get(id);
  if (t) clearTimeout(t);
  turnTimers.delete(id);
  const at = auctionTimers.get(id);
  if (at) clearTimeout(at);
  auctionTimers.delete(id);
  notifiedTurns.delete(id);
}

export function allRooms(): RoomState[] {
  return [...rooms.values()];
}

/**
 * Проверяет, сменился ли текущий игрок — если да, пушит уведомление через бота.
 * Вызывается после каждого применённого изменения состояния.
 */
export function onStateChange(room: RoomState): void {
  if (room.phase === "lobby" || room.phase === "ended") {
    clearTurnTimer(room.id);
    return;
  }

  // Nobody real is watching — freeze the turn timer and skip push
  // notifications. The room survives in memory for reconnects; if anyone
  // comes back we call onStateChange again and pick up where we left off.
  // Without this, a deserted room would keep pinging "your turn" forever
  // and bots would pointlessly cycle state.
  const anyHumanOnline = room.players.some((p) => p.connected && !p.isBot);
  if (!anyHumanOnline) {
    clearTurnTimer(room.id);
    clearAuctionTimer(room.id);
    return;
  }

  // Trade targeted at a bot: evaluate and accept/decline so the game doesn't stall.
  if (room.pendingTrade) {
    const target = room.players.find((pl) => pl.id === room.pendingTrade!.toId);
    if (target?.isBot) {
      resolveTrade(room, target.id, botShouldAcceptTrade(room, target.id));
    }
  }

  // Auction running with non-current bots in the bidder list?
  // Schedule the next bot to act so the auction doesn't freeze on
  // bots that aren't `currentPlayer` — the regular turnTimer only
  // ticks for the current turn, and an auction stretches across
  // every non-bankrupt player.
  if (room.auction && room.phase === "auction") {
    scheduleAuctionBotTick(room);
  } else {
    clearAuctionTimer(room.id);
  }

  // Pre-roll: current roller lives in the first bracket's pending queue, not
  // room.currentTurn. Always reset the timer — every roll hands off to the
  // next player, so there's no "same turn continues" case to skip.
  if (room.phase === "preRoll") {
    const roller = preRollCurrentPlayer(room);
    if (!roller) return;
    notifiedTurns.set(room.id, roller.id);
    resetTurnTimer(room);
    return;
  }

  const p = currentPlayer(room);
  if (!p) return;

  const prev = notifiedTurns.get(room.id);
  if (prev !== p.id) {
    notifiedTurns.set(room.id, p.id);
    // Push notification only for real humans who are offline. Bots have
    // synthetic tgUserIds; the telegram notifier would 400 on those.
    if (!p.connected && !p.isBot) {
      notifyTurn(p.tgUserId, room.id, p.name);
    }
    resetTurnTimer(room);
  } else if (room.phase === "rolling" && (!p.connected || p.isBot)) {
    // Same bot is up again (doubles). currentTurn didn't change, so the
    // turn-change branch above doesn't fire — but the bot still needs a
    // timer to auto-roll the bonus turn. Without this re-arm, a bot that
    // rolls doubles just freezes.
    resetTurnTimer(room);
  }
}

function resetTurnTimer(room: RoomState): void {
  clearTurnTimer(room.id);
  const current =
    room.phase === "preRoll" ? preRollCurrentPlayer(room) : currentPlayer(room);
  // Bots act almost immediately; disconnected humans get the full 180s grace.
  const delay = current?.isBot ? BOT_TURN_DELAY_MS : config.turnTimeoutSec * 1000;
  const timer = setTimeout(async () => {
    const fresh = getRoom(room.id);
    if (!fresh) return;

    // Pre-roll branch: auto-roll for whichever player is up. Same semantics as
    // the in-game timeout — bots act fast, AFK humans get the full grace period.
    if (fresh.phase === "preRoll") {
      const roller = preRollCurrentPlayer(fresh);
      if (!roller) return;
      const result = rollForOrder(fresh);
      if (result && broadcastMsg) {
        broadcastMsg(fresh.id, {
          type: "diceRolled",
          by: roller.id,
          dice: result.dice,
          from: roller.position,
          to: roller.position,
        });
      }
      if (broadcastState) broadcastState(fresh.id);
      onStateChange(fresh);
      return;
    }

    const p = currentPlayer(fresh);
    if (!p) return;

    // Bots always auto-act; humans only when offline.
    const aiMode = !p.connected || !!p.isBot;

    // Bots pay the jail fine if they can afford it rather than sitting
    // and eventually going bankrupt.
    if (aiMode && p.inJail && p.cash >= 50 && p.getOutCards.length === 0) {
      payJailFine(fresh, p.id);
    }

    if (fresh.phase === "rolling") {
      const rollRes = rollAndMove(fresh);
      // Broadcast diceRolled so clients animate the token walk exactly like
      // they do for human rolls. Without this the bot silently teleports.
      if (rollRes && broadcastMsg) {
        broadcastMsg(fresh.id, {
          type: "diceRolled",
          by: p.id,
          dice: rollRes.dice,
          from: rollRes.from,
          to: rollRes.to,
        });
      }
    }
    if (fresh.phase === "buyPrompt") {
      const { BOARD } = await import("../../../shared/board");
      const tile = BOARD[p.position];
      const price = (tile as any).price ?? 0;
      if (aiMode && price > 0 && p.cash >= price * 1.5) {
        const { buyCurrentProperty } = await import("../game/engine");
        buyCurrentProperty(fresh);
      } else {
        skipBuy(fresh);
      }
    }

    // Bots bid in auctions instead of always passing — otherwise a bot
    // that declines to buy effectively gifts every tile to the human for
    // free. Willingness is 50-85% of tile price, capped so the bot keeps
    // a $300 reserve for rents + jail fines.
    if (aiMode && fresh.auction && !fresh.auction.passedIds.includes(p.id)) {
      const { placeBid: engPlaceBid } = await import("../game/engine");
      const a = fresh.auction;
      const tile = BOARD[a.tileIndex];
      const price = (tile as { price?: number }).price ?? 0;
      const reserve = 300;
      const willingness = Math.floor(price * (0.5 + Math.random() * 0.35));
      const affordable = Math.max(0, p.cash - reserve);
      const myCap = Math.min(willingness, affordable);
      const nextBid = a.highBid + Math.floor(10 + Math.random() * 20);
      if (myCap > 0 && nextBid > a.highBid && nextBid <= myCap && a.highBidderId !== p.id) {
        engPlaceBid(fresh, p.id, nextBid);
      } else {
        passAuction(fresh, p.id);
      }
    }

    // AI: если есть монополии и деньги — строим дом на самой дешёвой улице без построек.
    if (aiMode) {
      await aiAutoBuild(fresh, p.id);
    }

    if (fresh.phase === "action") {
      engineEndTurn(fresh);
    }
    // Push the final state so the client sees the bot's purchases, builds,
    // and turn handoff. Done AFTER all mutations but BEFORE onStateChange so
    // the next timer's resetTurnTimer sees a stable broadcast baseline.
    if (broadcastState) broadcastState(fresh.id);
    onStateChange(fresh);
  }, delay);
  turnTimers.set(room.id, timer);
}

async function aiAutoBuild(room: RoomState, playerId: string): Promise<void> {
  const { BOARD, GROUP_SIZE } = await import("../../../shared/board");
  const { buildHouse } = await import("../game/engine");
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return;

  // Улицы, где у нас полная монополия, сортируем по стоимости дома (дешёвле — раньше)
  const myStreets = BOARD.filter(
    (t) => t.kind === "street" && room.properties[t.index]?.ownerId === playerId,
  ) as any[];

  // Группируем по цвету
  const byGroup = new Map<string, any[]>();
  for (const s of myStreets) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }

  const monopolies: any[] = [];
  for (const [group, list] of byGroup) {
    if (list.length === (GROUP_SIZE[group] ?? 0)) monopolies.push(...list);
  }

  monopolies.sort((a, b) => a.houseCost - b.houseCost);

  // Строим пока хватает денег, оставляя запас $300
  for (const street of monopolies) {
    if (p.cash < street.houseCost + 300) break;
    const res = buildHouse(room, playerId, street.index);
    if (!res.ok) continue;
  }
}

function clearTurnTimer(roomId: string): void {
  const t = turnTimers.get(roomId);
  if (t) clearTimeout(t);
  turnTimers.delete(roomId);
}

function clearAuctionTimer(roomId: string): void {
  const t = auctionTimers.get(roomId);
  if (t) clearTimeout(t);
  auctionTimers.delete(roomId);
}

/**
 * Pick the next bot in the auction's active bidder list that needs to
 * act (i.e. isn't already the high bidder, isn't passed, isn't
 * bankrupt) and arm a single setTimeout to bid or pass on its behalf.
 *
 * After the bot acts we broadcast state, which feeds back into
 * `onStateChange` and re-arms this scheduler — chained handoff that
 * naturally walks every bot in the bidder pool until one of these
 * exits is hit:
 *   - a human is now expected to bid (we pause; placeBid/passAuction
 *     from the human triggers the next onStateChange and we resume),
 *   - only the high bidder remains active → engine.maybeEndAuction
 *     finishes the auction.
 *
 * Idempotent: replaces any existing auction timer for the room.
 */
function scheduleAuctionBotTick(room: RoomState): void {
  if (!room.auction) {
    clearAuctionTimer(room.id);
    return;
  }
  const a = room.auction;
  const candidate = room.players.find(
    (p) =>
      p.isBot
      && !p.bankrupt
      && !a.passedIds.includes(p.id)
      && a.highBidderId !== p.id,
  );
  if (!candidate) {
    // Either the high bidder is the only active bidder (engine will
    // finish the auction), or only humans are left to act. Either way
    // the bot tick has nothing to do.
    clearAuctionTimer(room.id);
    return;
  }

  clearAuctionTimer(room.id);
  const timer = setTimeout(async () => {
    const fresh = getRoom(room.id);
    if (!fresh || !fresh.auction) return;
    const auction = fresh.auction;
    const bot = fresh.players.find((p) => p.id === candidate.id);
    if (!bot || bot.bankrupt) return;
    if (auction.passedIds.includes(bot.id)) return;
    if (auction.highBidderId === bot.id) return;

    // Same bidding heuristic as the in-turn auction branch: 50–85% of
    // tile price, capped to keep a $300 reserve.
    const tile = BOARD[auction.tileIndex];
    const price = (tile as { price?: number }).price ?? 0;
    const reserve = 300;
    const willingness = Math.floor(price * (0.5 + Math.random() * 0.35));
    const affordable = Math.max(0, bot.cash - reserve);
    const myCap = Math.min(willingness, affordable);
    const nextBid = auction.highBid + Math.floor(10 + Math.random() * 20);

    const { placeBid: engPlaceBid, passAuction: engPassAuction } = await import("../game/engine");
    if (myCap > 0 && nextBid > auction.highBid && nextBid <= myCap) {
      engPlaceBid(fresh, bot.id, nextBid);
    } else {
      engPassAuction(fresh, bot.id);
    }
    if (broadcastState) broadcastState(fresh.id);
    onStateChange(fresh);
  }, BOT_AUCTION_DELAY_MS);
  auctionTimers.set(room.id, timer);
}

/** Простая оценка входящего обмена глазами бота: принимаем если ценность того
 *  что получаем заметно выше того, что отдаём. Дома/отели на клетке плюсуют
 *  к её цене. Карточка "выйти из тюрьмы" оценена в $50 (стоимость штрафа). */
function botShouldAcceptTrade(room: RoomState, botId: string): boolean {
  const t = room.pendingTrade;
  if (!t || t.toId !== botId) return false;
  const bot = room.players.find((p) => p.id === botId);
  if (!bot) return false;
  // Бот не может отдать то, чего у него нет (на всякий — engine это тоже проверит).
  if (bot.cash < t.takeCash) return false;
  if (bot.getOutCards.length < t.takeJailCards) return false;

  const JAIL_CARD_VALUE = 50;

  function tileValue(idx: number): number {
    const tile = BOARD[idx];
    if (!tile) return 0;
    const base = (tile as { price?: number }).price ?? 0;
    const owned = room.properties[idx];
    if (owned?.hotel) return base + 5 * ((tile as { houseCost?: number }).houseCost ?? 0);
    if (owned?.houses) return base + owned.houses * ((tile as { houseCost?: number }).houseCost ?? 0);
    return base;
  }

  const botReceives =
    t.giveTiles.reduce((s, i) => s + tileValue(i), 0) + t.giveCash + t.giveJailCards * JAIL_CARD_VALUE;
  const botGives =
    t.takeTiles.reduce((s, i) => s + tileValue(i), 0) + t.takeCash + t.takeJailCards * JAIL_CARD_VALUE;

  // Нужно минимум на 20% выгоднее — иначе бот "думает" и отказывается.
  return botReceives >= botGives * 1.2 && botReceives > 0;
}
