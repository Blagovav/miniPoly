import type { RoomState } from "../../../shared/types";
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

  // Trade targeted at a bot: auto-decline so the game doesn't stall.
  if (room.pendingTrade) {
    const target = room.players.find((pl) => pl.id === room.pendingTrade!.toId);
    if (target?.isBot) {
      resolveTrade(room, target.id, false);
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
      rollAndMove(fresh);
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
