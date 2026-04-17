<script setup lang="ts">
// Chrome for the room screen — topbar + error strip + winner overlay
// + phase-based rendering (lobby / game / ended).
//
// Template/visuals ported from design-ref/screens_game.vue.js → GameScreen
// (TopBar, winner overlay, triples banner). All 20+ handlers remain intact
// and simply forward to the WebSocket through useWs().
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
import CardHistoryModal from "../components/CardHistoryModal.vue";
import AuctionModal from "../components/AuctionModal.vue";
import TileInfoModal from "../components/TileInfoModal.vue";
import Confetti from "../components/Confetti.vue";
import OpponentsPanel from "../components/OpponentsPanel.vue";
import PlayerProfileModal from "../components/PlayerProfileModal.vue";
import TradeBanner from "../components/TradeBanner.vue";
import Icon from "../components/Icon.vue";
import type { Player } from "../../../shared/types";

const props = defineProps<{ id: string }>();
const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const { initData, userName, haptic, notify } = useTelegram();
const game = useGameStore();
const ws = useWs();

import { useInventoryStore } from "../stores/inventory";
const inv = useInventoryStore();

// Subscribe to server messages. Applies state, triggers haptics, auto-sends
// the equipped token id the first time we're accepted into the room.
let equippedApplied = false;
const off = ws.onMessage((m) => {
  game.applyMessage(m);
  if (m.type === "diceRolled") haptic("medium");
  if (m.type === "error") notify("error");
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

// Join on mount + remember room id for friend-invites deep link.
onMounted(() => {
  ws.send({
    type: "join",
    roomId: props.id,
    tgInitData: initData.value,
    name: userName.value || "Player",
  });
  try { localStorage.setItem("activeRoomId", props.id); } catch {}
  const { userId } = useTelegram();
  game.loadFriends(userId.value);
});

// Redirect to home if the server tells us the room is gone.
watch(
  () => game.lastError,
  (err) => {
    if (err && err.includes("not found")) {
      setTimeout(() => router.replace({ name: "home" }), 2000);
    }
  },
);

// ── Computed phase flags & friends/winner ───────────────
const phase = computed(() => game.room?.phase);
const isLobby = computed(() => phase.value === "lobby" || !game.room);
const isEnded = computed(() => phase.value === "ended");

const winner = computed(() =>
  game.room?.winnerId ? game.room.players.find((p) => p.id === game.room?.winnerId) ?? null : null,
);

const playerCount = computed(() => game.room?.players.length ?? 0);
const isHostMe = computed(() => {
  if (!game.room || !game.myPlayerId) return false;
  return game.room.hostId === game.myPlayerId;
});

// ── WS action handlers (the "20+") ─────────────────────
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

function leaveRoom() {
  const inGame = game.room && game.room.phase !== "lobby" && game.room.phase !== "ended";
  if (inGame) {
    const ok = confirm(
      locale.value === "ru"
        ? "Выйти из партии? Ты вылетишь из игры и потеряешь собственность."
        : "Leave the game? You'll forfeit your properties.",
    );
    if (!ok) return;
  }
  haptic("medium");
  ws.send({ type: "leave" });
  try { localStorage.removeItem("activeRoomId"); } catch {}
  setTimeout(() => router.replace({ name: "home" }), 100);
}

function destroyRoom() {
  const ok = confirm(
    locale.value === "ru" ? "Закрыть комнату для всех?" : "Close room for everyone?",
  );
  if (!ok) return;
  haptic("heavy");
  ws.send({ type: "destroyRoom" });
  setTimeout(() => router.replace({ name: "home" }), 100);
}

function buildHouse(tileIndex: number) {
  haptic("medium");
  ws.send({ type: "buildHouse", tileIndex });
}
function sellHouse(tileIndex: number) {
  haptic("light");
  ws.send({ type: "sellHouse", tileIndex });
}

const profilePlayer = ref<Player | null>(null);
function openProfile(p: Player) {
  haptic("light");
  profilePlayer.value = p;
}
function closeProfile() {
  profilePlayer.value = null;
}

function proposeTrade(tileIndex: number, cash: number) {
  haptic("medium");
  ws.send({ type: "proposeTrade", tileIndex, cash });
}
function respondTrade(accept: boolean) {
  haptic(accept ? "medium" : "light");
  ws.send({ type: "respondTrade", accept });
}

function mortgage(tileIndex: number) {
  haptic("light");
  ws.send({ type: "mortgage", tileIndex });
}
function unmortgage(tileIndex: number) {
  haptic("medium");
  ws.send({ type: "unmortgage", tileIndex });
}
function pickTripleTile(tileIndex: number) {
  haptic("heavy");
  ws.send({ type: "pickTripleTile", tileIndex });
}
function placeBid(amount: number) {
  haptic("medium");
  ws.send({ type: "placeBid", amount });
}
function passAuction() {
  haptic("light");
  ws.send({ type: "passAuction" });
}

// Triples pick UI state (the banner + BoardTile click semantics).
const isTriplesPick = computed(() => game.room?.phase === "triplesPick" && game.isMyTurn);
const triplesValue = computed(() => {
  const d = game.room?.dice;
  return d && d[0] === d[1] ? d[0] : null;
});

// Card history modal open state.
const cardHistoryOpen = ref(false);
function openCardHistory() { cardHistoryOpen.value = true; haptic("light"); }
function closeCardHistory() { cardHistoryOpen.value = false; }

// Right-side topbar button action — acts as host close in lobby, else leave.
function handleMenu() {
  if (isHostMe.value && game.room?.phase === "lobby") {
    destroyRoom();
  } else {
    leaveRoom();
  }
}

// Player-count subtitle (russian-aware pluralisation).
const subtitle = computed(() => {
  if (!game.room) return locale.value === "ru" ? "Подключение…" : "Connecting…";
  const n = playerCount.value;
  if (locale.value === "ru") return `${n} ${n === 1 ? "игрок" : n < 5 ? "игрока" : "игроков"}`;
  return `${n} ${n === 1 ? "player" : "players"}`;
});

void route;
void t;
</script>

<template>
  <div class="room">
    <!-- ── Topbar ── -->
    <div class="topbar">
      <button class="icon-btn" :aria-label="t('actions.back')" @click="leaveRoom">
        <Icon name="back" :size="18" />
      </button>
      <div class="title">
        <h1>{{ locale === 'ru' ? 'Комната' : 'Room' }} · {{ id }}</h1>
        <div class="sub">{{ subtitle }}</div>
      </div>
      <button class="icon-btn" aria-label="menu" @click="handleMenu">
        <Icon :name="isHostMe && game.room?.phase === 'lobby' ? 'x' : 'menu'" :size="18" />
      </button>
    </div>

    <!-- ── Error strip (wax red) ── -->
    <transition name="fade">
      <div v-if="game.lastError" class="error-strip">
        <Icon name="x" :size="14" color="#fff" />
        <span>{{ game.lastError }}</span>
      </div>
    </transition>

    <!-- ── Lobby phase ── -->
    <Lobby
      v-if="game.room && isLobby"
      :room="game.room"
      :my-player-id="game.myPlayerId"
      :on-ready="ready"
      :on-start="start"
      :on-select-token="selectToken"
      :on-destroy-room="destroyRoom"
    />

    <!-- ── In-game / ended phases ── -->
    <template v-else-if="game.room">
      <!-- Triples banner: appears only when it's my turn and phase is triplesPick -->
      <transition name="triples">
        <div v-if="isTriplesPick" class="triples-banner">
          <div class="triples-banner__seal">
            <Icon name="dice" :size="20" color="#fff" />
          </div>
          <div class="triples-banner__body">
            <div class="triples-banner__title">
              {{ locale === 'ru' ? 'ДУБЛЬ!' : 'TRIPLES!' }}
              <span v-if="triplesValue" class="triples-banner__val">
                {{ locale === 'ru' ? 'три' : 'three' }} {{ triplesValue }}
              </span>
            </div>
            <div class="triples-banner__sub">
              {{ locale === 'ru' ? 'Тапни любую клетку — прыгнешь туда' : 'Tap any tile to jump there' }}
            </div>
          </div>
        </div>
      </transition>

      <OpponentsPanel :room="game.room" :my-player-id="game.myPlayerId" @open-profile="openProfile" />
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
        :on-open-card-history="openCardHistory"
      />

      <!-- ── Winner overlay (end of game) ── -->
      <transition name="fade">
        <div v-if="isEnded && winner" class="overlay">
          <Confetti />
          <div class="winner-card">
            <div class="winner-card__fleuron">❦</div>
            <div class="winner-card__crown">
              <Icon name="crown" :size="64" color="var(--gold)" />
            </div>
            <div class="winner-card__kicker">
              {{ locale === 'ru' ? 'ПОБЕДИТЕЛЬ' : 'VICTOR' }}
            </div>
            <div class="winner-card__name">{{ winner.name }}</div>
            <div class="winner-card__sub">
              {{ locale === 'ru' ? 'Корона твоя' : 'The crown is yours' }}
            </div>
            <button
              class="btn btn-primary winner-card__btn"
              @click="router.replace({ name: 'home' })"
            >
              {{ t("actions.ok") }}
            </button>
          </div>
        </div>
      </transition>
    </template>

    <!-- ── Initial load spinner ── -->
    <div v-else class="loading">
      <div class="spinner">
        <Icon name="dice" :size="48" color="var(--primary)" />
      </div>
      <div class="loading-text">
        {{ locale === 'ru' ? 'Открываем ворота…' : 'Opening the gates…' }}
      </div>
    </div>

    <!-- ── Global overlays (chat, card, auction, tile, profile, trade) ── -->
    <Chat v-if="game.room" :on-send="sendChat" />
    <CardModal v-if="game.room" />
    <CardHistoryModal v-if="game.room" :open="cardHistoryOpen" :on-close="closeCardHistory" />
    <AuctionModal v-if="game.room" :on-bid="placeBid" :on-pass="passAuction" />
    <TileInfoModal
      v-if="game.room"
      :on-build-house="buildHouse"
      :on-sell-house="sellHouse"
      :on-propose-trade="proposeTrade"
      :on-mortgage="mortgage"
      :on-unmortgage="unmortgage"
      :on-pick-triple-tile="pickTripleTile"
    />
    <PlayerProfileModal :player="profilePlayer" :on-close="closeProfile" />
    <TradeBanner v-if="game.room" :on-respond="respondTrade" />
  </div>
</template>

<style scoped>
.room {
  max-width: 820px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: 0 0 16px;
  position: relative;
  background: var(--bg);
}

/* Topbar title styling override — room-specific compact look. */
.topbar .title h1 {
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0.02em;
  color: var(--ink);
  margin: 0;
  line-height: 1.1;
  font-weight: 400;
}
.topbar .title .sub {
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.05em;
  margin-top: 2px;
  text-transform: uppercase;
  font-weight: 500;
}

/* ── Error strip (wax red) ── */
.error-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 14px 8px;
  padding: 10px 14px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: #fff;
  border-radius: var(--r-md);
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(139, 26, 26, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  position: relative;
  z-index: 5;
}
.error-strip::before {
  content: '';
  position: absolute;
  left: 6px; top: 50%;
  transform: translateY(-50%);
  width: 4px; height: 70%;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

/* ── Loading placeholder ── */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 60vh;
  padding: 40px 20px;
}
.spinner { animation: spin 2s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Winner overlay ── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 100;
}
.winner-card {
  position: relative;
  background: var(--card-alt);
  border: 1px solid var(--line-strong);
  border-top: 4px solid var(--gold);
  border-radius: var(--r-lg);
  padding: 32px 28px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  max-width: 320px;
  margin: 16px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.winner-card::before {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px solid var(--gold);
  opacity: 0.35;
  border-radius: calc(var(--r-lg) - 2px);
  pointer-events: none;
}
.winner-card__fleuron {
  font-family: var(--font-title);
  font-size: 18px;
  color: var(--gold);
  letter-spacing: 0.2em;
  margin-bottom: 4px;
}
.winner-card__crown {
  filter: drop-shadow(0 4px 12px rgba(184, 137, 46, 0.45));
  margin-bottom: 4px;
}
.winner-card__kicker {
  font-family: var(--font-title);
  font-size: 12px;
  letter-spacing: 0.35em;
  color: var(--gold);
  margin-bottom: 2px;
  text-transform: uppercase;
}
.winner-card__name {
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--ink);
  line-height: 1.15;
  font-weight: 400;
  margin: 2px 0 4px;
}
.winner-card__sub {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink-3);
  font-style: italic;
  letter-spacing: 0.03em;
  margin-bottom: 14px;
}
.winner-card__btn {
  padding: 12px 32px;
  font-size: 14px;
  min-width: 160px;
}

/* ── Triples banner ── */
.triples-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin: 0 14px 8px;
  border-radius: var(--r-md);
  background: linear-gradient(180deg, var(--card-alt), var(--card));
  border: 1px solid var(--gold);
  box-shadow:
    0 0 0 1px rgba(184, 137, 46, 0.35),
    0 2px 8px rgba(184, 137, 46, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  animation: triples-pulse 1.4s ease-in-out infinite;
  position: relative;
  z-index: 4;
}
.triples-banner__seal {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold));
  display: flex; align-items: center; justify-content: center;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3), 0 1px 3px rgba(139, 105, 20, 0.4);
  flex-shrink: 0;
  animation: triples-wiggle 0.9s ease-in-out infinite;
}
.triples-banner__body { flex: 1; line-height: 1.2; }
.triples-banner__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 15px;
  letter-spacing: 0.08em;
  color: var(--ink);
  text-transform: uppercase;
}
.triples-banner__val {
  color: var(--gold);
  font-weight: 600;
  margin-left: 4px;
  font-family: var(--font-mono);
  text-transform: none;
  letter-spacing: 0.02em;
}
.triples-banner__sub {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 2px;
  font-family: var(--font-body);
}
@keyframes triples-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(184, 137, 46, 0.35),
      0 2px 8px rgba(184, 137, 46, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(184, 137, 46, 0.6),
      0 2px 18px rgba(184, 137, 46, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
}
@keyframes triples-wiggle {
  0%, 100% { transform: rotate(-5deg) scale(1); }
  50% { transform: rotate(5deg) scale(1.06); }
}

/* ── Transitions ── */
.triples-enter-active, .triples-leave-active { transition: opacity 0.3s, transform 0.3s; }
.triples-enter-from, .triples-leave-to { opacity: 0; transform: translateY(-10px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
