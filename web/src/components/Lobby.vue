<script setup lang="ts">
// Ported 1:1 from design-ref/screens_game.vue.js → LobbyScreen.
// Preserves all real-data logic: SHOP_ITEMS tokens, inventory, Telegram share,
// host-only destroy, takenTokens map, i18n and the onReady / onStart / onSelectToken /
// onDestroyRoom callbacks that RoomView wires up to the WebSocket.
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RoomState } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import TokenArt from "./TokenArt.vue";
import BoardPreview from "./BoardPreview.vue";
import BoardSelectModal from "./BoardSelectModal.vue";
import { findBoard } from "../utils/boards";
import { ORDERED_PLAYER_COLORS, lighten, tokenArtFor } from "../utils/palette";

const props = defineProps<{
  room: RoomState;
  myPlayerId: string | null;
  onReady: () => void;
  onStart: () => void;
  onSelectToken: (tokenId: string) => void;
  onDestroyRoom: () => void;
  onAddBot?: () => void;
  onRemoveBot?: (playerId: string) => void;
}>();

const inv = useInventoryStore();
const { t, locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
void t;

// Lobby-only board pick (display-only — server doesn't pick boards yet).
const boardId = ref<string>("eldmark");
const boardModalOpen = ref(false);
const board = computed(() => findBoard(boardId.value));
const boardName = computed(() => isRu.value ? board.value.ru : board.value.name);
const boardDesc = computed(() => isRu.value ? board.value.desc.ru : board.value.desc.en);

// Available tokens = free set + anything the player owns from the shop.
const availableTokens = computed(() => {
  const freeTokens = ["token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo"];
  const owned = new Set(inv.owned);
  return SHOP_ITEMS.filter(
    (i) => i.kind === "token" && (freeTokens.includes(i.id) || owned.has(i.id)),
  );
});

// Tokens already claimed by others (so we grey them out and block re-pick).
const takenTokens = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.room.players) {
    if (p.token && p.id !== props.myPlayerId) map.set(p.token, p.name);
  }
  return map;
});

const copied = ref(false);

const me = computed(() => props.room.players.find((p) => p.id === props.myPlayerId));
const isHost = computed(() => !!me.value && props.room.hostId === me.value.id);
// Only count connected — offline players shouldn't block Start. Bots count
// as connected for Start purposes even though their WS is absent.
const activePlayers = computed(() =>
  props.room.players.filter((p) => p.connected || p.isBot),
);
const readyActive = computed(() => activePlayers.value.filter((p) => p.ready));
const canStart = computed(() =>
  activePlayers.value.length >= 2 && readyActive.value.length === activePlayers.value.length,
);
const canAddBot = computed(
  () => {
    // Mirror the server's "viable seat" capacity check (engine.ts
    // addPlayer/addBot) — offline humans inside the 3-min reconnect
    // grace shouldn't visually block the host from filling the
    // remaining seat with a bot.
    if (!isHost.value || !props.onAddBot) return false;
    const seated = props.room.players.filter(
      (p) => p.connected || p.isBot,
    ).length;
    return seated < props.room.maxPlayers;
  },
);

// Deterministic colour per player from ORDERED_PLAYER_COLORS.
function colorForIndex(idx: number): string {
  return ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length];
}

// Empty seats = maxPlayers − current player count (dashed placeholder rows).
const emptySeats = computed(() => {
  const n = props.room.maxPlayers - props.room.players.length;
  return n > 0 ? n : 0;
});

// My own hue — used to tint the selected token medallion gradient.
const myColor = computed(() => {
  const idx = props.room.players.findIndex((p) => p.id === props.myPlayerId);
  return idx >= 0 ? colorForIndex(idx) : ORDERED_PLAYER_COLORS[0];
});

const botUsername = (import.meta.env.VITE_BOT_USERNAME as string) || "poly_mini_bot";
const API_URL = (import.meta.env.VITE_API_URL as string) || "";

/** Telegram Mini App startapp-link — opens the bot with room_<id> payload. */
const inviteUrl = computed(
  () => `https://t.me/${botUsername}?startapp=room_${props.room.id}`,
);

const { tg: tgRef, userId, userName } = useTelegram();
const tg = (window as any).Telegram?.WebApp;

async function share() {
  const tgApp: any = tgRef.value;
  const fromName = userName.value || "Игрок";

  // 1) Лучший UX — Telegram shareMessage (Bot API 7.8+):
  //    показывает нативный пикер чатов, адресату приходит карточка
  //    с превью, описанием и inline-кнопкой «Играть».
  if (tgApp?.shareMessage && userId.value) {
    try {
      const res = await fetch(`${API_URL}/api/invites/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tgUserId: userId.value,
          roomId: props.room.id,
          fromName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data.id) {
        tgApp.shareMessage(data.id);
        return;
      }
    } catch {
      // тихо падаем на legacy-share
    }
  }

  // 2) Legacy — openTelegramLink с t.me/share/url (без карточки, просто текст+ссылка).
  const text = isRu.value
    ? `Го в Minipoly! Игра ${props.room.id}`
    : `Join me in Minipoly! Game ${props.room.id}`;
  if (tg?.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl.value)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(shareUrl);
    return;
  }

  // 3) Mobile-браузер — Web Share API.
  if (navigator.share) {
    try {
      await navigator.share({ title: "Minipoly", text, url: inviteUrl.value });
      return;
    } catch {}
  }

  // 4) Последний шанс — скопировать ссылку в буфер.
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {}
}

// Bilingual labels, mirroring the JSX LobbyScreen strings.
const L = computed(() => isRu.value
  ? {
      roomCode: "Код игры",
      copyLink: "Скопировать ссылку",
      copied: "Скопировано!",
      players: "Игроки",
      yourToken: "Твоя фишка",
      ready: "Готов",
      notReady: "Не готов",
      choosing: "Выбирает…",
      emptySeat: "Свободное место",
      start: "Начать игру",
      minPlayers: "Нужно минимум 2 готовых игрока",
      destroy: "Закрыть игру",
      offline: "offline",
      bot: "Бот",
      addBot: "Добавить бота",
      kickBot: "Убрать бота",
      takenBy: (name: string) => `Занята: ${name}`,
    }
  : {
      roomCode: "Game code",
      copyLink: "Copy link",
      copied: "Copied!",
      players: "Players",
      yourToken: "Your token",
      ready: "Ready",
      notReady: "Not ready",
      choosing: "Choosing…",
      emptySeat: "Empty seat",
      start: "Start game",
      minPlayers: "Need at least 2 ready players",
      destroy: "Close game",
      offline: "offline",
      bot: "Bot",
      addBot: "Add a bot",
      kickBot: "Remove bot",
      takenBy: (name: string) => `Taken: ${name}`,
    });
</script>

<template>
  <div class="content lobby">
    <!-- ── Room code (Figma 73:3483) ─────────────────────────── -->
    <div class="lobby-section">
      <div class="lobby-section__label">{{ L.roomCode }}</div>
      <button class="lobby-code2" @click="share" :title="copied ? L.copied : L.copyLink">
        <span class="lobby-code2__value">{{ room.id }}</span>
        <span class="lobby-code2__icon" aria-hidden="true">
          <Icon v-if="copied" name="check" :size="14" color="#43c22d" />
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none">
            <rect x="8" y="8" width="12" height="12" rx="2.5" stroke="#000" stroke-width="1.6"/>
            <path d="M4 16V6.5A2.5 2.5 0 0 1 6.5 4H16" stroke="#000" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </span>
      </button>
    </div>

    <!-- ── Поле card (Figma 73:3591) ─────────────────────────── -->
    <div class="lobby-section lobby-section--card">
      <div class="lobby-section__label">{{ isRu ? "Поле" : "Map" }}</div>
      <button
        type="button"
        class="lobby-board"
        :disabled="!isHost"
        @click="isHost ? (boardModalOpen = true) : null"
      >
        <div class="lobby-board__art">
          <BoardPreview :board="board" :size="56"/>
        </div>
        <div class="lobby-board__body">
          <div class="lobby-board__name">{{ boardName }}</div>
          <div class="lobby-board__desc">{{ boardDesc }}</div>
        </div>
        <img
          v-if="isHost"
          class="lobby-board__edit"
          src="/figma/create/edit-pencil.svg"
          alt=""
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- ── Players section ─────────────────────────────────── -->
    <div class="section-label">{{ L.players }}</div>
    <div class="players">
      <div
        v-for="(p, idx) in room.players"
        :key="p.id"
        class="row player-row"
        :class="{
          'player-row--me': p.id === myPlayerId,
          'player-row--bot': p.isBot,
        }"
      >
        <Sigil :name="p.name" :color="colorForIndex(idx)" :size="36" />
        <div class="player-row__body">
          <div class="row gap-6 player-row__head">
            <span class="player-row__name">{{ p.name }}</span>
            <Icon v-if="room.hostId === p.id" name="crown" :size="14" color="var(--gold)" />
            <span v-if="p.isBot" class="bot-chip">{{ L.bot }}</span>
            <span v-else-if="!p.connected" class="offline-chip">{{ L.offline }}</span>
          </div>
          <div class="player-row__status">
            {{ p.ready ? L.ready : L.choosing }}
          </div>
        </div>
        <button
          v-if="p.isBot && isHost && onRemoveBot"
          class="kick-btn"
          :title="L.kickBot"
          @click="onRemoveBot(p.id)"
        >
          <Icon name="x" :size="14" color="var(--accent)" />
        </button>
        <div v-else class="ready-dot" :class="{ 'ready-dot--on': p.ready }">
          <Icon
            :name="p.ready ? 'check' : 'x'"
            :size="16"
            :color="p.ready ? '#fff' : 'var(--ink-4)'"
          />
        </div>
      </div>

      <!-- Empty-seat placeholder rows: host can fill with a bot, others see a dashed slot. -->
      <template v-for="i in emptySeats" :key="'empty-' + i">
        <button
          v-if="i === 1 && canAddBot"
          class="row seat-empty seat-empty--addable"
          @click="onAddBot"
        >
          <Icon name="plus" :size="18" color="var(--primary)" />
          <span>{{ L.addBot }}</span>
        </button>
        <div v-else class="row seat-empty">
          <Icon name="plus" :size="18" color="var(--ink-4)" />
          {{ L.emptySeat }}
        </div>
      </template>
    </div>

    <!-- ── Token picker (medallion buttons) ──────────────── -->
    <div class="section-label">{{ L.yourToken }}</div>
    <div class="rail tokens-rail">
      <button
        v-for="tk in availableTokens"
        :key="tk.id"
        class="token-btn"
        :class="{
          'token-btn--selected': me && me.token === tk.id,
          'token-btn--taken': takenTokens.has(tk.id),
          'token-btn--premium': !!tk.starsPrice,
        }"
        :disabled="takenTokens.has(tk.id)"
        :title="takenTokens.get(tk.id) ? L.takenBy(takenTokens.get(tk.id)!) : ''"
        @click="onSelectToken(tk.id)"
      >
        <span
          class="token-medallion"
          :style="{
            background: tk.starsPrice
              ? 'radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914)'
              : `radial-gradient(circle at 32% 28%, ${lighten(myColor, 0.45)}, ${myColor} 60%, ${lighten(myColor, -0.25)})`,
          }"
        >
          <TokenArt :id="tokenArtFor(tk.id)" :size="30" color="#fff" shadow="rgba(0,0,0,0.55)" />
        </span>
      </button>
    </div>

    <!-- ── Actions ──────────────────────────────────────── -->
    <div class="lobby-actions">
      <button
        v-if="me"
        class="btn"
        :class="me.ready ? 'btn-ghost' : 'btn-primary'"
        @click="onReady"
      >
        <Icon
          v-if="me.ready"
          name="check"
          :size="16"
          color="var(--emerald)"
        />
        {{ me.ready ? L.notReady : L.ready }}
      </button>

      <button
        class="btn"
        :class="canStart ? 'btn-primary' : 'btn-ghost'"
        :disabled="!canStart"
        @click="onStart"
      >
        <Icon name="dice" :size="16" :color="canStart ? '#fff' : 'var(--ink-3)'" />
        {{ L.start }}
      </button>

      <p v-if="!canStart" class="waiting-hint">{{ L.minPlayers }}</p>

      <button
        v-if="isHost"
        class="btn btn-wax destroy-btn"
        @click="onDestroyRoom"
      >
        {{ L.destroy }}
      </button>
    </div>

    <BoardSelectModal
      :open="boardModalOpen"
      :selected-id="boardId"
      :is-host="isHost"
      :on-close="() => (boardModalOpen = false)"
      :on-select="(id) => (boardId = id)"
    />
  </div>
</template>

<style scoped>
/*
  Layout: matches the design-ref LobbyScreen — a padded .content column with
  14px gap. Visuals reuse our design tokens (--card, --primary, --line,
  --emerald, --gold) so we stay consistent with the rest of the app.
*/
.lobby {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: clip;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
/* Flex children of .lobby must not shrink — otherwise the tokens rail gets
   crushed when total content exceeds the viewport. */
.lobby > * { flex-shrink: 0; }

/* ── Figma section labels + cards (73:3483) ── */
.lobby-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lobby-section--card {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
}
.lobby-section__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  margin: 0;
}

/* Room code card — big Golos Medium value + copy button on the right. */
.lobby-code2 {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease;
}
.lobby-code2:hover { background: #fafafa; }
.lobby-code2:active { transform: scale(0.99); }
.lobby-code2__value {
  flex: 1;
  min-width: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 32px;
  line-height: 34px;
  color: #000;
  letter-spacing: 0;
  word-break: break-all;
}
.lobby-code2__icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

/* Field card — mirror of CreateView's board picker. */
.lobby-board {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
.lobby-board:disabled { cursor: default; }
.lobby-board__art {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  background: #f0e9d9;
  flex-shrink: 0;
  line-height: 0;
}
.lobby-board__art :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.lobby-board__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lobby-board__name {
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
}
.lobby-board__desc {
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: #000;
  opacity: 0.85;
}
.lobby-board__edit {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  pointer-events: none;
}
/* ── Section label (Игроки / Твоя фишка below the Figma sections) ── */
.section-label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  margin: 0;
}

/* ── Players list ── */
.players {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.player-row {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 10px;
  gap: 10px;
}
.player-row--me {
  background: rgba(90, 58, 154, 0.06);
  border-color: var(--primary);
}
.player-row__body {
  flex: 1;
  min-width: 0;
}
.player-row__head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gap-6 { gap: 6px; }
.player-row__name {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-row__status {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}
.offline-chip {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid rgba(139, 26, 26, 0.35);
  border-radius: 999px;
  color: var(--accent);
  letter-spacing: 0.05em;
}
.bot-chip {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid rgba(90, 58, 154, 0.35);
  border-radius: 999px;
  color: var(--primary);
  background: rgba(90, 58, 154, 0.08);
  letter-spacing: 0.05em;
  font-family: var(--font-mono);
  text-transform: uppercase;
}
.player-row--bot {
  border-style: dashed;
  border-color: rgba(90, 58, 154, 0.4);
}

.kick-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid rgba(139, 26, 26, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 120ms;
}
.kick-btn:hover { background: rgba(139, 26, 26, 0.08); }

.ready-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--card-alt);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ready-dot--on {
  background: var(--emerald);
  border-color: var(--emerald);
}

.seat-empty {
  background: transparent;
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--ink-4);
  font-style: italic;
  font-size: 13px;
  gap: 10px;
}
.seat-empty--addable {
  color: var(--primary);
  border-color: var(--primary);
  font-style: normal;
  cursor: pointer;
  font-family: var(--font-display);
  font-weight: 500;
  transition: background 120ms;
  width: 100%;
  text-align: left;
}
.seat-empty--addable:hover { background: rgba(90, 58, 154, 0.06); }

/* ── Token rail ── */
/* padding on both axes: overflow-x: auto on .rail implicitly clips -y too,
   and the selected token's 2px box-shadow ring would otherwise lose its top. */
.tokens-rail {
  padding: 4px 2px;
  flex-shrink: 0;
}
.token-btn {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  background: linear-gradient(145deg, var(--card-alt), var(--bg-deep));
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 80ms, border-color 160ms, box-shadow 160ms;
}
.token-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--primary);
}
.token-btn:active { transform: translateY(1px); }
.token-btn--selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary), 0 4px 10px rgba(90, 58, 154, 0.25);
}
.token-btn--premium {
  background: radial-gradient(circle at 50% 40%, #3a2d0e, #1a130d);
  border-color: var(--gold);
}
.token-btn--premium.token-btn--selected {
  box-shadow: 0 0 0 2px var(--gold), 0 4px 12px rgba(212, 168, 74, 0.4);
}
.token-btn--taken { opacity: 0.35; cursor: not-allowed; }
.token-medallion {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow:
    0 0 0 2px #fff,
    0 3px 6px rgba(0, 0, 0, 0.35),
    inset 0 1px 2px rgba(255, 255, 255, 0.4);
}
.token-btn--premium .token-medallion {
  box-shadow:
    0 0 0 2px #fff,
    0 0 14px rgba(212, 168, 74, 0.55),
    0 4px 10px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.5);
}

/* ── Action buttons ── */
.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
  padding-bottom: calc(4px + var(--tg-safe-area-inset-bottom, 0px));
}
.lobby-actions .btn {
  width: 100%;
  padding: 11px;
  font-size: 14px;
}
.waiting-hint {
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
  margin: 2px 0 0;
}
.destroy-btn {
  margin-top: 4px;
  font-size: 13px;
  padding: 10px;
}
</style>
