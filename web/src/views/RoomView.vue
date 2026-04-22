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
import Dice from "../components/Dice.vue";
import Chat from "../components/Chat.vue";
import VoiceButton from "../components/VoiceButton.vue";
import { useVoice } from "../composables/useVoice";
import CardModal from "../components/CardModal.vue";
import CardHistoryModal from "../components/CardHistoryModal.vue";
import AuctionModal from "../components/AuctionModal.vue";
import PreRollPanel from "../components/PreRollPanel.vue";
import TileInfoModal from "../components/TileInfoModal.vue";
import PlayerProfileModal from "../components/PlayerProfileModal.vue";
import TradeBanner from "../components/TradeBanner.vue";
import TradeModal, { type TradePayload } from "../components/TradeModal.vue";
import TxnToast from "../components/TxnToast.vue";
import Icon from "../components/Icon.vue";
import LoadingScreen from "../components/LoadingScreen.vue";
import CoronationModal from "../components/CoronationModal.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";
import { humanError } from "../utils/errors";
import type { Player } from "../../../shared/types";
import { BOARD } from "../../../shared/board";

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
const isPreRoll = computed(() => phase.value === "preRoll");

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
// Debug-lite: log every click so a stuck game is diagnosable from the
// browser console without re-wiring devtools. Guards removed — the
// server validates; the client's job is to deliver the click, not
// second-guess phase.
function rollIfAllowed() {
  console.log("[roll] click → sending ws roll", {
    phase: game.room?.phase,
    isMyTurn: game.isMyTurn,
    rolling: game.rolling,
    animating: game.animatingPlayerId,
  });
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

const tradeModalOpen = ref(false);
const tradeInitialTargetId = ref<string | null>(null);
const tradeInitialTakeTile = ref<number | null>(null);

function openTradeModal(opts?: { targetId?: string | null; takeTile?: number | null }) {
  tradeInitialTargetId.value = opts?.targetId ?? null;
  tradeInitialTakeTile.value = opts?.takeTile ?? null;
  tradeModalOpen.value = true;
  haptic("light");
}
function closeTradeModal() {
  tradeModalOpen.value = false;
}
function submitTrade(payload: TradePayload) {
  haptic("medium");
  ws.send({ type: "proposeTrade", ...payload });
  tradeModalOpen.value = false;
}
function openTradeFromTile(tileIndex: number) {
  openTradeModal({ takeTile: tileIndex });
  game.selectTile(null);
}
function openTradeFromProfile(playerId: string) {
  openTradeModal({ targetId: playerId });
  profilePlayer.value = null;
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

// ── Header-icon actions (new Figma design) ──
// Chat is driven by a window event so the Chat component stays
// self-contained (matches App.vue's open-tour pattern).
function toggleChat() {
  haptic("light");
  window.dispatchEvent(new CustomEvent("toggle-chat"));
}
// Voice is simpler — we share the same client with VoiceButton, so we
// just flip it on/off. Leaves PTT tap-and-hold to the floating button
// (which we keep mounted but hidden in-room for legacy hold behaviour).
async function toggleVoice() {
  haptic("medium");
  await voice.toggle();
}

// Player-count subtitle (russian-aware pluralisation).
const subtitle = computed(() => {
  if (!game.room) return locale.value === "ru" ? "Подключение…" : "Connecting…";
  const n = playerCount.value;
  if (locale.value === "ru") return `${n} ${n === 1 ? "игрок" : n < 5 ? "игрока" : "игроков"}`;
  return `${n} ${n === 1 ? "player" : "players"}`;
});

// ── Redesign derived state ─────────────────────────────
// Player colour lookup by stable index into room.players.
function colorFor(p: Player): string {
  if (!game.room) return ORDERED_PLAYER_COLORS[0];
  const i = game.room.players.findIndex((pp) => pp.id === p.id);
  return ORDERED_PLAYER_COLORS[i < 0 ? 0 : i % ORDERED_PLAYER_COLORS.length];
}

// Current-turn display: static 3-slot banner (prev / current / next).
// Not a slider — per designer, it's a status indicator, not a menu,
// so there's no scroll, no swipe, no tap. The centre slot shows who's
// up; side slots peek at neighbours for context.
const currentPlayerId = computed(() => {
  if (!game.room) return null;
  return game.room.players[game.room.currentTurn]?.id ?? null;
});
const turnSlots = computed<{ key: string; player: Player; role: "prev" | "current" | "next" }[]>(() => {
  const r = game.room;
  if (!r || r.players.length === 0) return [];
  const n = r.players.length;
  const i = r.currentTurn;
  const prev = r.players[(i - 1 + n) % n];
  const cur  = r.players[i];
  const next = r.players[(i + 1) % n];
  // Key by player.id so Vue's TransitionGroup FLIP can slide persistent cards
  // (B stays in DOM, moves from current→prev slot; old prev fades out, new next
  // fades in). In a 2-player room prev === next, so drop the duplicate next
  // slot — otherwise Vue errors on dup keys and FLIP breaks.
  const slots = [
    { key: prev.id, player: prev, role: "prev" as const },
    { key: cur.id,  player: cur,  role: "current" as const },
    { key: next.id, player: next, role: "next" as const },
  ];
  if (n === 2) slots.pop();
  return slots;
});

// Rank-coloured pills per Figma node 16:2591. Not tied to the player's
// assigned token colour — the leaderboard uses its own palette keyed by
// standing (gold-ish blue for #1, coral for #2, purple for #3, etc.).
const RANK_COLORS = ["#688ee2", "#e2776e", "#9754dc", "#8b5a2b"];

// Current-tile plate under the turn slider. Shows name of whatever tile
// the active player stands on; value depends on the tile kind:
//   street / railroad / utility → price (unowned) or rent (owned)
//   tax                         → tax amount
//   go / chest / chance / jail / parking / goToJail → no value
const currentTileInfo = computed<{ name: string; value: number | null } | null>(() => {
  const r = game.room;
  const cp = game.currentPlayer;
  if (!r || !cp) return null;
  const tile = BOARD[cp.position];
  if (!tile) return null;
  const name = locale.value === "ru" ? tile.name.ru : tile.name.en;

  if (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility") {
    const owned = r.properties[tile.index];
    let value: number = tile.price;
    if (owned && !owned.mortgaged && tile.kind === "street") {
      const idx = Math.min(owned.houses + (owned.hotel ? 5 : 0), tile.rent.length - 1);
      value = tile.rent[idx];
    }
    return { name, value };
  }
  if (tile.kind === "tax") {
    return { name, value: tile.amount };
  }
  return { name, value: null };
});

// Leaderboard: sort by total worth (cash + property face value) so rich-
// in-assets players still rank high, but DISPLAY pure cash next to the
// money icon — same metric as the budget pill and the current-turn card,
// so the numbers match across the screen.
const leaderboard = computed(() => {
  const r = game.room;
  if (!r) return [] as { id: string; name: string; cash: number; color: string }[];
  const propValue = (pid: string): number => {
    let sum = 0;
    for (const op of Object.values(r.properties)) {
      if (op.ownerId !== pid) continue;
      const tile = BOARD[op.tileIndex];
      if (tile && (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility")) {
        sum += tile.price;
      }
    }
    return sum;
  };
  return r.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      worth: p.cash + propValue(p.id),
    }))
    .sort((a, b) => b.worth - a.worth)
    .map((row, idx) => ({
      id: row.id,
      name: row.name,
      cash: row.cash,
      color: RANK_COLORS[idx % RANK_COLORS.length],
    }));
});

// Leaderboard row → player profile modal. Carousel cards are purely
// presentational per the redesign; tapping a leaderboard pill is the
// canonical way to inspect another player's holdings.
function openLeaderboardRow(playerId: string) {
  const r = game.room;
  if (!r) return;
  const p = r.players.find((pl) => pl.id === playerId);
  if (p) openProfile(p);
}

// Rank → medal PNG. Gold/silver/bronze for top-3; 4th reuses bronze
// until a designated 4th asset exists.
function medalSrc(rank: number): string {
  if (rank === 0) return "/figma/room/medal-gold.png";
  if (rank === 1) return "/figma/room/medal-silver.png";
  return "/figma/room/medal-bronze.png";
}

// Player property count — used in the current-turn chip.
function propCountFor(playerId: string): number {
  if (!game.room) return 0;
  return Object.values(game.room.properties).filter((p) => p.ownerId === playerId).length;
}

// Turn timer — mirrors the server's 180s AFK countdown so the "234s"
// badge in the Figma has live data.
const TURN_TIMEOUT_SEC = 180;
const now = ref(Date.now());
const turnStartedAt = ref(Date.now());
watch(
  () => game.room?.currentTurn,
  () => { turnStartedAt.value = Date.now(); },
);
const tickHandle = setInterval(() => { now.value = Date.now(); }, 1000);
onUnmounted(() => clearInterval(tickHandle));
const turnRemainingSec = computed(() => {
  const elapsed = (now.value - turnStartedAt.value) / 1000;
  return Math.max(0, Math.ceil(TURN_TIMEOUT_SEC - elapsed));
});

type ActionVariant = "roll" | "buy" | "auction" | "endturn";
interface ActionButton {
  variant: ActionVariant;
  label: string;
  price?: number;        // shown inline on the BUY variant
  handler: () => void;
}

// Phase-driven action buttons that match the Figma flow:
//   rolling   (my turn) → blue БРОСИТЬ КУБИКИ (roll)
//   buyPrompt (my turn) → orange НА АУКЦИОН + green КУПИТЬ <price> (stacked)
//   action    (my turn) → purple ЗАВЕРШИТЬ ХОД (endTurn)
//   ended                 → purple ЗАКРЫТЬ (leave room)
// Everything else (moving, auction modal, not-my-turn) hides the bar entirely,
// per the designer: when it is not your turn, you should not see any button.
// While a token is still stepping across the board, the banner must
// reflect who's actually moving — not who's up next. The server rotates
// `currentTurn` the moment a bot's server-side turn completes, so without
// this guard the "ВАШ ХОД!" text can flash before the bot's pawn has
// even stopped.
const activeBannerPlayer = computed(() => {
  const animId = game.animatingPlayerId;
  if (!animId) return null;
  return game.room?.players.find((p) => p.id === animId) ?? null;
});

const primaryButtons = computed<ActionButton[] | null>(() => {
  const r = game.room;
  if (!r) return null;
  const isRu = locale.value === "ru";

  if (r.phase === "ended") {
    return [{
      variant: "endturn",
      label: isRu ? "ЗАКРЫТЬ" : "CLOSE",
      handler: () => router.replace({ name: "home" }),
    }];
  }

  // Pre-roll: the roll-for-order button is driven by `isMyPreRoll`, not the
  // regular `isMyTurn` (which points at room.currentTurn — meaningless here).
  // Suppress while dice are still tumbling so a double-tap can't double-send.
  if (r.phase === "preRoll") {
    if (!game.isMyPreRoll || game.rolling) return null;
    return [{
      variant: "roll",
      label: isRu ? "БРОСИТЬ КУБИКИ" : "ROLL DICE",
      handler: roll,
    }];
  }

  if (!game.isMyTurn) return null;

  // Suppress the bar while the dice are tumbling or the pawn is still
  // stepping across the board — the server advances to buyPrompt/action
  // the instant the roll is resolved, but the player shouldn't see
  // post-landing actions until they actually SEE the landing.
  if (game.rolling || game.animatingPlayerId !== null) return null;

  if (r.phase === "rolling") {
    return [{
      variant: "roll",
      label: isRu ? "БРОСИТЬ КУБИКИ" : "ROLL DICE",
      handler: roll,
    }];
  }

  if (r.phase === "buyPrompt") {
    const me = game.me;
    const tile = me ? BOARD[me.position] : null;
    const price = tile && "price" in tile ? (tile as { price: number }).price : 0;
    return [
      { variant: "auction", label: isRu ? "НА АУКЦИОН" : "AUCTION", handler: skipBuy },
      { variant: "buy",     label: isRu ? "КУПИТЬ" : "BUY", price, handler: buy },
    ];
  }

  if (r.phase === "action") {
    return [{
      variant: "endturn",
      label: isRu ? "ЗАВЕРШИТЬ ХОД" : "END TURN",
      handler: endTurn,
    }];
  }

  // moving / auction / lobby — no bar; the board animation or a modal takes over.
  return null;
});

void route;
void t;
</script>

<template>
  <div class="room" :class="{ 'room--figma': game.room && !isLobby }">
    <!-- ── Decorative background pattern (only in-game; lobby keeps its
         original parchment look until designer delivers that screen) ── -->
    <img
      v-if="game.room && !isLobby"
      class="room-bg"
      src="/figma/room/bg-pattern.png"
      alt=""
      aria-hidden="true"
    />

    <!-- ── Topbar ── -->
    <div v-if="isLobby" class="topbar">
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

    <!-- ── In-game topbar (Figma) ── -->
    <div v-else class="room-topbar">
      <div class="room-topbar__title-block">
        <h1 class="room-topbar__title">
          {{ locale === 'ru' ? 'Комната' : 'Room' }} {{ id }}
        </h1>
        <div class="room-topbar__pill">{{ subtitle }}</div>
      </div>
      <div class="room-topbar__actions">
        <!-- Speech-bubble PNG (from Figma imgImage28) → text chat toggle.
             nav-home.png/nav-chat.png were mis-named on download; the
             bubble file is on disk under nav-home.png. -->
        <button
          class="room-topbar__nav-btn"
          :aria-label="locale === 'ru' ? 'Чат' : 'Chat'"
          @click="toggleChat"
        >
          <img src="/figma/room/nav-home.png" alt="" />
        </button>
        <!-- House PNG (from Figma imgImage29) → voice-chat toggle per
             designer. -->
        <button
          class="room-topbar__nav-btn"
          :aria-label="locale === 'ru' ? 'Голос' : 'Voice'"
          @click="toggleVoice"
        >
          <img src="/figma/room/nav-chat.png" alt="" />
        </button>
        <button class="room-topbar__menu-btn" aria-label="menu" @click="handleMenu">
          <span class="room-topbar__menu-bar" />
          <span class="room-topbar__menu-bar" />
          <span class="room-topbar__menu-bar" />
        </button>
      </div>
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
      <!-- Pre-roll overlay: shown above the board while players roll for
           turn order. The board itself is already rendered below (all tokens
           sit at GO), so the overlay sits on top without replacing it. -->
      <PreRollPanel
        v-if="isPreRoll"
        :room="game.room"
        :my-player-id="game.myPlayerId"
        :dice="game.room.dice ?? game.lastDice"
        :rolling="game.rolling"
      />

      <!-- Scrollable body (board + HUD overlays + carousel + leaderboard). -->
      <div class="room-body">
        <!-- Board + center HUD overlay (dice + ВАШ ХОД! + timer + budget) -->
        <div class="board-stage">
          <Board :room="game.room" />

          <div class="board-hud" :class="{ 'board-hud--mine': game.isMyTurn }">
            <!-- Dice — reuse existing Dice component, synced to store -->
            <div class="board-hud__dice">
              <Dice :dice="game.room?.dice ?? null" :rolling="game.rolling" />
            </div>
            <!-- Pre-roll has its own overlay panel; don't echo turn/timer here. -->
            <template v-if="!isPreRoll">
            <div v-if="activeBannerPlayer" class="board-hud__turn board-hud__turn--other">
              {{ activeBannerPlayer.name?.toUpperCase() || '…' }}
            </div>
            <div v-else-if="game.isMyTurn" class="board-hud__turn">
              {{ locale === 'ru' ? 'ВАШ ХОД!' : 'YOUR TURN!' }}
            </div>
            <div v-else-if="game.currentPlayer" class="board-hud__turn board-hud__turn--other">
              {{ game.currentPlayer.name?.toUpperCase() || '…' }}
            </div>
            <div class="board-hud__timer">
              <img src="/figma/room/icon-stopwatch.png" alt="" />
              <span>{{ turnRemainingSec }}</span>
            </div>
            </template>
            <div v-if="game.me && !isPreRoll" class="board-hud__budget">
              <div class="board-hud__budget-row">
                <span>{{ locale === 'ru' ? 'Ваш бюджет' : 'Your budget' }}</span>
                <span class="board-hud__budget-val">
                  <img src="/figma/room/icon-money.png" alt="" />
                  {{ game.me.cash }}
                </span>
              </div>
              <div class="board-hud__budget-row">
                <span>{{ locale === 'ru' ? 'Собственностей' : 'Properties' }}</span>
                <span class="board-hud__budget-val">
                  <img src="/figma/room/icon-chair.png" alt="" />
                  {{ propCountFor(game.me.id) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Текущий ход — static prev/current/next banner. Not a slider:
             no scroll, no swipe, no tap. Arrow above the centre card.
             Hidden during pre-roll (player order isn't final yet). -->
        <div v-if="!isPreRoll" class="turn-label">{{ locale === 'ru' ? 'Текущий ход' : 'Current turn' }}</div>
        <div v-if="!isPreRoll" class="turn-slider">
          <svg class="turn-slider__arrow" viewBox="0 0 14 11" aria-hidden="true">
            <path
              d="M2 0.7h10.4c1.05 0 1.67 1.18 1.07 2.04L8.26 10.23c-0.52 0.74-1.62 0.74-2.14 0L0.93 2.74C0.34 1.88 0.96 0.7 2 0.7Z"
              fill="#e84b3e"
              stroke="#000"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
          </svg>
          <TransitionGroup tag="div" name="turn" class="turn-rail">
            <div
              v-for="slot in turnSlots"
              :key="slot.key"
              :class="['turn-card', `turn-card--${slot.role}`]"
            >
              <div class="turn-card__avatar" />
              <div class="turn-card__body">
                <div class="turn-card__name">{{ slot.player.name }}</div>
                <div class="turn-card__stats">
                  <span><img src="/figma/room/icon-money.png" alt=""/>{{ slot.player.cash }}</span>
                  <span><img src="/figma/room/icon-chair.png" alt=""/>{{ propCountFor(slot.player.id) }}</span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- Current-tile plate — name + price/rent of the tile the active
             player stands on. Figma node 32:1065. Only shown on property
             tiles; chest/chance/tax/etc have no number to display.
             Hidden during pre-roll (tile/position is meaningless yet). -->
        <div v-if="currentTileInfo && !isPreRoll" class="tile-info">
          <span class="tile-info__name">{{ currentTileInfo.name }}</span>
          <span v-if="currentTileInfo.value !== null" class="tile-info__value">
            <img src="/figma/room/icon-money.png" alt="" />
            {{ currentTileInfo.value }}
          </span>
        </div>

        <!-- Leaderboard — tap a row to open that player's profile/assets.
             Per Figma 32:2037: 24px medal on the left, coloured pill with
             avatar + name + cash on the right. Skipped during pre-roll —
             the standings aren't meaningful until seats are set. -->
        <div v-if="leaderboard.length > 0 && !isPreRoll" class="leaderboard">
          <button
            v-for="(p, i) in leaderboard.slice(0, 4)"
            :key="p.id"
            type="button"
            class="leaderboard__row"
            @click="openLeaderboardRow(p.id)"
          >
            <img
              class="leaderboard__medal"
              :src="medalSrc(i)"
              alt=""
            />
            <div
              class="leaderboard__pill"
              :style="{ background: p.color }"
            >
              <div class="leaderboard__pill-left">
                <img class="leaderboard__avatar" src="/figma/room/avatar-placeholder.png" alt="" />
                <span class="leaderboard__name">{{ p.name }}</span>
              </div>
              <span class="leaderboard__cash">
                <img src="/figma/room/icon-money.png" alt="" />
                {{ p.cash }}
              </span>
            </div>
          </button>
        </div>

        <!-- Extra phase actions that don't fit on the primary button
             (jail payment, skip-buy, etc). GameHud renders its own UI
             for these, so we keep it mounted but hide its duplicate
             dice+turn banner via scoped CSS. -->
        <div class="hud-overflow">
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
        </div>
      </div>

      <!-- Fixed bottom primary action bar. One button for roll / end-turn,
           two stacked buttons for buy / auction. Hidden entirely when it's
           not my turn — the designer's flow is "no button, no confusion". -->
      <div
        v-if="primaryButtons"
        class="primary-bar"
        :class="{ 'primary-bar--double': primaryButtons.length === 2 }"
      >
        <button
          v-for="btn in primaryButtons"
          :key="btn.variant"
          class="primary-btn"
          :class="`primary-btn--${btn.variant}`"
          @click="btn.handler()"
        >
          <span class="primary-btn__label">{{ btn.label }}</span>
          <span v-if="btn.variant === 'buy' && btn.price" class="primary-btn__price">
            <img src="/figma/room/icon-money.png" alt="" />
            {{ btn.price }}
          </span>
        </button>
      </div>

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
      :on-propose-trade="openTradeFromTile"
      :on-mortgage="mortgage"
      :on-unmortgage="unmortgage"
    />
    <PlayerProfileModal
      :player="profilePlayer"
      :on-close="closeProfile"
      :on-offer-trade="openTradeFromProfile"
    />
    <TradeBanner v-if="game.room" :on-respond="respondTrade" />
    <TradeModal
      v-if="game.room"
      :open="tradeModalOpen"
      :initial-target-id="tradeInitialTargetId"
      :initial-take-tile="tradeInitialTakeTile"
      :on-close="closeTradeModal"
      :on-submit="submitTrade"
    />
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

/* ═══════════════════════════════════════════════════════════════
   Figma redesign — applied only when .room--figma is active
   (in-game phases). Lobby keeps the legacy parchment look.
   ═══════════════════════════════════════════════════════════════ */
.room--figma {
  background: #9fe101;
  color: #fff;
  padding: 0;
  overflow-y: hidden;
  font-family: 'Unbounded', 'Golos Text', sans-serif;
}
.room-bg {
  position: absolute;
  left: -42px;
  bottom: 0;
  width: 476px;
  max-width: none;
  height: auto;
  /* The Figma "image 6" asset is exported as blue icons on a blue
     background (it's the same pattern used by the home screen). To
     reach the designer's green-on-green look we multiply it with the
     #9fe101 bg so blue lifts into matching green tones rather than
     leaving muddy teal blotches. */
  mix-blend-mode: multiply;
  opacity: 0.55;
  pointer-events: none;
  z-index: 0;
}

/* ── In-game topbar ── */
.room-topbar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  gap: 12px;
  flex-shrink: 0;
}
.room-topbar__title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.room-topbar__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.room-topbar__pill {
  align-self: flex-start;
  background: #fff;
  color: #000;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  padding: 3px 10px;
  border-radius: 999px;
}
.room-topbar__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.room-topbar__nav-btn {
  width: 44px;
  height: 44px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.room-topbar__nav-btn img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  pointer-events: none;
}
.room-topbar__nav-btn:active { transform: scale(0.92); }
.room-topbar__menu-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}
.room-topbar__menu-bar {
  width: 16px;
  height: 2px;
  background: #000;
  border-radius: 2px;
}
.room-topbar__menu-btn:active { transform: scale(0.92); }

/* ── Scrollable body (under topbar, above primary action bar) ── */
.room--figma .room-body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Reserve space for the fixed primary-bar at the bottom so the
     leaderboard isn't covered. 148px ≈ 2×56 btn + gaps + padding +
     safe-area — enough for the tallest (buyPrompt) state. */
  padding: 0 16px calc(160px + var(--tg-safe-area-inset-bottom, 0px));
  -webkit-overflow-scrolling: touch;
}

/* ── Board stage: board + centre HUD overlay ── */
.board-stage {
  position: relative;
  margin: 0 auto;
  max-width: 420px;
  width: 100%;
}
/* Override Board's own vw-based width; inside the new layout the
   stage already sets the cap, so we just want the board to fill it. */
.board-stage :deep(.board-wrap) {
  padding: 0;
}
.board-stage :deep(.board) {
  width: 100%;
  max-width: 100%;
}
.board-hud {
  position: absolute;
  inset: 15% 12% 12% 12%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  pointer-events: none;
  z-index: 3;
}
.board-hud > * { pointer-events: auto; }
.board-hud__dice {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.board-hud__turn {
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: clamp(16px, 4.4vmin, 24px);
  line-height: 1;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
  text-align: center;
  letter-spacing: 0.02em;
}
.board-hud__turn--other { opacity: 0.9; }
.board-hud__timer {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: clamp(14px, 3.4vmin, 20px);
  text-shadow: 1px 1px 0 #000;
}
.board-hud__timer img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.board-hud__budget {
  background: #fff;
  border-radius: 18px;
  padding: 4px 12px;
  width: min(245px, 90%);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.18);
}
.board-hud__budget-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  color: #000;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
}
.board-hud__budget-row + .board-hud__budget-row {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
.board-hud__budget-val {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.board-hud__budget-val img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

/* ── Current-turn carousel ── */
.turn-label {
  margin: 14px 0 10px;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}
.turn-slider {
  position: relative;
  padding-top: 14px;
  /* Bleed past .room-body horizontal padding so side cards clip at the
     screen edges — the red centre card gets a full-width stage. */
  margin-left: -16px;
  margin-right: -16px;
  /* Status indicator, not an input surface. */
  pointer-events: none;
  overflow: hidden;
}
.turn-slider__arrow {
  position: absolute;
  top: 0;
  left: 50%;
  width: 18px;
  height: 14px;
  transform: translateX(-50%);
  z-index: 2;
  pointer-events: none;
  overflow: visible;
}
.turn-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 4px 16px 8px;
  min-width: 0;
  position: relative;
}
.turn-card {
  flex: 0 0 160px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #fff;
  border-radius: 14px;
  min-width: 0;
  cursor: default;
  /* Role swap (prev → current → next) animates background + padding so the
     card shape morphs instead of snapping when the slider shifts. */
  transition:
    background-color 320ms ease,
    color 320ms ease,
    border-color 320ms ease,
    padding 320ms ease;
}
.turn-card--current {
  background: #e84b3e;
  border: 2px solid #000;
  padding: 6px;
}

/* FLIP slide: the current card shifts left into "prev", the next card
   shifts left into "current", a fresh card fades in from the right, and
   the old "prev" fades out to the left. `position: absolute` on leaving
   cards lets the remaining ones collapse the gap smoothly. */
.turn-move,
.turn-enter-active,
.turn-leave-active {
  transition:
    opacity 350ms ease,
    transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
.turn-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.turn-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
.turn-leave-active {
  position: absolute;
}
.turn-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d1d5db, #9ca3af);
  flex-shrink: 0;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.1);
}
.turn-card--current .turn-card__avatar {
  background: #fff;
}
.turn-card__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.turn-card__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.turn-card--current .turn-card__name {
  color: #fff;
  text-shadow: 0.4px 0.4px 0 #000;
}
.turn-card__stats {
  display: flex;
  gap: 8px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  color: #333;
}
.turn-card--current .turn-card__stats {
  color: #fff;
  text-shadow: 0.2px 0.2px 0 #000;
}
.turn-card__stats span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.turn-card__stats img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

/* ── Current-tile plate — Figma 32:1065 ── */
.tile-info {
  margin-top: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tile-info__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tile-info__value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  flex-shrink: 0;
}
.tile-info__value img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* ── Leaderboard — Figma 32:2037 ── */
.leaderboard {
  margin-top: 16px;
  background: #feffff;
  border-radius: 18px;
  padding: 12px;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.16),
    inset 0 0 8px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.leaderboard__row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  width: 100%;
  transition: transform 120ms ease;
}
.leaderboard__row:active { transform: scale(0.98); }
.leaderboard__medal {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}
.leaderboard__pill {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-radius: 12px;
  gap: 8px;
}
.leaderboard__pill-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.leaderboard__avatar {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 50%;
}
.leaderboard__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.leaderboard__cash {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  text-shadow: 0.2px 0.2px 0 #000;
  flex-shrink: 0;
}
.leaderboard__cash img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* ── GameHud slot: mounted but visually hidden. Primary action bar
      below already covers roll/buy/endTurn. Edge-case phases (payJail,
      useJailCard, openCardHistory) will need their own redesigned entry
      points — tracked for a follow-up. ── */
.room--figma .hud-overflow { display: none; }

/* ── Floating voice + chat toggles are replaced by the header icons
      in the Figma redesign. Hide them so nothing overlaps the primary
      bar; the Chat PANEL (.chat__panel) still opens via window event,
      and the voice client stays mounted for audio I/O. ── */
.room--figma :deep(.vb-wrap),
.room--figma :deep(.chat__toggle) {
  display: none !important;
}

/* ── Primary action bar (pinned bottom). Figma specs per state:
      roll     blue   #2283f3  БРОСИТЬ КУБИКИ
      auction  orange #d69e36  НА АУКЦИОН   (top slot when stacked)
      buy      green  #4ed636  КУПИТЬ <price> (bottom slot when stacked)
      endturn  purple #a322f3  ЗАВЕРШИТЬ ХОД / ЗАКРЫТЬ
      Dark bottom gradient behind the bar: 84px tall single / 148px double. ── */
/* Pin to the viewport so growing from 1 → 2 buttons doesn't shove
   the board/leaderboard up. The room column reserves space below via
   padding-bottom on .room--figma so the carousel never hides behind. */
.primary-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  padding: 10px 16px calc(10px + var(--tg-safe-area-inset-bottom, 0px));
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.4));
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none; /* only the buttons themselves catch taps */
}
.primary-bar .primary-btn { pointer-events: auto; }
.primary-btn {
  position: relative;
  width: 100%;
  height: 56px;
  border: 2px solid #000;
  border-radius: 18px;
  color: #fff;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  letter-spacing: 0.02em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  cursor: pointer;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.2);
  transition: transform 120ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.primary-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.2);
}
.primary-btn--roll    { background: #2283f3; }
.primary-btn--auction { background: #d69e36; }
.primary-btn--buy     { background: #4ed636; }
.primary-btn--endturn { background: #a322f3; }
.primary-btn__label {
  position: relative;
  z-index: 1;
}
.primary-btn__price {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}
.primary-btn__price img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
</style>
