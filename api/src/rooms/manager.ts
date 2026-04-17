import type { RoomState } from "../../../shared/types";
import { config } from "../config";
import { notifyTurn } from "../telegram";
import {
  currentPlayer,
  endTurn as engineEndTurn,
  rollAndMove,
  skipBuy,
} from "../game/engine";

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

  const p = currentPlayer(room);
  if (!p) return;

  const prev = notifiedTurns.get(room.id);
  if (prev !== p.id) {
    notifiedTurns.set(room.id, p.id);
    // Пушим только если игрок не в сети (свернул/закрыл приложение).
    // Если у него открытый WS — он видит экран, бот в личку не пишет.
    if (!p.connected) {
      notifyTurn(p.tgUserId, room.id, p.name);
    }
    resetTurnTimer(room);
  }
}

function resetTurnTimer(room: RoomState): void {
  clearTurnTimer(room.id);
  const timer = setTimeout(async () => {
    const fresh = getRoom(room.id);
    if (!fresh) return;
    const p = currentPlayer(fresh);
    if (!p) return;

    // AI-такэовер: если игрок offline — играем за него «разумно»
    const aiMode = !p.connected;

    if (fresh.phase === "rolling") {
      rollAndMove(fresh);
    }
    if (fresh.phase === "buyPrompt") {
      // AI: покупаем если можем позволить (оставляем запас > половины цены)
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
    if (fresh.phase === "action") {
      engineEndTurn(fresh);
    }
    onStateChange(fresh);
  }, config.turnTimeoutSec * 1000);
  turnTimers.set(room.id, timer);
}

function clearTurnTimer(roomId: string): void {
  const t = turnTimers.get(roomId);
  if (t) clearTimeout(t);
  turnTimers.delete(roomId);
}
