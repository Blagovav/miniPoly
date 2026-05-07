import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { RoomState, ServerMessage } from "../../../shared/types";
import type { CardEffect } from "../../../shared/cards";
import { CHANCE_CARDS, CHEST_CARDS } from "../../../shared/cards";
import { useTelegram } from "../composables/useTelegram";
import { diceDurationMs, startStep, stopStep } from "./../composables/useSounds";

function findCardEffect(cardId: string): CardEffect | null {
  const c = CHANCE_CARDS.find((x) => x.id === cardId)
    ?? CHEST_CARDS.find((x) => x.id === cardId);
  return c ? c.effect : null;
}

export interface ChatMessage {
  id: string;
  from: string;
  fromId: string;
  text: string;
  ts: number;
}

export const useGameStore = defineStore("game", () => {
  const { haptic } = useTelegram();
  const room = ref<RoomState | null>(null);
  const myPlayerId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  // Latest pending self-clear timer for `lastError`, so a fresh error
  // arriving mid-display can cancel the previous one and start its
  // own 3-second window cleanly.
  let errorClearTimer: ReturnType<typeof setTimeout> | null = null;
  const rolling = ref(false);
  const lastDice = ref<[number, number] | null>(null);
  const chat = ref<ChatMessage[]>([]);
  const unreadChat = ref(0);
  // Пошаговая анимация: пока идёт, отрисовка берёт значение отсюда, а не из player.position.
  const animatedPositions = ref<Record<string, number>>({});
  const animatingPlayerId = ref<string | null>(null);
  // Какую клетку посмотреть в info-модалке.
  const selectedTileIndex = ref<number | null>(null);
  // Juice: кратковременные визуальные события — приземление фишки (шоквейв
  // на клетке цветом игрока) и проход через GO (взрыв "+◈200" над углом).
  // ts нужен для самостирания — если за это время пришло новое событие, старое
  // уже не перезатирает текущее.
  const landedTile = ref<{ tileIndex: number; playerId: string; ts: number } | null>(null);
  const passedGo = ref<{ playerId: string; ts: number } | null>(null);

  function selectTile(idx: number | null) {
    selectedTileIndex.value = idx;
  }

  // In-game friends (independent of Telegram contacts) — backed by the
  // server's friend_requests table, accepted-only. Loaded on app boot
  // and on every friendStatusUpdate WS push.
  const friendIds = ref<Set<number>>(new Set());
  // Pending incoming requests (someone wants to friend me, awaiting my
  // accept/decline). Drives the global FriendRequestModal.
  interface IncomingRequest { requestId: number; fromUserId: number; fromName: string }
  const incomingFriendRequests = ref<IncomingRequest[]>([]);
  // Outbound requests I've sent that are still pending — used by Lobby
  // so the «В ДРУЗЬЯ» button flips to «Отправлено» right after I tap.
  const sentFriendRequests = ref<Set<number>>(new Set());

  async function loadFriends(myTgUserId: number | null) {
    if (!myTgUserId) return;
    try {
      const base = (import.meta.env.VITE_API_URL as string) || "";
      const res = await fetch(`${base}/api/users/${myTgUserId}/friends`);
      if (!res.ok) return;
      const data = await res.json();
      const ids = new Set<number>((data.friends ?? []).map((p: any) => Number(p.tgUserId)));
      friendIds.value = ids;
      incomingFriendRequests.value = (data.incoming ?? []).map((r: any) => ({
        requestId: Number(r.id),
        fromUserId: Number(r.fromUserId),
        fromName: String(r.fromName ?? "Игрок"),
      }));
    } catch {}
  }
  function isFriend(tgUserId: number): boolean {
    return friendIds.value.has(tgUserId);
  }
  function dismissIncomingRequest(requestId: number) {
    incomingFriendRequests.value = incomingFriendRequests.value.filter(
      (r) => r.requestId !== requestId,
    );
  }

  const BOARD_LEN = 40;

  function animateMove(playerId: string, from: number, to: number) {
    animatingPlayerId.value = playerId;
    animatedPositions.value = { ...animatedPositions.value, [playerId]: from };
    const steps = to >= from ? to - from : BOARD_LEN - from + to;
    if (steps === 0) {
      animatingPlayerId.value = null;
      delete animatedPositions.value[playerId];
      return;
    }
    let current = from;
    const stepDuration = 180;
    const isMe = playerId === myPlayerId.value;
    const startPos = from;
    // The walk SFX is one continuous mp3, so kick it off ONCE at the
    // start of the animation rather than per-step. Stop it on land so
    // the audio doesn't trail past the visual end (~1s+ leftover).
    startStep();
    const tick = () => {
      if (current === to) {
        stopStep();
        if (isMe) haptic("medium");
        const landTs = Date.now();
        landedTile.value = { tileIndex: to, playerId, ts: landTs };
        setTimeout(() => {
          if (landedTile.value?.ts === landTs) landedTile.value = null;
        }, 800);

        // Chance / Community Chest "Advance to X" cards: the server
        // resolves the card the instant the dice tile is hit, so by
        // the time we land here room.players[me].position is already
        // past `to`. Chain another walk forward so the visual matches —
        // playtester 2026-05-07 «фишка перепрыгивает через все поле,
        // должна как обычная прыгать». Backward-only cards (back-3,
        // jail) snap to keep the Hasbro semantics intact.
        const player = room.value?.players.find((pl) => pl.id === playerId);
        const finalPos = player?.position;
        const lastCard = room.value?.lastCard;
        const cardEffect = lastCard && lastCard.by === playerId
          ? findCardEffect(lastCard.cardId)
          : null;
        const isForwardCard = !!cardEffect && (
          cardEffect.kind === "advance" ||
          cardEffect.kind === "nearestRailroad" ||
          cardEffect.kind === "nearestUtility"
        );
        if (finalPos !== undefined && finalPos !== to && isForwardCard) {
          // Hold animatingPlayerId set across the pause so the toast
          // and CardModal wait for the FULL chained walk.
          setTimeout(() => animateMove(playerId, to, finalPos), 600);
          return;
        }

        // Buffer the animatingPlayerId clear so the result toast pops
        // AFTER the visual landing settles instead of concurrently with
        // the final hop — playtester 2026-05-07 «результат показывается
        // до того как фишка встнет на клетку».
        setTimeout(() => {
          animatingPlayerId.value = null;
          const next = { ...animatedPositions.value };
          delete next[playerId];
          animatedPositions.value = next;
        }, 250);
        return;
      }
      current = (current + 1) % BOARD_LEN;
      // Пересекли GO — ловим и сам заход на клетку 0, и проход сквозь неё.
      // Не триггерим, если игрок и так стартовал с 0 (иначе каждый ход с GO вспыхивает).
      if (current === 0 && startPos !== 0) {
        const goTs = Date.now();
        passedGo.value = { playerId, ts: goTs };
        setTimeout(() => {
          if (passedGo.value?.ts === goTs) passedGo.value = null;
        }, 1100);
        if (isMe) haptic("heavy");
      }
      animatedPositions.value = { ...animatedPositions.value, [playerId]: current };
      if (isMe) haptic("light");
      setTimeout(tick, stepDuration);
    };
    setTimeout(tick, 400);
  }

  const me = computed(() => room.value?.players.find((p) => p.id === myPlayerId.value) ?? null);
  const currentPlayer = computed(() => room.value?.players[room.value.currentTurn] ?? null);
  const isMyTurn = computed(() => !!me.value && currentPlayer.value?.id === me.value.id);
  const isHost = computed(() => !!me.value && room.value?.hostId === me.value.id);
  // Pre-roll phase: the "current" roller is the head of the first bracket's
  // pending queue — NOT room.players[currentTurn]. A separate computed so the
  // existing turn-slider + primary-button logic stays unchanged.
  const preRollCurrent = computed(() => {
    const r = room.value;
    if (!r || r.phase !== "preRoll") return null;
    const b = r.preRollBrackets?.[0];
    const pid = b?.pending?.[0];
    if (!pid) return null;
    return r.players.find((p) => p.id === pid) ?? null;
  });
  const isMyPreRoll = computed(
    () => !!me.value && preRollCurrent.value?.id === me.value.id,
  );

  function applyMessage(m: ServerMessage) {
    switch (m.type) {
      case "state":
        // Switching rooms wipes the chat backlog — old chat would be
        // misleading attached to a different game. Same-room reconnects
        // (e.g. after a settings round-trip) keep the buffer so users
        // don't lose their conversation. Playtester 2026-05-05: «зашел в
        // настройки игры вернулся и диалоги в чате пропали».
        if (room.value && room.value.id !== m.room.id) {
          chat.value = [];
          unreadChat.value = 0;
        }
        room.value = m.room;
        break;
      case "joined":
        myPlayerId.value = m.playerId;
        break;
      case "error":
        // Cancel any pending self-clear from a previous error before
        // starting a new 3s timer. Without this, error A's old timer
        // fires mid-display of error B and clears B prematurely.
        if (errorClearTimer !== null) clearTimeout(errorClearTimer);
        lastError.value = m.message;
        errorClearTimer = setTimeout(() => {
          lastError.value = null;
          errorClearTimer = null;
        }, 3000);
        break;
      case "diceRolled": {
        rolling.value = true;
        lastDice.value = m.dice;
        const dur = diceDurationMs() ?? 900;
        const by = m.by;
        const from = m.from;
        const to = m.to;
        // Pre-arm the animation override BEFORE the dice timeout so the
        // token stays anchored at `from` during the tumble phase. Without
        // this the state message that follows diceRolled (room with
        // player.position = to) renders the token at the destination,
        // and when animateMove finally fires it visually snaps back to
        // `from` and walks forward — playtester 2026-05-03 "фишка резко
        // перебегает на клетку, а потом начинает ходить".
        animatingPlayerId.value = by;
        animatedPositions.value = { ...animatedPositions.value, [by]: from };
        // Hold the rolling phase for the full duration of the dice mp3
        // so the visual tumble lands together with the audio thud.
        // Falls back to 900ms when the asset is still loading or audio
        // is muted. Token walk + toast popups are also deferred until
        // this timeout fires.
        setTimeout(() => {
          rolling.value = false;
          if (by === myPlayerId.value) haptic("heavy");
          animateMove(by, from, to);
        }, dur);
        break;
      }
      case "chat":
        chat.value.push({
          id: `${m.ts}-${m.fromId}-${chat.value.length}`,
          from: m.from,
          fromId: m.fromId,
          text: m.text,
          ts: m.ts,
        });
        if (chat.value.length > 100) chat.value.shift();
        unreadChat.value++;
        break;
      case "friendRequestIncoming":
        // Append unless already in queue (re-send while still pending).
        if (!incomingFriendRequests.value.some((r) => r.requestId === m.requestId)) {
          incomingFriendRequests.value = [
            ...incomingFriendRequests.value,
            { requestId: m.requestId, fromUserId: m.fromUserId, fromName: m.fromName },
          ];
        }
        break;
      case "friendStatusUpdate":
        if (m.status === "accepted") {
          const next = new Set(friendIds.value);
          next.add(m.otherUserId);
          friendIds.value = next;
        }
        // Either way clear any pending state on either side.
        if (sentFriendRequests.value.has(m.otherUserId)) {
          const next = new Set(sentFriendRequests.value);
          next.delete(m.otherUserId);
          sentFriendRequests.value = next;
        }
        incomingFriendRequests.value = incomingFriendRequests.value.filter(
          (r) => r.fromUserId !== m.otherUserId,
        );
        break;
    }
  }

  function reset() {
    room.value = null;
    myPlayerId.value = null;
    lastError.value = null;
    // Chat survives reset on purpose — RoomView calls reset() on every
    // unmount (incl. brief route trips like Settings), and wiping the
    // backlog here made the chat appear empty after coming back. The
    // "state" handler above clears it explicitly when the room.id
    // changes, so a true room switch still resets cleanly.
    landedTile.value = null;
    passedGo.value = null;
    animatedPositions.value = {};
    animatingPlayerId.value = null;
  }

  function markChatRead() {
    unreadChat.value = 0;
  }

  return {
    room,
    myPlayerId,
    lastError,
    rolling,
    lastDice,
    chat,
    unreadChat,
    animatedPositions,
    animatingPlayerId,
    landedTile,
    passedGo,
    selectedTileIndex,
    selectTile,
    friendIds,
    loadFriends,
    isFriend,
    incomingFriendRequests,
    sentFriendRequests,
    dismissIncomingRequest,
    me,
    currentPlayer,
    isMyTurn,
    isHost,
    preRollCurrent,
    isMyPreRoll,
    applyMessage,
    reset,
    markChatRead,
  };
});
