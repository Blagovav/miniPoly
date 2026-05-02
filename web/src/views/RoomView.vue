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
import { SHOP_ITEMS } from "../shop/items";

// Map shop token id → its emoji icon. Leaderboard + avatar fallbacks
// render the actual token the player picked ("за какую фишку играет"),
// not a generic silhouette. Default to a knight piece if the player
// hasn't chosen anything yet.
const TOKEN_ICON_BY_ID: Record<string, string> = Object.fromEntries(
  SHOP_ITEMS.filter((it) => it.kind === "token").map((it) => [it.id, it.icon ?? "♟️"]),
);
function shopTokenIcon(tokenId: string | undefined): string {
  if (tokenId && TOKEN_ICON_BY_ID[tokenId]) return TOKEN_ICON_BY_ID[tokenId];
  return "♟️";
}
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

// Sticky-header scroll state: toggles .room-topbar--scrolled once the
// player has scrolled past the top so the header gets a shadow +
// rounded bottom corners and visually detaches from the content.
const isScrolled = ref(false);
function handleBodyScroll(e: Event) {
  const el = e.currentTarget as HTMLElement;
  isScrolled.value = el.scrollTop > 4;
}

// ── Connection-issue popup (Figma 133:14137). Surfaces only mid-match —
// disconnects in lobby/ended don't really matter and the boot screen
// already covers cold-start failures. We wait 700ms before showing so a
// brief reconnect cycle (server restart, mobile handoff) doesn't flash
// the modal at the user. The popup auto-dismisses the moment the WS
// reconnects; useWs already retries on a 1.5s loop in the background.
const connectionLost = ref(false);
let connectionLostTimer: number | null = null;
watch(
  () => ws.connected.value,
  (isConnected) => {
    if (isConnected) {
      if (connectionLostTimer !== null) {
        clearTimeout(connectionLostTimer);
        connectionLostTimer = null;
      }
      connectionLost.value = false;
      return;
    }
    const phaseNow = game.room?.phase;
    const inActiveMatch = !!phaseNow && phaseNow !== "lobby" && phaseNow !== "ended";
    if (!inActiveMatch) return;
    if (connectionLostTimer !== null) clearTimeout(connectionLostTimer);
    connectionLostTimer = window.setTimeout(() => {
      connectionLost.value = true;
    }, 700);
  },
);
onUnmounted(() => {
  if (connectionLostTimer !== null) clearTimeout(connectionLostTimer);
  connectionLost.value = false;
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

// Room doesn't exist / already closed — bounce the user back to home with
// a query flag so HomeView can surface the new "Приглашение больше
// неактуально" auto-close popup (Figma 133:15574). The popup is rendered
// over the welcome screen, not over a dead lobby, so the redirect happens
// immediately. Also wipes the rejoin hint so the home banner doesn't
// keep pointing at the dead room.
watch(
  () => game.lastError,
  (err) => {
    if (err && err.includes("not found")) {
      try {
        localStorage.removeItem("activeRoomId");
        localStorage.removeItem("activeRoomTs");
      } catch {}
      router.replace({ name: "home", query: { invitedError: "1" } });
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
    const inLobby = !p || p === "lobby";
    const inActiveGame = !!p && p !== "lobby" && p !== "ended";
    setClosingConfirmation(inActiveGame);
    // Toggle the figma-green body class so Telegram's safe-area strips
    // above/below the board don't leak the parchment var(--bg). Same trick
    // HomeView uses with home-figma-root. The lobby variant paints the
    // page cream (#faf3e2) so safe-areas match the Figma 73:3483 lobby.
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("room-figma-root", inActiveGame);
    body.classList.toggle("room-figma-root", inActiveGame);
    root.classList.toggle("lobby-figma-root", inLobby);
    body.classList.toggle("lobby-figma-root", inLobby);
  },
  { immediate: true },
);
onUnmounted(() => {
  document.documentElement.classList.remove("room-figma-root");
  document.body.classList.remove("room-figma-root");
  document.documentElement.classList.remove("lobby-figma-root");
  document.body.classList.remove("lobby-figma-root");
});

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
    // Shake fires any time the phone moves enough — guard the
    // shake-driven roll so a buzz on the metro during an opponent's
    // turn doesn't trigger haptics + a doomed WS send. Server would
    // reject the message anyway; this just kills the noise.
    shake.start(() => {
      const phase = game.room?.phase;
      const canRoll =
        (phase === "rolling" && game.isMyTurn && !game.rolling) ||
        (phase === "preRoll" && game.isMyPreRoll && !game.rolling);
      if (!canRoll) return;
      rollIfAllowed();
    });
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

// ── Confirm-modal state (Figma 133:15211 host destroy / 133:15948 player
// leave / 133:13821 + 133:14512 mid-match leave). The native browser
// confirm() bounced users out of the lobby/game look — the redesign
// replaces it with a parchment popup that matches the rest of the chrome.
const leaveConfirmOpen = ref(false);
const destroyConfirmOpen = ref(false);

// Subtitle copy diverges between lobby (no subtitle), in-game non-host
// ("you'll forfeit"), and in-game host ("you'll forfeit AND host transfers").
// Cancel button also flips: lobby keeps a quiet blue "ОТМЕНА"; mid-match
// surfaces a green "ВЕРНУТЬСЯ К ИГРЕ" because the player is being asked to
// throw away progress, so the safe-default action wants to read positive.
const leaveCancelInGame = computed(
  () => !!game.room && game.room.phase !== "lobby" && game.room.phase !== "ended",
);
const leaveCancelLabel = computed(() => {
  if (leaveCancelInGame.value) {
    return locale.value === "ru" ? "ВЕРНУТЬСЯ К ИГРЕ" : "BACK TO GAME";
  }
  return locale.value === "ru" ? "ОТМЕНА" : "CANCEL";
});
const leaveSubtitle = computed(() => {
  if (!leaveCancelInGame.value) return "";
  if (isHostMe.value) {
    // Host's mid-match exit dissolves the room for everyone (Figma 133:12388)
    // — there's no host-handoff anymore, the design decided the leader's
    // departure ends the session for all players. Server-side this maps to
    // destroyRoom rather than leave.
    return locale.value === "ru"
      ? "Будучи лидером лобби, ваш выход распустит игру и отправит игроков в меню"
      : "As host, leaving will dissolve the game and send everyone to the menu";
  }
  return locale.value === "ru"
    ? "Вам будет засчитано поражение"
    : "You'll forfeit the match";
});

function leaveRoom() {
  // Direct leave (back arrow, in-game forfeit) — modal-gated paths use
  // openLeaveConfirm() instead.
  haptic("medium");
  ws.send({ type: "leave" });
  try {
    localStorage.removeItem("activeRoomId");
    localStorage.removeItem("activeRoomTs");
  } catch {}
  setTimeout(() => router.replace({ name: "home" }), 100);
}

function openLeaveConfirm() {
  haptic("light");
  leaveConfirmOpen.value = true;
}
function confirmLeave() {
  leaveConfirmOpen.value = false;
  // Host mid-match (Figma 133:12388) destroys the whole room rather than
  // performing a graceful host-handoff — the new design treats the leader's
  // exit as the end of the session. Lobby host doesn't reach here (they go
  // through the destroyConfirm modal instead); guests always do plain leave.
  if (isHostMe.value && leaveCancelInGame.value) {
    destroyRoom();
  } else {
    leaveRoom();
  }
}

function destroyRoom() {
  haptic("heavy");
  ws.send({ type: "destroyRoom" });
  setTimeout(() => router.replace({ name: "home" }), 100);
}
function openDestroyConfirm() {
  haptic("light");
  destroyConfirmOpen.value = true;
}
function confirmDestroy() {
  destroyConfirmOpen.value = false;
  destroyRoom();
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

// Right-side topbar button action — opens the matching confirm modal:
//   host in lobby   → "Распутить партию?" (Figma 133:15211)
//   guest in lobby  → "Выйти из партии?"  (Figma 133:15948)
//   in-game         → leave-game forfeit modal
function handleMenu() {
  if (isHostMe.value && game.room?.phase === "lobby") {
    openDestroyConfirm();
  } else {
    openLeaveConfirm();
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
  // Figma topbar voice icon replaces the old VoiceButton (which is display:none
  // in the new design). It owns the full click-to-talk cycle: first tap joins
  // the mesh AND starts transmitting, subsequent taps toggle transmission
  // on/off. Without press()/release() the mic stays muted and no audio ever
  // leaves this client, so "voice doesn't work" even though the WS join
  // succeeds. Matches VoiceButton.vue's onClick logic 1:1.
  if (voice.isConnecting.value) return;
  if (!voice.isActive.value) {
    haptic("medium");
    await voice.toggle();
    if (voice.isActive.value) {
      haptic("heavy");
      voice.press();
    }
    return;
  }
  if (voice.isTransmitting.value) {
    haptic("light");
    voice.release();
  } else {
    haptic("heavy");
    voice.press();
  }
}
// Long-press on the voice icon fully disarms (leaves the mesh + drops peers).
// The old VoiceButton had a dedicated × badge for this; with that button
// hidden the topbar icon needs to own disarm too.
let voiceHoldTimer: number | null = null;
function voiceHoldStart() {
  if (!voice.isActive.value) return;
  voiceHoldTimer = window.setTimeout(() => {
    haptic("medium");
    voice.stop();
    voiceHoldTimer = null;
  }, 700);
}
function voiceHoldEnd() {
  if (voiceHoldTimer !== null) {
    clearTimeout(voiceHoldTimer);
    voiceHoldTimer = null;
  }
}

// Player-count subtitle (lobby). In-game topbar uses the same value via a
// pill so the format stays compact for both places.
const subtitle = computed(() => {
  if (!game.room) return locale.value === "ru" ? "Подключение…" : "Connecting…";
  const n = playerCount.value;
  return locale.value === "ru" ? `Игроков: ${n}` : `Players: ${n}`;
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
/**
 * What `currentTurn` SHOULD look like to the user at this exact moment.
 *
 * The server bumps `room.currentTurn` the instant a player's action
 * resolves on the server side — for a bot this is well before its
 * pawn has even started walking on the client. Reading
 * `r.currentTurn` directly would slide the turn-banner to the next
 * player while the previous bot is still mid-roll/walk, which the
 * playtester (rightly) called out as confusing: "another player
 * just rolled the dice, but the slider already shows my turn".
 *
 * Fix: while a dice/move animation is in flight, freeze the
 * displayed turn on whoever is actually animating. The FLIP
 * transition then plays at the moment that *feels* like the
 * handoff (pawn lands → animatingPlayerId clears → slider slides),
 * not the moment the server posted the update.
 */
const displayedTurnIndex = computed<number>(() => {
  const r = game.room;
  if (!r || r.players.length === 0) return 0;
  if (game.animatingPlayerId) {
    const i = r.players.findIndex((p) => p.id === game.animatingPlayerId);
    if (i >= 0) return i;
  }
  return r.currentTurn;
});

const turnSlots = computed<{ key: string; player: Player; role: "prev" | "current" | "next" }[]>(() => {
  const r = game.room;
  if (!r || r.players.length === 0) return [];
  const n = r.players.length;
  const i = displayedTurnIndex.value;
  const prev = r.players[(i - 1 + n) % n];
  const cur  = r.players[i];
  const next = r.players[(i + 1) % n];
  // 3+ players: key by player.id so Vue's TransitionGroup FLIP slides
  // persistent cards (current→prev, next→current, fresh next fades in).
  // 2-player: prev === next — duplicate player.id keys would crash Vue, so
  // prefix with role to keep them unique. FLIP persistence is lost but the
  // visual stays a 3-slot banner with the red current card centered, which
  // is what the designer intended.
  if (n >= 3) {
    return [
      { key: prev.id, player: prev, role: "prev" as const },
      { key: cur.id,  player: cur,  role: "current" as const },
      { key: next.id, player: next, role: "next" as const },
    ];
  }
  return [
    { key: `prev-${prev.id}`,    player: prev, role: "prev" as const },
    { key: `current-${cur.id}`,  player: cur,  role: "current" as const },
    { key: `next-${next.id}`,    player: next, role: "next" as const },
  ];
});

// Leaderboard pills now use each player's assigned token colour (same as the
// turn-slider dots) — users reported the old rank-keyed palette felt
// disconnected from the rest of the UI ("everything is green but players
// are red and blue"). Keyed by player index in room.players so the colour is
// stable for a player regardless of their current standing.

// Current-tile plate under the turn slider. Shows name of whatever tile
// the active player stands on; value depends on the tile kind:
//   street / railroad / utility → price (unowned) or rent (owned)
//   tax                         → tax amount
//   go / chest / chance / jail / parking / goToJail → no value
const currentTileInfo = computed<{ name: string; value: number | null } | null>(() => {
  const r = game.room;
  const cp = game.currentPlayer;
  if (!r || !cp) return null;
  // Server updates cp.position to the destination BEFORE the client's
  // animated walk finishes. If we read it directly the tile plate flashes
  // "Jail" / "Chance" / etc while the token is still hopping, which looks
  // like a state bug to the player. Prefer the animated position while the
  // walk is in progress; fall back to the real position once it lands.
  const animPos = game.animatedPositions?.[cp.id];
  const pos = typeof animPos === "number" ? animPos : cp.position;
  const tile = BOARD[pos];
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
  if (!r) return [] as { id: string; name: string; cash: number; color: string; avatar?: string; token: string }[];
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
    .map((p, seat) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      avatar: p.avatar,
      token: p.token,
      worth: p.cash + propValue(p.id),
      seat,
    }))
    .sort((a, b) => b.worth - a.worth)
    .map((row) => ({
      id: row.id,
      name: row.name,
      cash: row.cash,
      avatar: row.avatar,
      token: row.token,
      color: ORDERED_PLAYER_COLORS[row.seat % ORDERED_PLAYER_COLORS.length],
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
  if (rank === 0) return "/figma/room/medal-gold.webp";
  if (rank === 1) return "/figma/room/medal-silver.webp";
  return "/figma/room/medal-bronze.webp";
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
    // Jailed player: stack the bail / get-out-card options ABOVE the
    // roll-for-doubles button. We were dropping these entirely after
    // the Figma redesign — old GameHud rendered them, the new
    // primary-bar didn't. Reusing existing variants keeps the styling
    // consistent: green "buy" = pay, orange "auction" = use card,
    // blue "roll" = try doubles. The jail key in GameHud's me-card
    // still shows the count.
    const me = game.me;
    if (me?.inJail) {
      const buttons: ActionButton[] = [];
      if (me.cash >= 50) {
        buttons.push({
          variant: "buy",
          label: isRu ? "ВЫКУПИТЬСЯ ($50)" : "PAY BAIL ($50)",
          handler: payJail,
        });
      }
      if (me.getOutCards.length > 0) {
        buttons.push({
          variant: "auction",
          label: isRu ? "ИСПОЛЬЗОВАТЬ КАРТУ" : "USE CARD",
          handler: useJailCard,
        });
      }
      buttons.push({
        variant: "roll",
        label: isRu ? "БРОСИТЬ КУБИКИ" : "ROLL DICE",
        handler: roll,
      });
      return buttons;
    }
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
    <!-- Room bg pattern lives on <body> via the `room-figma-root` class
         applied by the phase watcher, so it reaches the safe-area strips
         Telegram draws above/below the app (a component-local <img> can't
         cross the #app viewport boundary). -->

    <!-- ── Topbar ── -->
    <div v-if="isLobby" class="topbar topbar--figma">
      <button class="topbar__back" :aria-label="t('actions.back')" @click="leaveRoom">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M15 18l-6-6 6-6"
            stroke="#000"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="title">
        <h1>{{ locale === 'ru' ? 'Комната' : 'Room' }} {{ id }}</h1>
        <div class="sub">{{ subtitle }}</div>
      </div>
      <!-- Red × is shown for everyone in the lobby — host destroys the
           room, invited player leaves. Both pathways open a confirm modal
           (Figma 133:15211 / 133:15948) instead of firing immediately. -->
      <button
        v-if="game.room?.phase === 'lobby'"
        class="topbar__menu topbar__menu--close"
        :aria-label="t('actions.back')"
        @click="handleMenu"
      >
        <Icon name="x" :size="18" color="#fff" />
      </button>
    </div>

    <!-- ── In-game topbar (Figma) ── -->
    <div v-else class="room-topbar" :class="{ 'room-topbar--scrolled': isScrolled }">
      <div class="room-topbar__title-block">
        <h1 class="room-topbar__title">
          {{ locale === 'ru' ? 'Комната' : 'Room' }} {{ id }}
        </h1>
        <div class="room-topbar__pill">{{ subtitle }}</div>
      </div>
      <div class="room-topbar__actions">
        <!-- Per Figma 67:1455 the nav order is voice → chat → menu.
             Voice PNG (imgImage29) = 3D headphones; tap toggles join/PTT,
             long-press fully leaves. Status dot in corner: grey (idle),
             red (joined+muted), pulsing green (transmitting), amber
             (connecting), orange (error). -->
        <button
          class="room-topbar__nav-btn"
          :aria-label="locale === 'ru' ? 'Голос' : 'Voice'"
          @click="toggleVoice"
          @mousedown="voiceHoldStart"
          @mouseup="voiceHoldEnd"
          @mouseleave="voiceHoldEnd"
          @touchstart.passive="voiceHoldStart"
          @touchend="voiceHoldEnd"
          @touchcancel="voiceHoldEnd"
        >
          <img src="/figma/room/nav-chat.webp" alt="" />
          <span
            class="voice-dot"
            :class="{
              'voice-dot--idle': !voice.isActive.value && !voice.isConnecting.value && !voice.lastError.value,
              'voice-dot--active': voice.isActive.value && !voice.isTransmitting.value,
              'voice-dot--transmit': voice.isTransmitting.value,
              'voice-dot--connect': voice.isConnecting.value,
              'voice-dot--err': !!voice.lastError.value,
            }"
            aria-hidden="true"
          />
        </button>
        <!-- Speech-bubble PNG (imgImage28) → text chat toggle. nav-home.png
             /nav-chat.png were mis-named on download; the bubble file is
             on disk under nav-home.png. -->
        <button
          class="room-topbar__nav-btn"
          :aria-label="locale === 'ru' ? 'Чат' : 'Chat'"
          @click="toggleChat"
        >
          <img src="/figma/room/nav-home.webp" alt="" />
        </button>
        <!-- Red × leaves the match (Figma 133:13821 / 133:14512). Hamburger
             was the old design's "menu" stand-in but the only entry it had
             was leave-game, so the redesign cuts straight to a close icon
             that opens the leave-confirm modal. -->
        <button
          class="room-topbar__menu-btn room-topbar__menu-btn--close"
          :aria-label="locale === 'ru' ? 'Выйти' : 'Leave'"
          @click="handleMenu"
        >
          <Icon name="x" :size="18" color="#fff" />
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
      <div class="room-body" @scroll.passive="handleBodyScroll">
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
              <img src="/figma/room/icon-stopwatch.webp" alt="" />
              <span>{{ turnRemainingSec }}</span>
            </div>
            </template>
            <div v-if="game.me && !isPreRoll" class="board-hud__budget">
              <div class="board-hud__budget-row">
                <span>{{ locale === 'ru' ? 'Ваш бюджет' : 'Your budget' }}</span>
                <span class="board-hud__budget-val">
                  <img src="/figma/room/icon-money.webp" alt="" />
                  {{ game.me.cash }}
                </span>
              </div>
              <div class="board-hud__budget-row">
                <span>{{ locale === 'ru' ? 'Собственностей' : 'Properties' }}</span>
                <span class="board-hud__budget-val">
                  <img src="/figma/room/icon-chair.webp" alt="" />
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
              :style="slot.role === 'current'
                ? { background: slot.player.color }
                : undefined"
            >
              <div class="turn-card__avatar" />
              <div class="turn-card__body">
                <div class="turn-card__name">{{ slot.player.name }}</div>
                <div class="turn-card__stats">
                  <span><img src="/figma/room/icon-money.webp" alt=""/>{{ slot.player.cash }}</span>
                  <span><img src="/figma/room/icon-chair.webp" alt=""/>{{ propCountFor(slot.player.id) }}</span>
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
            <img src="/figma/room/icon-money.webp" alt="" />
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
                <img
                  v-if="p.avatar"
                  class="leaderboard__avatar"
                  :src="p.avatar"
                  alt=""
                  referrerpolicy="no-referrer"
                />
                <span v-else class="leaderboard__avatar leaderboard__avatar--token" aria-hidden="true">
                  {{ shopTokenIcon(p.token) }}
                </span>
                <span class="leaderboard__name">{{ p.name }}</span>
              </div>
              <span class="leaderboard__cash">
                <img src="/figma/room/icon-money.webp" alt="" />
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
            <img src="/figma/room/icon-money.webp" alt="" />
            {{ btn.price }}
          </span>
        </button>
      </div>

      <!-- ── End-of-game results modal (Figma 132:1746 + restart flow
           133:5203 / 133:3980 / 133:4390 / 133:4794) ──
           - Configure → /create (host wants to tweak rules)
           - PlayAgain → /rooms (legacy quick-rematch route — falls back here
             when the host hits НАЧАТЬ in the ready-check state too, since
             there's no in-place restart RPC yet).
           - ReadyToggle → emits a `ready` WS message so the existing lobby
             readiness state powers the ready-check pills. -->
      <CoronationModal
        :open="isEnded"
        :players="game.room?.players ?? []"
        :my-id="game.myPlayerId"
        :host-id="game.room?.hostId ?? null"
        :properties="game.room?.properties ?? {}"
        :on-close="() => router.replace({ name: 'home' })"
        :on-play-again="() => router.replace({ name: 'rooms' })"
        :on-configure="() => router.replace({ name: 'create' })"
        :on-ready-toggle="ready"
      />
    </template>

    <!-- ── Initial load spinner (sigil, matches mockup) ── -->
    <LoadingScreen
      v-else
      variant="sigil"
      :fullscreen="true"
      :message="locale === 'ru' ? 'Загружаем игру…' : 'Loading the game…'"
    />

    <!-- ── Confirm modals (Figma 133:15211 / 133:15948).
         Same sticky-bottom geometry the lobby's invite modal uses so the
         confirm cards "rise" from the bottom edge and feel anchored to
         the action that triggered them rather than floating in the
         middle of the viewport. -->
    <transition name="lobby-modal">
      <div
        v-if="destroyConfirmOpen"
        class="lobby-modal-backdrop"
        @click.self="destroyConfirmOpen = false"
      >
        <div class="lobby-modal lobby-modal--confirm">
          <div class="lobby-modal__head">
            <h2 class="lobby-modal__title">
              {{ locale === 'ru' ? 'Распустить партию?' : 'Disband the room?' }}
            </h2>
            <p class="lobby-modal__subtitle">
              {{
                locale === 'ru'
                  ? 'Настройки сохранятся для будущих партий'
                  : 'Your settings will be saved for future games'
              }}
            </p>
          </div>
          <div class="lobby-modal__buttons">
            <button
              type="button"
              class="lobby-cta lobby-cta--cancel"
              @click="destroyConfirmOpen = false"
            >
              <span class="lobby-cta__text">{{ locale === 'ru' ? 'ОТМЕНА' : 'CANCEL' }}</span>
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
              class="lobby-cta lobby-cta--unready"
              @click="confirmDestroy"
            >
              <span class="lobby-cta__text">{{ locale === 'ru' ? 'РАСПУСТИТЬ' : 'DISBAND' }}</span>
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
          </div>
        </div>
      </div>
    </transition>

    <transition name="lobby-modal">
      <div
        v-if="leaveConfirmOpen"
        class="lobby-modal-backdrop"
        @click.self="leaveConfirmOpen = false"
      >
        <div class="lobby-modal lobby-modal--confirm">
          <div class="lobby-modal__head">
            <h2 class="lobby-modal__title">
              {{ locale === 'ru' ? 'Выйти из партии?' : 'Leave the game?' }}
            </h2>
            <p v-if="leaveSubtitle" class="lobby-modal__subtitle">
              {{ leaveSubtitle }}
            </p>
          </div>
          <div class="lobby-modal__buttons">
            <button
              type="button"
              class="lobby-cta lobby-cta--unready"
              @click="confirmLeave"
            >
              <span class="lobby-cta__text">{{ locale === 'ru' ? 'ВЫЙТИ' : 'LEAVE' }}</span>
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
              :class="leaveCancelInGame ? 'lobby-cta--start' : 'lobby-cta--cancel'"
              @click="leaveConfirmOpen = false"
            >
              <span class="lobby-cta__text">{{ leaveCancelLabel }}</span>
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
          </div>
        </div>
      </div>
    </transition>

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

    <!-- ── Connection-issue popup (Figma 133:14137). Mascot + status text
         sits on top of the still-visible board so the user can see the
         frozen state behind. Auto-dismisses on reconnect; no buttons —
         it's a status notice, not a prompt. -->
    <transition name="bonus">
      <div v-if="connectionLost" class="conn-issue-backdrop">
        <div class="conn-issue-card">
          <div class="conn-issue-art" aria-hidden="true">
            <img src="/figma/lobby/connection-mascot.webp" alt="" />
          </div>
          <h2 class="conn-issue-title">
            {{ locale === 'ru' ? 'Проблемы с сетью' : 'Network issues' }}
          </h2>
          <p class="conn-issue-sub">
            {{ locale === 'ru' ? 'Переподключаемся...' : 'Reconnecting…' }}
          </p>
        </div>
      </div>
    </transition>
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

/* ── Lobby topbar (Figma 73:3483). Cream bg matches the new Lobby page
      styling so the header feels like part of the screen, not a stripe.
      Back button is a 44×44 white circle with soft shadow; title is
      Unbounded Black 18px with a 40%-opaque Unbounded Medium subtitle. ── */
.topbar--figma {
  gap: 16px;
  padding: 8px 24px 12px;
  background: #faf3e2;
  transition: box-shadow 160ms ease;
}
.topbar--figma .topbar__back,
.topbar--figma .topbar__menu {
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 120ms ease;
}
.topbar--figma .topbar__back:active,
.topbar--figma .topbar__menu:active { transform: scale(0.92); }
/* Red close-room button (Figma 73:3483 — imgBtnBack1). */
.topbar--figma .topbar__menu--close {
  background: #f34822;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.08);
}

.topbar--figma .title { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.topbar--figma .title h1 {
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #000;
  margin: 0;
  letter-spacing: 0;
}
.topbar--figma .title .sub {
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  opacity: 0.4;
  margin: 0;
  text-transform: none;
  letter-spacing: 0;
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
  /* bg color lives on <body> via room-figma-root (so safe-areas stay green) */
  background: transparent;
  color: #fff;
  padding: 0;
  overflow-y: hidden;
  font-family: 'Unbounded', 'Golos Text', sans-serif;
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
  transition: background-color 200ms ease, box-shadow 200ms ease, border-radius 200ms ease;
}
/* Scrolled state: header detaches from the body via shadow + rounded
   bottom corners only (Figma 67:1455). No background override — the
   body's #9fe101 + pattern overlay already shows through, so painting
   a flat #9fe101 would kill the pattern and shift the hue. */
.room-topbar--scrolled {
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
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
  /* Anchor `.voice-dot` (position: absolute) to THIS button instead of
     letting it bubble up the DOM and stick to the right edge of the
     whole topbar — that's where it was landing because no ancestor
     between had `position: relative`. */
  position: relative;
}
.room-topbar__nav-btn img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  pointer-events: none;
}
.room-topbar__nav-btn:active { transform: scale(0.92); }
/* Voice status dot — sits in the top-right of the voice nav button.
   Always rendered so the user has an affordance signaling the button is
   the voice control: subtle grey (idle), red (joined+muted), pulsing
   green (transmitting), amber (connecting), orange (error). */
.voice-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #b3b3b3;
  border: 2px solid #fff;
  box-shadow: 0 1.5px 3px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  transition: background-color 180ms ease;
}
.voice-dot--idle { background: #b3b3b3; }
.voice-dot--active { background: #e84b3e; }
.voice-dot--transmit {
  background: #4ed636;
  animation: voice-dot-pulse 1s ease-in-out infinite;
}
.voice-dot--connect {
  background: #d69e36;
  animation: voice-dot-breath 1.1s ease-in-out infinite;
}
.voice-dot--err {
  background: #e8813e;
  animation: voice-dot-breath 0.8s ease-in-out infinite;
}
@keyframes voice-dot-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(78, 214, 54, 0.5), 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 0 8px rgba(78, 214, 54, 0), 0 1px 3px rgba(0, 0, 0, 0.35);
  }
}
@keyframes voice-dot-breath {
  0%, 100% { filter: brightness(0.85); }
  50%      { filter: brightness(1.15); }
}
.room-topbar__menu-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}
.room-topbar__menu-btn--close {
  background: #f34822;
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.18),
    0 2px 4px rgba(0, 0, 0, 0.18);
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
  /* Designer feedback 2026-05-02 #5.12 — stroke + shadow combo so the
     heading reads on the busy green board bg; was just the shadow. */
  -webkit-text-stroke: 1px #000;
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
  /* Designer feedback 2026-05-02 #5.13 — current-turn band now picks up
     the active player's seat colour via inline :style binding above; the
     hard-coded red read as "alarm" rather than "this player's turn".
     Background fallback kept in case the player object is missing a hex. */
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
  /* Designer feedback 2026-05-02 #5.10 — bump active-player typography
     so the name reads as the focal point of the slider, not equal-weight
     to prev/next. */
  font-size: 16px;
  line-height: 18px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.turn-card--current .turn-card__name {
  color: #fff;
  /* Designer feedback 2026-05-02 #5.13 — stroke + shadow so the name
     stays legible against any seat colour. */
  -webkit-text-stroke: 0.5px #000;
  text-shadow: 1px 1px 0 #000;
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
  /* Designer feedback 2026-05-02 #5.13 — bump stat icons so they don't
     look anaemic next to the upsized player name. */
  width: 16px;
  height: 16px;
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
  object-fit: cover;
  flex-shrink: 0;
  border-radius: 50%;
}
/* Token fallback: shop-item emoji on a dark disc (so colour emojis
   like 🏎️/🐕/🎩 read against the bright pill background). Matches
   Figma 32:2037 where each player's chosen shop token is the medallion. */
.leaderboard__avatar--token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  font-size: 16px;
  line-height: 1;
  overflow: hidden;
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

/* ── Floating voice toggle is replaced by the header icon in the
      Figma redesign. Hide it so nothing overlaps the primary bar;
      the voice client stays mounted for audio I/O. Chat has no FAB
      in the redesigned component — the header icon opens it via the
      `toggle-chat` window event. ── */
.room--figma :deep(.vb-wrap) {
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

/* ── Confirm modals (Figma 133:15211 host destroy / 133:15948 player leave).
   Same parchment look as the lobby's invite modal — same backdrop tint,
   same dock-to-bottom geometry, same 56px parchment-button language so
   the two confirm flows feel like extensions of the lobby chrome rather
   than alien browser dialogs. */
.lobby-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 24px 24px calc(16px + var(--tg-safe-area-inset-bottom, 0px));
}
.lobby-modal {
  position: relative;
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.lobby-modal__head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}
.lobby-modal__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #000;
}
.lobby-modal__subtitle {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: #000;
}
.lobby-modal__buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.lobby-modal__buttons .lobby-cta {
  width: 297px;
  height: 56px;
  position: relative;
  border: 2px solid #000;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease;
}
.lobby-modal__buttons .lobby-cta:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.lobby-modal__buttons .lobby-cta--unready { background: #f34822; }
.lobby-modal__buttons .lobby-cta--cancel  { background: #2283f3; }
.lobby-modal__buttons .lobby-cta--start   { background: #43c22d; }
.lobby-modal__buttons .lobby-cta__text {
  position: relative;
  z-index: 1;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1.4px 1.4px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.01em;
}
.lobby-modal__buttons .lobby-cta__deco {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 98px;
  height: 32.5px;
  pointer-events: none;
}

.lobby-modal-enter-active, .lobby-modal-leave-active {
  transition: opacity 200ms ease;
}
.lobby-modal-enter-active .lobby-modal,
.lobby-modal-leave-active .lobby-modal {
  transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.lobby-modal-enter-from, .lobby-modal-leave-to { opacity: 0; }
.lobby-modal-enter-from .lobby-modal,
.lobby-modal-leave-to .lobby-modal {
  transform: translateY(24px);
}

/* ── Connection-issue popup (Figma 133:14137) — same parchment-card
   language as the other lobby modals so the user reads it as part of
   the app chrome rather than a system-level browser warning. */
.conn-issue-backdrop {
  position: fixed;
  inset: 0;
  z-index: 250;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.conn-issue-card {
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  width: 100%;
  max-width: 345px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.conn-issue-art {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.conn-issue-art img {
  width: 240px;
  height: 240px;
  object-fit: contain;
  margin-top: 24px;
  pointer-events: none;
  user-select: none;
}
.conn-issue-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  text-align: center;
}
.conn-issue-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: rgba(0, 0, 0, 0.4);
  text-align: center;
}
</style>

<style>
/* Figma green pattern on <body> so it fills every pixel of the Telegram
   viewport including the safe-area strips. The pattern PNG is exported as
   blue icons on a blue field; `background-blend-mode: multiply` with the
   green bg turns those blue tones into matching green — same trick the old
   <img mix-blend-mode: multiply> used. Wrappers go transparent so the body
   layer shows through. Applied while a match is running (phase ≠ lobby/ended)
   via the room-figma-root body class toggled by the phase watcher. */
html.room-figma-root,
body.room-figma-root {
  background-color: #9fe101 !important;
  background-image:
    linear-gradient(rgba(159, 225, 1, 0.7), rgba(159, 225, 1, 0.7)),
    url('/figma/room/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
  background-blend-mode: normal, multiply !important;
}
body.room-figma-root #app,
body.room-figma-root .app-root,
body.room-figma-root .app-main,
body.room-figma-root .room {
  background: transparent !important;
}

/* Lobby phase paints the page cream (#faf3e2) so Telegram safe-areas match
   the Figma 73:3483 / 93:8389 lobby — same trick CreateView uses. */
html.lobby-figma-root,
body.lobby-figma-root {
  background-color: #faf3e2 !important;
  background-image: none !important;
}
body.lobby-figma-root #app,
body.lobby-figma-root .app-root,
body.lobby-figma-root .app-main,
body.lobby-figma-root .room {
  background: transparent !important;
}
</style>
