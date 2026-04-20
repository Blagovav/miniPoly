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
import { useShake } from "../composables/useShake";
import { useWs } from "../composables/useWs";
import { useGameStore } from "../stores/game";
import Board from "../components/Board.vue";
import Lobby from "../components/Lobby.vue";
import GameHud from "../components/GameHud.vue";
import Chat from "../components/Chat.vue";
import VoiceButton from "../components/VoiceButton.vue";
import { useVoice } from "../composables/useVoice";
import CardModal from "../components/CardModal.vue";
import CardHistoryModal from "../components/CardHistoryModal.vue";
import AuctionModal from "../components/AuctionModal.vue";
import TileInfoModal from "../components/TileInfoModal.vue";
import OpponentsPanel from "../components/OpponentsPanel.vue";
import PlayerProfileModal from "../components/PlayerProfileModal.vue";
import TradeBanner from "../components/TradeBanner.vue";
import TxnToast from "../components/TxnToast.vue";
import Icon from "../components/Icon.vue";
import LoadingScreen from "../components/LoadingScreen.vue";
import CoronationModal from "../components/CoronationModal.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";
import { humanError } from "../utils/errors";
import type { Player } from "../../../shared/types";

const props = defineProps<{ id: string }>();
const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const { initData, userName, haptic, notify, setClosingConfirmation } = useTelegram();
const game = useGameStore();
const ws = useWs();
const shake = useShake();
// One-shot: first roll tap requests DeviceMotion permission on iOS;
// from then on the attached listener keeps firing every time the phone
// gets a sharp jolt and it's our turn to roll.
let shakeAttempted = false;
// Voice chat (WebRTC mesh over WS signalling). Mic acquired only after first tap.
const voice = useVoice(ws, () => game.myPlayerId);

import { useInventoryStore } from "../stores/inventory";
const inv = useInventoryStore();

// Subscribe to server messages. Applies state, triggers haptics, auto-sends
// the equipped token id the first time we're accepted into the room, and
// refreshes the rejoin TS so the banner only disappears after real inactivity.
let equippedApplied = false;
const off = ws.onMessage((m) => {
  game.applyMessage(m);
  // Dice / move haptics are fired from the game store for my own actions only
  // (dice-land heavy, per-step light, landing medium, pass-GO heavy) — we no
  // longer buzz the phone for every opponent's roll.
  if (m.type === "error") notify("error");
  if (m.type === "joined" && !equippedApplied) {
    equippedApplied = true;
    const tokenId = inv.equippedToken;
    if (tokenId) ws.send({ type: "selectToken", tokenId });
  }
  try { localStorage.setItem("activeRoomTs", String(Date.now())); } catch {}
});
onUnmounted(() => {
  off();
  game.reset();
  // Снимаем подтверждение закрытия на выходе из комнаты — дома оно не нужно.
  setClosingConfirmation(false);
});

// Join on mount AND on every WS reconnect. The server treats our new
// socket as anonymous until it sees a `join` — without re-joining on
// reconnect, messages like `addBot` / `roll` silently drop because
// `conn.playerId` is null on the fresh connection.
function sendJoin() {
  ws.send({
    type: "join",
    roomId: props.id,
    tgInitData: initData.value,
    name: userName.value || "Player",
  });
}
watch(
  () => ws.connected.value,
  (isConnected) => {
    if (isConnected) sendJoin();
  },
  { immediate: true },
);
onMounted(() => {
  try {
    localStorage.setItem("activeRoomId", props.id);
    localStorage.setItem("activeRoomTs", String(Date.now()));
  } catch {}
  const { userId } = useTelegram();
  game.loadFriends(userId.value);
});

// Redirect to home if the server tells us the room is gone — and wipe the
// rejoin hint from localStorage so the "Active game" banner doesn't respawn
// pointing at a dead room.
watch(
  () => game.lastError,
  (err) => {
    if (err && err.includes("not found")) {
      try {
        localStorage.removeItem("activeRoomId");
        localStorage.removeItem("activeRoomTs");
      } catch {}
      setTimeout(() => router.replace({ name: "home" }), 2000);
    }
  },
);

// ── Computed phase flags & friends/winner ───────────────
const phase = computed(() => game.room?.phase);
const isLobby = computed(() => phase.value === "lobby" || !game.room);
const isEnded = computed(() => phase.value === "ended");

// Включаем Telegram-диалог "Точно закрыть?" только пока идёт партия. В лобби и
// после окончания выходить без подтверждения — ничего не теряется.
watch(
  () => phase.value,
  (p) => {
    const inActiveGame = !!p && p !== "lobby" && p !== "ended";
    setClosingConfirmation(inActiveGame);
  },
  { immediate: true },
);

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
function rollIfAllowed() {
  if (!game.isMyTurn || game.rolling) return;
  if (game.room?.phase !== "rolling") return;
  if (game.animatingPlayerId) return;
  haptic("heavy");
  ws.send({ type: "roll" });
}
function roll() {
  rollIfAllowed();
  if (!shakeAttempted) {
    shakeAttempted = true;
    shake.start(() => rollIfAllowed());
  }
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
function payJail() {
  haptic("medium");
  ws.send({ type: "payJail" });
}
function useJailCard() {
  haptic("light");
  ws.send({ type: "useJailCard" });
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
  try {
    localStorage.removeItem("activeRoomId");
    localStorage.removeItem("activeRoomTs");
  } catch {}
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

function addBot() {
  haptic("medium");
  ws.send({ type: "addBot" });
}
function removeBot(playerId: string) {
  haptic("light");
  ws.send({ type: "removeBot", playerId });
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
function placeBid(amount: number) {
  haptic("medium");
  ws.send({ type: "placeBid", amount });
}
function passAuction() {
  haptic("light");
  ws.send({ type: "passAuction" });
}

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
        <span>{{ humanError(game.lastError, locale) }}</span>
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
      :on-add-bot="addBot"
      :on-remove-bot="removeBot"
    />

    <!-- ── In-game / ended phases ── -->
    <template v-else-if="game.room">
      <OpponentsPanel
        :room="game.room"
        :my-player-id="game.myPlayerId"
        :speaking-ids="voice.speakingIds.value"
        @open-profile="openProfile"
      />
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
        :on-pay-jail="payJail"
        :on-use-jail-card="useJailCard"
        :on-open-card-history="openCardHistory"
      />

      <!-- ── Winner overlay (end of game) — Coronation modal ── -->
      <CoronationModal
        :open="isEnded && !!winner"
        :winner-name="winner?.name || ''"
        :winner-color="ORDERED_PLAYER_COLORS[(game.room?.players?.findIndex(p => p.id === winner?.id) ?? 0)]"
        :treasury="winner?.cash"
        :rank-delta="120"
        :on-close="() => router.replace({ name: 'home' })"
      />
    </template>

    <!-- ── Initial load spinner (sigil, matches mockup) ── -->
    <LoadingScreen
      v-else
      variant="sigil"
      :fullscreen="true"
      :message="locale === 'ru' ? 'Загружаем игру…' : 'Loading the game…'"
    />

    <!-- ── Global overlays (chat, card, auction, tile, profile, trade) ── -->
    <Chat v-if="game.room" :on-send="sendChat" />
    <VoiceButton v-if="game.room && !isLobby && !isEnded" :voice="voice" />
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
    />
    <PlayerProfileModal :player="profilePlayer" :on-close="closeProfile" />
    <TradeBanner v-if="game.room" :on-respond="respondTrade" />
    <TxnToast v-if="game.room" />
  </div>
</template>

<style scoped>
.room {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  padding: 0 0 calc(8px + var(--tg-safe-area-inset-bottom, 0px));
  position: relative;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  overflow-x: clip;
  /* Let the column scroll when board + HUD exceed viewport height.
     Telegram disables native vertical swipes in fullscreen so inner scroll
     works without fighting the app dismiss gesture. */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
