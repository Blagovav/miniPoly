<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { useWs } from "../composables/useWs";
import { useGameStore } from "../stores/game";
import Board from "../components/Board.vue";
import Lobby from "../components/Lobby.vue";
import GameHud from "../components/GameHud.vue";
import Chat from "../components/Chat.vue";
import CardModal from "../components/CardModal.vue";

const props = defineProps<{ id: string }>();
const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const { initData, userName, haptic, notify } = useTelegram();
const game = useGameStore();
const ws = useWs();

import { useInventoryStore } from "../stores/inventory";
const inv = useInventoryStore();

let equippedApplied = false;
const off = ws.onMessage((m) => {
  game.applyMessage(m);
  if (m.type === "diceRolled") haptic("medium");
  if (m.type === "error") notify("error");
  // Как только нас приняли — применяем экипированную фишку.
  if (m.type === "joined" && !equippedApplied) {
    equippedApplied = true;
    const tokenId = inv.equippedToken;
    if (tokenId) ws.send({ type: "selectToken", tokenId });
  }
});
onUnmounted(() => {
  off();
  game.reset();
});

// Join on mount
onMounted(() => {
  ws.send({
    type: "join",
    roomId: props.id,
    tgInitData: initData.value,
    name: userName.value || "Player",
  });
});

// Redirect to home if room not found
watch(
  () => game.lastError,
  (err) => {
    if (err && err.includes("not found")) {
      setTimeout(() => router.replace({ name: "home" }), 2000);
    }
  },
);

const phase = computed(() => game.room?.phase);
const isLobby = computed(() => phase.value === "lobby" || !game.room);
const isEnded = computed(() => phase.value === "ended");

const winner = computed(() =>
  game.room?.winnerId ? game.room.players.find((p) => p.id === game.room?.winnerId) ?? null : null,
);

function ready() {
  haptic("light");
  ws.send({ type: "ready" });
}
function start() {
  haptic("medium");
  ws.send({ type: "start" });
}
function roll() {
  haptic("heavy");
  ws.send({ type: "roll" });
}
function buy() {
  haptic("medium");
  ws.send({ type: "buy" });
}
function skipBuy() {
  haptic("light");
  ws.send({ type: "skipBuy" });
}
function endTurn() {
  haptic("light");
  ws.send({ type: "endTurn" });
}
function sendChat(text: string) {
  ws.send({ type: "chat", text });
}
function selectToken(tokenId: string) {
  haptic("light");
  ws.send({ type: "selectToken", tokenId });
}
</script>

<template>
  <div class="room">
    <header class="room__head">
      <button class="btn btn--ghost back" @click="router.replace({ name: 'home' })">←</button>
      <div class="room__id">
        <span class="label">Room</span>
        <span class="code">{{ id }}</span>
      </div>
      <div v-if="game.lastError" class="error">{{ game.lastError }}</div>
    </header>

    <!-- Lobby state -->
    <Lobby
      v-if="game.room && isLobby"
      :room="game.room"
      :my-player-id="game.myPlayerId"
      :on-ready="ready"
      :on-start="start"
      :on-select-token="selectToken"
    />

    <!-- Game state -->
    <template v-else-if="game.room">
      <Board :room="game.room" />
      <GameHud
        :room="game.room"
        :me="game.me"
        :current="game.currentPlayer"
        :is-my-turn="game.isMyTurn"
        :rolling="game.rolling"
        :on-roll="roll"
        :on-buy="buy"
        :on-skip-buy="skipBuy"
        :on-end-turn="endTurn"
      />

      <!-- Winner overlay -->
      <transition name="fade">
        <div v-if="isEnded && winner" class="overlay">
          <div class="winner-card card">
            <div class="winner-card__emoji">🏆</div>
            <div class="winner-card__title">{{ t("game.winner", { name: winner.name }) }}</div>
            <button class="btn btn--primary big" @click="router.replace({ name: 'home' })">
              {{ t("actions.ok") }}
            </button>
          </div>
        </div>
      </transition>
    </template>

    <div v-else class="loading">
      <div class="spinner">🎲</div>
    </div>

    <!-- Chat overlay (always available when in a room) -->
    <Chat v-if="game.room" :on-send="sendChat" />
    <CardModal v-if="game.room" />
  </div>
</template>

<style scoped>
.room {
  max-width: 820px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: 10px 6px 16px;
}
.room__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.back {
  width: 40px; height: 40px; padding: 0; border-radius: 12px;
}
.room__id {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.label {
  font-size: 10px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.code {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--red);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
}

.loading {
  display: grid;
  place-items: center;
  min-height: 50vh;
}
.spinner {
  font-size: 48px;
  animation: spin 1.2s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: grid;
  place-items: center;
  backdrop-filter: blur(8px);
  z-index: 100;
}
.winner-card {
  padding: 32px 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  max-width: 320px;
  margin: 16px;
}
.winner-card__emoji {
  font-size: 72px;
  filter: drop-shadow(0 8px 20px rgba(251, 191, 36, 0.6));
}
.winner-card__title {
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--gold), #fff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.big { padding: 14px 24px; font-size: 15px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
