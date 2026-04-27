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
      ready: "ГОТОВ",
      notReady: "НЕ ГОТОВ",
      choosing: "Готовится",
      readyStatus: "Готов",
      emptySeat: "Свободное место",
      start: "НАЧАТЬ ПАРТИЮ",
      minPlayers: "Готовых игроков нужно: 2",
      canStart: "Партию можно начать",
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
      ready: "READY",
      notReady: "NOT READY",
      choosing: "Getting ready",
      readyStatus: "Ready",
      emptySeat: "Empty seat",
      start: "START GAME",
      minPlayers: "Ready players needed: 2",
      canStart: "Ready to start",
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

    <!-- ── Players section (Figma 73:3483 — header w/ N/max badge) ── -->
    <div class="players-head">
      <div class="section-label">{{ L.players }}</div>
      <span class="players-count">{{ activePlayers.length }}/{{ room.maxPlayers }}</span>
    </div>
    <div class="players">
      <div
        v-for="(p, idx) in room.players"
        :key="p.id"
        class="player-row"
        :class="{ 'player-row--me': p.id === myPlayerId }"
      >
        <span
          v-if="p.isBot"
          class="player-row__avatar player-row__avatar--bot"
          aria-hidden="true"
        >
          <Icon name="users" :size="22" color="#fff"/>
        </span>
        <Sigil
          v-else
          class="player-row__avatar"
          :name="p.name"
          :color="colorForIndex(idx)"
          :size="40"
        />
        <div class="player-row__body">
          <div class="player-row__name">
            {{ p.name }}
            <Icon v-if="room.hostId === p.id" name="crown" :size="12" color="var(--gold)"/>
          </div>
          <div
            class="player-row__status"
            :class="{ 'player-row__status--ready': p.ready, 'player-row__status--off': !p.connected && !p.isBot }"
          >
            <template v-if="!p.connected && !p.isBot">{{ L.offline }}</template>
            <template v-else-if="p.ready">{{ L.readyStatus }}</template>
            <template v-else>{{ L.choosing }}</template>
          </div>
        </div>
        <button
          v-if="p.isBot && isHost && onRemoveBot"
          class="player-row__action player-row__action--kick"
          :title="L.kickBot"
          @click="onRemoveBot(p.id)"
        >
          <Icon name="x" :size="14" color="#000"/>
        </button>
        <span
          v-else-if="p.ready"
          class="player-row__action player-row__action--check"
          aria-hidden="true"
        >
          <Icon name="check" :size="14" color="#fff"/>
        </span>
      </div>

      <!-- Empty-seat placeholder rows: host can fill with a bot, others see a dashed slot. -->
      <template v-for="i in emptySeats" :key="'empty-' + i">
        <button
          v-if="i === 1 && canAddBot"
          type="button"
          class="seat-empty seat-empty--addable"
          @click="onAddBot"
        >
          <span class="seat-empty__avatar" aria-hidden="true">
            <Icon name="users" :size="22" color="var(--ink-3)"/>
          </span>
          <span class="seat-empty__name">{{ L.addBot }}</span>
          <span class="seat-empty__plus" aria-hidden="true">
            <Icon name="plus" :size="14" color="#fff"/>
          </span>
        </button>
        <div v-else class="seat-empty">
          <span class="seat-empty__avatar" aria-hidden="true">
            <Icon name="users" :size="22" color="var(--ink-4)"/>
          </span>
          <span class="seat-empty__name seat-empty__name--muted">{{ L.emptySeat }}</span>
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

    <!-- ── Actions (Figma 73:3483 / 93:8389) ───────────────── -->
    <div class="lobby-actions">
      <p
        class="lobby-hint"
        :class="{ 'lobby-hint--ok': canStart }"
      >
        {{ canStart ? L.canStart : L.minPlayers }}
      </p>

      <button
        v-if="me"
        type="button"
        class="lobby-cta"
        :class="me.ready ? 'lobby-cta--unready' : 'lobby-cta--ready'"
        @click="onReady"
      >
        <span class="lobby-cta__text">{{ me.ready ? L.notReady : L.ready }}</span>
        <svg
          class="lobby-cta__deco"
          viewBox="0 0 98 32.5"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            opacity="0.2"
            d="M98 9.5V32.5C98 32.5 97 6 89.5 4C82 2 0 0 0 0H88.5C96 0 98 3.5 98 9.5Z"
            fill="white"
          />
        </svg>
      </button>

      <button
        type="button"
        class="lobby-cta"
        :class="canStart ? 'lobby-cta--start' : 'lobby-cta--start-off'"
        :disabled="!canStart"
        @click="onStart"
      >
        <span class="lobby-cta__text">{{ L.start }}</span>
        <svg
          class="lobby-cta__deco"
          viewBox="0 0 98 32.5"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            opacity="0.2"
            d="M98 9.5V32.5C98 32.5 97 6 89.5 4C82 2 0 0 0 0H88.5C96 0 98 3.5 98 9.5Z"
            fill="white"
          />
        </svg>
      </button>

      <button
        v-if="isHost"
        type="button"
        class="lobby-destroy"
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
.players-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.players-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #000;
}

/* ── Players list (Figma 73:3611 player row) ── */
.players {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
}
.player-row--me { border-color: rgba(0, 0, 0, 0.24); }

.player-row__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.player-row__avatar--bot {
  background: #31e4c9;
  box-shadow: inset 0 -2px 2px rgba(0, 0, 0, 0.18);
}
.player-row__avatar :deep(.sigil) {
  width: 40px !important;
  height: 40px !important;
  font-size: 16px !important;
  background: transparent !important;
  box-shadow: none !important;
}

.player-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.player-row__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-row__status {
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}
.player-row__status--ready { color: #43c22d; }
.player-row__status--off   { color: #b32c2c; }

.player-row__action {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 120ms;
}
.player-row__action:hover { background: rgba(0, 0, 0, 0.04); }
.player-row__action--check {
  background: #43c22d;
  border-color: #43c22d;
  cursor: default;
}

/* ── Empty seat / Add bot row (Figma 93:8265) ── */
.seat-empty {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: 1.4px dashed rgba(0, 0, 0, 0.4);
  border-radius: 18px;
  text-align: left;
  font-family: 'Golos Text', sans-serif;
}
.seat-empty--addable {
  cursor: pointer;
  width: 100%;
  transition: background 120ms;
}
.seat-empty--addable:hover { background: rgba(0, 0, 0, 0.03); }
.seat-empty__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f0e9d9;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.seat-empty__name {
  flex: 1;
  min-width: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
}
.seat-empty__name--muted { color: rgba(0, 0, 0, 0.55); }
.seat-empty__plus {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #43c22d;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
}

/* ── Token picker (Figma 93:8316 — 6 white squares) ── */
.tokens-rail {
  display: flex;
  gap: 10px;
  padding: 4px 2px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tokens-rail::-webkit-scrollbar { display: none; }
.token-btn {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 80ms, border-color 160ms;
}
.token-btn:active { transform: translateY(1px); }
.token-btn--selected {
  border: 2px solid #000;
}
.token-btn--taken { opacity: 0.35; cursor: not-allowed; }
.token-medallion {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow:
    0 0 0 1.5px #fff,
    0 2px 4px rgba(0, 0, 0, 0.25),
    inset 0 1px 2px rgba(255, 255, 255, 0.4);
}
.token-btn--premium {
  background: radial-gradient(circle at 50% 40%, #3a2d0e, #1a130d);
  border-color: var(--gold);
}
.token-btn--premium .token-medallion {
  box-shadow:
    0 0 0 1.5px #fff,
    0 0 10px rgba(212, 168, 74, 0.5),
    inset 0 1px 2px rgba(255, 255, 255, 0.45);
}

/* ── Action CTAs (Figma 93:8527 / 93:8349 / 93:8548 — ГОТОВ / НАЧАТЬ ПАРТИЮ) ── */
.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  padding-bottom: calc(4px + var(--tg-safe-area-inset-bottom, 0px));
}
.lobby-hint {
  margin: 0;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.4);
}
.lobby-hint--ok { color: #43c22d; }

.lobby-cta {
  position: relative;
  width: 100%;
  height: 56px;
  padding: 0 18px;
  border: 2px solid #000;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease, filter 120ms ease;
}
.lobby-cta:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.lobby-cta:disabled { cursor: not-allowed; }

.lobby-cta--ready    { background: #2283f3; }
.lobby-cta--unready  { background: #f34822; }
.lobby-cta--start    { background: #43c22d; }
.lobby-cta--start-off { background: #b5b5b5; }

.lobby-cta__text {
  position: relative;
  z-index: 1;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.01em;
}
.lobby-cta__deco {
  position: absolute;
  top: 4px;
  right: 8px;
  width: 98px;
  height: 32.5px;
  pointer-events: none;
}

.lobby-destroy {
  margin-top: 4px;
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition: background 120ms;
}
.lobby-destroy:hover { background: rgba(0, 0, 0, 0.04); }
</style>
