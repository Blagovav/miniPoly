import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { RoomState, ServerMessage } from "../../../shared/types";
import { useTelegram } from "../composables/useTelegram";
import { playStep } from "./../composables/useSounds";

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

  // Друзья (tgUserId, с кем уже играл) — для подсветки в лобби/игре.
  const friendIds = ref<Set<number>>(new Set());
  async function loadFriends(myTgUserId: number | null) {
    if (!myTgUserId) return;
    try {
      const base = (import.meta.env.VITE_API_URL as string) || "";
      const res = await fetch(`${base}/api/users/${myTgUserId}/coplayers`);
      if (!res.ok) return;
      const data = await res.json();
      const ids = new Set<number>((data.players ?? []).map((p: any) => Number(p.tgUserId)));
      friendIds.value = ids;
    } catch {}
  }
  function isFriend(tgUserId: number): boolean {
    return friendIds.value.has(tgUserId);
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
    const tick = () => {
      if (current === to) {
        animatingPlayerId.value = null;
        const next = { ...animatedPositions.value };
        delete next[playerId];
        animatedPositions.value = next;
        if (isMe) haptic("medium");
        const landTs = Date.now();
        landedTile.value = { tileIndex: to, playerId, ts: landTs };
        setTimeout(() => {
          if (landedTile.value?.ts === landTs) landedTile.value = null;
        }, 800);
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
      // Step SFX fires for EVERY player's walk (not just isMe) so other
      // players' turns also get audio feedback. Volume is intentionally
      // reduced inside playStep so a 12-step roll doesn't deafen.
      playStep();
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
      case "diceRolled":
        rolling.value = true;
        lastDice.value = m.dice;
        // 900мс — совпадает с длиной цикла tumble в Dice.vue; когда флаг
        // падает, кости снэпятся на финальные значения и вспыхивают.
        setTimeout(() => {
          rolling.value = false;
          if (m.by === myPlayerId.value) haptic("heavy");
        }, 900);
        animateMove(m.by, m.from, m.to);
        break;
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
    }
  }

  function reset() {
    room.value = null;
    myPlayerId.value = null;
    lastError.value = null;
    chat.value = [];
    unreadChat.value = 0;
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
