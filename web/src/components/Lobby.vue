<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RoomState } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";
import { useInventoryStore } from "../stores/inventory";

const props = defineProps<{
  room: RoomState;
  myPlayerId: string | null;
  onReady: () => void;
  onStart: () => void;
  onSelectToken: (tokenId: string) => void;
}>();

const inv = useInventoryStore();

const availableTokens = computed(() => {
  // Базовый набор бесплатных + купленные в магазине
  const freeTokens = ["token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo"];
  const owned = new Set(inv.owned);
  return SHOP_ITEMS.filter(
    (i) => i.kind === "token" && (freeTokens.includes(i.id) || owned.has(i.id)),
  );
});

function tokenIcon(tokenId: string): string {
  return SHOP_ITEMS.find((i) => i.id === tokenId)?.icon ?? "●";
}

// Какие токены уже заняты другими игроками
const takenTokens = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.room.players) {
    if (p.token && p.id !== props.myPlayerId) map.set(p.token, p.name);
  }
  return map;
});

const { t } = useI18n();
const copied = ref(false);

const me = computed(() => props.room.players.find((p) => p.id === props.myPlayerId));
const isHost = computed(() => !!me.value && props.room.hostId === me.value.id);
// Считаем только подключённых — offline-игроки не блокируют старт.
const activePlayers = computed(() => props.room.players.filter((p) => p.connected));
const readyActive = computed(() => activePlayers.value.filter((p) => p.ready));
const canStart = computed(() =>
  activePlayers.value.length >= 2 && readyActive.value.length === activePlayers.value.length,
);

const botUsername = (import.meta.env.VITE_BOT_USERNAME as string) || "poly_mini_bot";

/** Telegram Mini App startapp-link — при открытии в TG запускает наш Mini App с параметром. */
const inviteUrl = computed(
  () => `https://t.me/${botUsername}?startapp=room_${props.room.id}`,
);

const tg = (window as any).Telegram?.WebApp;

async function share() {
  const text = `🎲 Го в Minipoly! Комната ${props.room.id}`;
  // Внутри Telegram — открываем нативный share-диалог
  if (tg?.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl.value)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(shareUrl);
    return;
  }
  // Web Share API (мобильный браузер)
  if (navigator.share) {
    try {
      await navigator.share({ title: "Minipoly", text, url: inviteUrl.value });
      return;
    } catch {}
  }
  // Фоллбек — копируем в буфер
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {}
}
</script>

<template>
  <div class="lobby">
    <div class="card lobby__code-card">
      <div>
        <div class="lobby__code-label">{{ t("lobby.roomCode") }}</div>
        <div class="lobby__code">{{ room.id }}</div>
      </div>
      <button class="btn btn--ghost" @click="share">
        {{ copied ? `✓ ${t("lobby.copied")}` : `📤 ${t("lobby.copyInvite")}` }}
      </button>
    </div>

    <div class="card lobby__players">
      <div class="lobby__players-head">
        <span>{{ t("lobby.players") }}</span>
        <span class="chip">{{ room.players.length }}/6</span>
      </div>
      <div
        v-for="p in room.players"
        :key="p.id"
        class="player-row"
      >
        <div class="player-row__token" :style="{ background: p.color }">
          <span v-if="p.token">{{ tokenIcon(p.token) }}</span>
          <span v-else>{{ p.name.slice(0, 1).toUpperCase() }}</span>
        </div>
        <div class="player-row__body">
          <div class="player-row__name">
            {{ p.name }}
            <span v-if="room.hostId === p.id" class="chip host-chip">👑</span>
            <span v-if="!p.connected" class="chip offline-chip">offline</span>
          </div>
        </div>
        <div :class="['player-row__status', p.ready && 'ready']">
          {{ p.ready ? `✓ ${t("lobby.ready")}` : t("lobby.notReady") }}
        </div>
      </div>
    </div>

    <div class="card tokens">
      <div class="tokens__head">Выбери фишку</div>
      <div class="tokens__row">
        <button
          v-for="tk in availableTokens"
          :key="tk.id"
          :class="[
            'token-chip',
            me && me.token === tk.id && 'selected',
            takenTokens.has(tk.id) && 'taken',
          ]"
          :disabled="takenTokens.has(tk.id)"
          :title="takenTokens.get(tk.id) ? `Занята: ${takenTokens.get(tk.id)}` : ''"
          @click="onSelectToken(tk.id)"
        >
          <span class="token-chip__icon">{{ tk.icon }}</span>
        </button>
      </div>
    </div>

    <div class="lobby__actions">
      <button
        v-if="me"
        :class="['btn', me.ready ? 'btn--ghost' : 'btn--neon', 'big']"
        @click="onReady"
      >
        {{ me.ready ? `✓ ${t("lobby.ready")}` : t("lobby.ready") }}
      </button>
      <button
        class="btn btn--primary big"
        :disabled="!canStart"
        @click="onStart"
      >
        🚀 {{ t("lobby.start") }}
      </button>
      <p v-if="!canStart" class="waiting">{{ t("lobby.minPlayers") }}</p>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
}
.lobby__code-card {
  padding: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.lobby__code-label {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.lobby__code {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #fff, var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-top: 2px;
}

.lobby__players {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lobby__players-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-dim);
}
.player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid var(--border);
}
.player-row__token {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.player-row__body { flex: 1; }
.player-row__name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.host-chip { background: rgba(251, 191, 36, 0.15); border-color: rgba(251, 191, 36, 0.35); }
.offline-chip { color: var(--red); border-color: rgba(239, 68, 68, 0.35); }
.player-row__status {
  font-size: 12px;
  color: var(--text-mute);
  font-weight: 600;
}
.player-row__status.ready {
  color: var(--neon);
}

.lobby__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}
.big { padding: 16px; font-size: 15px; }
.waiting {
  text-align: center;
  color: var(--text-mute);
  font-size: 13px;
  margin: 4px 0;
}

.tokens {
  padding: 14px 16px;
}
.tokens__head {
  font-weight: 600;
  color: var(--text-dim);
  font-size: 13px;
  margin-bottom: 10px;
}
.tokens__row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.token-chip {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 2px solid var(--border);
  font-size: 24px;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}
.token-chip:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--purple); }
.token-chip.selected {
  border-color: var(--gold);
  background: rgba(251, 191, 36, 0.15);
  box-shadow: 0 0 0 1px var(--gold), 0 0 16px -4px rgba(251, 191, 36, 0.5);
}
.token-chip.taken {
  opacity: 0.3;
  cursor: not-allowed;
}
.token-chip__icon {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}

.player-row__token span {
  font-size: 18px;
  line-height: 1;
}
</style>
