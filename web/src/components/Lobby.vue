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
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import TokenArt from "./TokenArt.vue";
import MapPickRow from "./MapPickRow.vue";
import BoardSelectModal from "./BoardSelectModal.vue";
import { ORDERED_PLAYER_COLORS, lighten, tokenArtFor } from "../utils/palette";

const props = defineProps<{
  room: RoomState;
  myPlayerId: string | null;
  onReady: () => void;
  onStart: () => void;
  onSelectToken: (tokenId: string) => void;
  onDestroyRoom: () => void;
}>();

const inv = useInventoryStore();
const { t, locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
void t;

// Lobby-only board pick (display-only — server doesn't pick boards yet).
const boardId = ref<string>("eldmark");
const boardModalOpen = ref(false);

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
// Only count connected — offline players shouldn't block Start.
const activePlayers = computed(() => props.room.players.filter((p) => p.connected));
const readyActive = computed(() => activePlayers.value.filter((p) => p.ready));
const canStart = computed(() =>
  activePlayers.value.length >= 2 && readyActive.value.length === activePlayers.value.length,
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

/** Telegram Mini App startapp-link — opens the bot with room_<id> payload. */
const inviteUrl = computed(
  () => `https://t.me/${botUsername}?startapp=room_${props.room.id}`,
);

const tg = (window as any).Telegram?.WebApp;

async function share() {
  const text = isRu.value
    ? `Го в Minipoly! Комната ${props.room.id}`
    : `Join me in Minipoly! Room ${props.room.id}`;
  // Inside Telegram — native share dialog.
  if (tg?.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl.value)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(shareUrl);
    return;
  }
  // Mobile browser with Web Share API.
  if (navigator.share) {
    try {
      await navigator.share({ title: "Minipoly", text, url: inviteUrl.value });
      return;
    } catch {}
  }
  // Fallback — copy to clipboard.
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {}
}

// Bilingual labels, mirroring the JSX LobbyScreen strings.
const L = computed(() => isRu.value
  ? {
      roomCode: "Код комнаты",
      copyLink: "Скопировать ссылку",
      copied: "Скопировано!",
      players: "Игроки",
      yourToken: "Ваша фишка",
      ready: "Готов",
      notReady: "Не готов",
      choosing: "Выбирает…",
      emptySeat: "Пустая скамья",
      start: "Начать игру",
      minPlayers: "Нужно минимум 2 готовых игрока",
      destroy: "Закрыть комнату",
      offline: "offline",
      takenBy: (name: string) => `Занята: ${name}`,
    }
  : {
      roomCode: "Room code",
      copyLink: "Copy link",
      copied: "Copied!",
      players: "At the table",
      yourToken: "Your token",
      ready: "Ready",
      notReady: "Not ready",
      choosing: "Choosing…",
      emptySeat: "Empty seat",
      start: "Begin the game",
      minPlayers: "Need at least 2 ready players",
      destroy: "Destroy room",
      offline: "offline",
      takenBy: (name: string) => `Taken: ${name}`,
    });
</script>

<template>
  <div class="content lobby">
    <!-- ── Room-code card ────────────────────────────────────── -->
    <div class="card lobby-code">
      <div class="lobby-code__label">{{ L.roomCode }}</div>
      <div class="lobby-code__value">{{ room.id }}</div>
      <button class="lobby-code__copy" @click="share">
        <Icon v-if="copied" name="check" :size="12" color="var(--primary)" />
        {{ copied ? L.copied : L.copyLink }}
      </button>
    </div>

    <!-- ── Map (host can change) ───────────────────────────── -->
    <div class="section-label">{{ isRu ? "Карта" : "Map" }}</div>
    <div class="lobby-map">
      <MapPickRow
        :board-id="boardId"
        :editable="isHost"
        :on-open="() => (boardModalOpen = true)"
      />
    </div>

    <!-- ── Players section ─────────────────────────────────── -->
    <div class="section-label">{{ L.players }}</div>
    <div class="players">
      <div
        v-for="(p, idx) in room.players"
        :key="p.id"
        class="row player-row"
        :class="{ 'player-row--me': p.id === myPlayerId }"
      >
        <Sigil :name="p.name" :color="colorForIndex(idx)" :size="36" />
        <div class="player-row__body">
          <div class="row gap-6 player-row__head">
            <span class="player-row__name">{{ p.name }}</span>
            <Icon v-if="room.hostId === p.id" name="crown" :size="14" color="var(--gold)" />
            <span v-if="!p.connected" class="offline-chip">{{ L.offline }}</span>
          </div>
          <div class="player-row__status">
            {{ p.ready ? L.ready : L.choosing }}
          </div>
        </div>
        <div class="ready-dot" :class="{ 'ready-dot--on': p.ready }">
          <Icon
            :name="p.ready ? 'check' : 'x'"
            :size="16"
            :color="p.ready ? '#fff' : 'var(--ink-4)'"
          />
        </div>
      </div>

      <!-- Empty-seat placeholder rows (dashed border) -->
      <div
        v-for="i in emptySeats"
        :key="'empty-' + i"
        class="row seat-empty"
      >
        <Icon name="plus" :size="18" color="var(--ink-4)" />
        {{ L.emptySeat }}
      </div>
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
        {{ me.ready ? L.ready : L.notReady }}
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
  gap: 8px;
  padding: 8px 14px 12px;
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

.lobby-map {
  margin-bottom: 2px;
}

/* ── Room-code card ── */
.lobby-code {
  text-align: center;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.lobby-code__label {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.lobby-code__value {
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 0.22em;
  color: var(--ink);
  line-height: 1.1;
}
.lobby-code__copy {
  margin-top: 8px;
  padding: 6px 12px;
  font-size: 11px;
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
  border-radius: 999px;
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lobby-code__copy:hover { background: rgba(90, 58, 154, 0.06); }
.lobby-code__copy:active { transform: translateY(1px); }

/* ── Section label ── */
.section-label {
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: -4px;
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
