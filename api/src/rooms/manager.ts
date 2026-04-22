import type { RoomState, ServerMessage } from "../../../shared/types";
import { BOARD } from "../../../shared/board";
import { config } from "../config";
import { notifyTurn } from "../telegram";
import {
  currentPlayer,
  endTurn as engineEndTurn,
  passAuction,
  payJailFine,
  resolveTrade,
  rollAndMove,
  skipBuy,
} from "../game/engine";

// Bots move fast so 2+1 or 2+2 human-vs-bot games stay snappy.
const BOT_TURN_DELAY_MS = 2500;

const rooms = new Map<string, RoomState>();
const turnTimers = new Map<string, NodeJS.Timeout>();
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
    return;
  }

  // Trade targeted at a bot: evaluate and accept/decline so the game doesn't stall.
  if (room.pendingTrade) {
    const target = room.players.find((pl) => pl.id === room.pendingTrade!.toId);
    if (target?.isBot) {
      resolveTrade(room, target.id, botShouldAcceptTrade(room, target.id));
    }
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
  const current = currentPlayer(room);
  // Bots act almost immediately; disconnected humans get the full 180s grace.
  const delay = current?.isBot ? BOT_TURN_DELAY_MS : config.turnTimeoutSec * 1000;
  const timer = setTimeout(async () => {
    const fresh = getRoom(room.id);
    if (!fresh) return;
    const p = currentPlayer(fresh);
    if (!p) return;

    // Bots always auto-act; humans only when offline.
    const aiMode = !p.connected || !!p.isBot;

    // Bots pay the jail fine if they can afford it rather than sitting
    // and eventually going bankrupt.
    if (aiMode && p.inJail && p.cash >= 50 && p.getOutCards === 0) {
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

    // Bots always pass auctions (simplest behaviour — lets humans always win
    // or the auction resolves with no bidders).
    if (aiMode && fresh.auction && !fresh.auction.passedIds.includes(p.id)) {
      passAuction(fresh, p.id);
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
  if (bot.getOutCards < t.takeJailCards) return false;

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
