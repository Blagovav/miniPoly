<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";

const { locale } = useI18n();
const router = useRouter();
const route = useRoute();
const inv = useInventoryStore();
const { haptic, notify, userName, setUserName, tg, initData } = useTelegram();

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      greeting: "Добро пожаловать!",
      createT: "Создать партию",
      createS: "Ваши правила и ваш список участников",
      joinT:   "Войти в партию",
      joinS:   "Войдите в заранее созданные другими игроками партии",
      history: "История",
      shop:    "Магазин",
      profile: "Профиль",
      daily:   "Ежедневный бонус",
      settingsAria: "Настройки",
      playerFallback: "Игрок",
      rejoinEyebrow: "Активная партия",
      rejoinMsg: "У вас есть незавершенная партия. Вы можете вернуться, нажав кнопку ниже",
      rejoinBtn: "ВЕРНУТЬСЯ",
      rejoinLeave: "ПОКИНУТЬ",
      rejoinForget: "Забыть",
      saveName: "Сохранить",
      inviteErrorTitle: "Приглашение больше неактуально",
      inviteErrorSub: "Закроется автоматически",
      playerLeftTitle: "Игрок покинул партию",
      playerLeftSub: "Закроется автоматически",
      leaveConfirmTitle: "Выйти из партии?",
      leaveConfirmSub: "Вам будет засчитано поражение",
      leaveConfirmYes: "ВЫЙТИ",
      leaveConfirmNo: "ВЕРНУТЬСЯ К ИГРЕ",
    }
  : {
      greeting: "Welcome!",
      createT: "Create match",
      createS: "Your rules, your guest list",
      joinT:   "Join a match",
      joinS:   "Hop into matches other players have set up",
      history: "History",
      shop:    "Shop",
      profile: "Profile",
      daily:   "Daily bonus",
      settingsAria: "Settings",
      playerFallback: "Player",
      rejoinEyebrow: "Active match",
      rejoinMsg: "You have an unfinished match. Tap below to return.",
      rejoinBtn: "RETURN",
      rejoinLeave: "FORFEIT",
      rejoinForget: "Forget",
      saveName: "Save",
      inviteErrorTitle: "This invite is no longer valid",
      inviteErrorSub: "Will close automatically",
      playerLeftTitle: "A player left the match",
      playerLeftSub: "Will close automatically",
      leaveConfirmTitle: "Leave the match?",
      leaveConfirmSub: "You'll be credited a loss",
      leaveConfirmYes: "LEAVE",
      leaveConfirmNo: "BACK TO GAME",
    });

// ── Daily bonus toast (unchanged from prior design) ──
const bonusAmount = ref(0);
const bonusToast = ref(false);

// ── Rejoin banner — surfaces if a roomId was saved in localStorage within
// the last REJOIN_TTL_MS. After 5 min the room has almost certainly been
// cleaned up server-side, so the banner would just lead to a dead-end.
const REJOIN_TTL_MS = 5 * 60 * 1000;
const activeRoomId = ref<string | null>(null);

function loadActiveRoom() {
  try {
    const id = localStorage.getItem("activeRoomId");
    const tsRaw = localStorage.getItem("activeRoomTs");
    const ts = tsRaw ? Number(tsRaw) : 0;
    if (!id || !ts || Date.now() - ts > REJOIN_TTL_MS) {
      localStorage.removeItem("activeRoomId");
      localStorage.removeItem("activeRoomTs");
      activeRoomId.value = null;
      return;
    }
    activeRoomId.value = id;
  } catch {}
}

onMounted(() => {
  const got = inv.claimDailyBonus();
  if (got > 0) {
    bonusAmount.value = got;
    bonusToast.value = true;
    notify("success");
    setTimeout(() => (bonusToast.value = false), 3500);
  }
  loadActiveRoom();
  // index.html и style.css красят html/body в parchment #f0e4c8.
  // Для нового синего редизайна главной переопределяем фон на уровне
  // <html>/<body>, иначе safe-area полосы (top/bottom) светят кремом.
  document.documentElement.classList.add("home-figma-root");
  document.body.classList.add("home-figma-root");
});
onUnmounted(() => {
  document.documentElement.classList.remove("home-figma-root");
  document.body.classList.remove("home-figma-root");
});

function rejoinRoom() {
  if (!activeRoomId.value) return;
  haptic("medium");
  router.push({ name: "room", params: { id: activeRoomId.value } });
}
function forgetRoom() {
  haptic("light");
  try {
    localStorage.removeItem("activeRoomId");
    localStorage.removeItem("activeRoomTs");
  } catch {}
  activeRoomId.value = null;
}

// ── Forfeit-from-home (Figma 133:14910) ───────────────────────────────
// Tapping ПОКИНУТЬ on the rejoin card opens a confirm popup; confirming
// fires a one-shot WS round-trip — connect, join, leave, close — so the
// server actually marks us as gone (and the rest of the lobby gets the
// player-left broadcast). Without this the user just clears their
// localStorage and the server keeps us seated until the 3-min reconnect
// grace expires, leaving everyone else staring at a ghost.
const leaveConfirmOpen = ref(false);
function openLeaveConfirm() {
  if (!activeRoomId.value) return;
  haptic("light");
  leaveConfirmOpen.value = true;
}
function closeLeaveConfirm() {
  leaveConfirmOpen.value = false;
}
function forfeitRoom() {
  const id = activeRoomId.value;
  if (!id) return;
  haptic("heavy");
  leaveConfirmOpen.value = false;

  // Fire-and-forget WS handshake. We don't block the user on the network
  // round-trip — the banner clears immediately and the server processes
  // the leave whenever the bytes arrive. Any failure (server down, race
  // with cleanup) just leaves the player in their stale slot, which is
  // exactly the prior behaviour, so no need to surface errors.
  try {
    const wsUrl = (import.meta.env.VITE_WS_URL as string) ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    const close = () => {
      try { ws.close(); } catch {}
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        roomId: id,
        tgInitData: initData.value,
        name: userName.value || "Player",
      }));
      ws.send(JSON.stringify({ type: "leave" }));
      // Give the server ~400ms to flush the leave before we tear the
      // socket down — closing too early can drop the second frame on
      // some browsers.
      setTimeout(close, 400);
    };
    ws.onerror = close;
    setTimeout(close, 3000);
  } catch { /* ignore — best-effort cleanup */ }

  forgetRoom();
}

// Inline name edit — surfaces only in dev (no real TG profile) so the user
// can set a test name. In prod the cog is still tappable but is a no-op
// visually; the click still fires haptic for tactile feedback.
const editingName = ref(false);
const nameDraft = ref(userName.value);
function startEditName() {
  haptic("light");
  nameDraft.value = userName.value;
  editingName.value = true;
}
function saveName() { setUserName(nameDraft.value); editingName.value = false; }

function go(name: string) { haptic("light"); router.push({ name }); }

// ── Auto-close status popups ──────────────────────────────────────────
// Both share the same parchment card layout (Figma 133:15574 / 133:5992)
// — only mascot + copy differ. Each is triggered by a router query flag
// set by RoomView when the server cuts us out of a session, and each
// auto-dismisses after 4s. The user can also tap the backdrop to close
// early. Two distinct flags so future code can pick which scenario fits.
type StatusPopup = "invitedError" | "playerLeft";
const statusPopup = ref<StatusPopup | null>(null);
let statusTimer: number | null = null;

function clearStatusTimer() {
  if (statusTimer !== null) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
}

function closeStatusPopup() {
  statusPopup.value = null;
  clearStatusTimer();
  if (route.query.invitedError || route.query.playerLeft) {
    void router.replace({ name: "home" });
  }
}

function fireStatusPopup(kind: StatusPopup) {
  statusPopup.value = kind;
  clearStatusTimer();
  statusTimer = window.setTimeout(closeStatusPopup, 4000);
}

watch(
  () => [route.query.invitedError, route.query.playerLeft] as const,
  ([invited, left]) => {
    if (invited === "1") fireStatusPopup("invitedError");
    else if (left === "1") fireStatusPopup("playerLeft");
  },
  { immediate: true },
);

onUnmounted(() => clearStatusTimer());

const statusPopupTitle = computed(() =>
  statusPopup.value === "playerLeft" ? L.value.playerLeftTitle : L.value.inviteErrorTitle,
);
const statusPopupSub = computed(() =>
  statusPopup.value === "playerLeft" ? L.value.playerLeftSub : L.value.inviteErrorSub,
);
</script>

<template>
  <div class="app home-v2">
    <div class="home-v2__content">
      <!-- Mascot, greeting and settings all live in ONE container so they
           move as a unit (playtester 2026-05-03 — "пусть они будут с
           текстом в одном диве"). The mascot is positioned absolutely
           inside; the greeting sits along the bottom edge so it overlaps
           the lower torso of the character. No overflow:hidden / mask —
           the mascot displays at its full art size. -->
      <div class="home-v2__welcome">
        <img class="home-v2__mascot" src="/figma/home/mascot.webp" alt="" aria-hidden="true" />
        <button
          class="home-v2__settings"
          :aria-label="L.settingsAria"
          @click="go('settings')"
        >
          <img src="/figma/home/settings.webp" alt="" />
        </button>
        <h1 class="home-v2__greeting">{{ L.greeting }}</h1>
      </div>

      <div v-if="!tg && editingName" class="home-v2__name-edit">
        <input
          v-model="nameDraft"
          class="home-v2__name-input"
          maxlength="24"
          autofocus
          @keydown.enter="saveName"
        />
        <button class="home-v2__name-save" @click="saveName">✓</button>
      </div>

      <div class="home-v2__cards" :class="{ 'home-v2__cards--with-active': activeRoomId }">
        <!-- Active match card (Figma 133:14865 / 133:14910). Shown only when
             the rejoin localStorage hint is fresh; replaces the slim banner
             that used to live above the greeting. Two CTAs match the figma
             button row — red "ПОКИНУТЬ" opens a forfeit confirm popup, green
             "ВЕРНУТЬСЯ" jumps straight back into /room/:id. -->
        <transition name="rejoin-fade">
          <div v-if="activeRoomId" class="home-v2__active-match">
            <div class="home-v2__active-match-text">
              <p class="home-v2__active-match-title">{{ L.rejoinEyebrow }}</p>
              <p class="home-v2__active-match-sub">{{ L.rejoinMsg }}</p>
            </div>
            <div class="home-v2__active-match-row">
              <button
                class="home-v2__active-match-btn home-v2__active-match-btn--leave"
                @click="openLeaveConfirm"
              >
                {{ L.rejoinLeave }}
              </button>
              <button
                class="home-v2__active-match-btn home-v2__active-match-btn--return"
                @click="rejoinRoom"
              >
                {{ L.rejoinBtn }}
              </button>
            </div>
          </div>
        </transition>
        <button class="home-v2__card home-v2__card--create" @click="go('create')">
          <img class="home-v2__card-art" src="/figma/home/dice.webp" alt="" />
          <div class="home-v2__card-title">{{ L.createT }}</div>
          <div class="home-v2__card-sub">{{ L.createS }}</div>
        </button>
        <button class="home-v2__card home-v2__card--join" @click="go('rooms')">
          <img
            class="home-v2__card-art home-v2__card-art--join"
            src="/figma/home/magnifier.webp"
            alt=""
          />
          <div class="home-v2__card-title">{{ L.joinT }}</div>
          <div class="home-v2__card-sub">{{ L.joinS }}</div>
        </button>
      </div>

      <nav class="home-v2__nav">
        <button class="home-v2__nav-item home-v2__nav-item--history" @click="go('history')">
          <span class="home-v2__nav-icon">
            <img src="/figma/home/history.webp" alt="" />
          </span>
          <span class="home-v2__nav-label">{{ L.history }}</span>
        </button>
        <button class="home-v2__nav-item home-v2__nav-item--shop" @click="go('shop')">
          <span class="home-v2__nav-icon">
            <img src="/figma/home/shop.webp" alt="" />
          </span>
          <span class="home-v2__nav-label">{{ L.shop }}</span>
        </button>
        <button class="home-v2__nav-item home-v2__nav-item--profile" @click="go('profile')">
          <span class="home-v2__nav-icon">
            <img src="/figma/home/profile.webp" alt="" />
          </span>
          <span class="home-v2__nav-label">{{ L.profile }}</span>
        </button>
      </nav>
    </div>

    <transition name="bonus">
      <div v-if="bonusToast" class="bonus-toast">
        <div class="bonus-toast__icon">🎁</div>
        <div>
          <div class="bonus-toast__title">{{ L.daily }}</div>
          <div class="bonus-toast__val">+{{ bonusAmount }} ◈</div>
        </div>
      </div>
    </transition>

    <!-- ── Auto-close status popups (Figma 133:15574 / 133:5992). Rendered
         over the welcome screen because there's nothing left to show on the
         room route once we've been cut out. The confused-mascot illustration
         shipped with the invited-error popup works for both cases — the head/
         shoulders crop is the same. -->
    <transition name="bonus">
      <div
        v-if="statusPopup"
        class="invite-error-backdrop"
        @click.self="closeStatusPopup"
      >
        <div class="invite-error-card">
          <div class="invite-error-art" aria-hidden="true">
            <img src="/figma/lobby/confused-mascot.webp" alt="" />
          </div>
          <h2 class="invite-error-title">{{ statusPopupTitle }}</h2>
          <p class="invite-error-sub">{{ statusPopupSub }}</p>
        </div>
      </div>
    </transition>

    <!-- ── Forfeit confirm (Figma 133:14910 popup-info 133:14952). Mirrors
         the in-game lobby-modal but bottom-anchored so it pops up from the
         home rejoin card. ВЫЙТИ → forfeitRoom (one-shot WS leave + clear
         localStorage); ВЕРНУТЬСЯ К ИГРЕ → just close the popup. -->
    <transition name="leave-confirm">
      <div
        v-if="leaveConfirmOpen"
        class="leave-confirm-backdrop"
        @click.self="closeLeaveConfirm"
      >
        <div class="leave-confirm-card">
          <div class="leave-confirm-text">
            <h2 class="leave-confirm-title">{{ L.leaveConfirmTitle }}</h2>
            <p class="leave-confirm-sub">{{ L.leaveConfirmSub }}</p>
          </div>
          <div class="leave-confirm-buttons">
            <button
              type="button"
              class="leave-confirm-btn leave-confirm-btn--leave"
              @click="forfeitRoom"
            >
              {{ L.leaveConfirmYes }}
            </button>
            <button
              type="button"
              class="leave-confirm-btn leave-confirm-btn--return"
              @click="closeLeaveConfirm"
            >
              {{ L.leaveConfirmNo }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.home-v2 {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  /* bg color + pattern live on <body> via home-figma-root so safe-areas stay blue */
  background: transparent;
  color: #fff;
  overflow: hidden;
  font-family: 'Golos Text', var(--font-body);
}

.home-v2__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 24px 24px 24px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ── Welcome block: mascot + greeting + settings as one unit.
   Playtester 2026-05-03 — character + text live in one container so
   they move as a unit. Mascot is 220×220 anchored at top-left;
   container is shorter (160px) and `overflow: hidden` crops the
   bottom legs cleanly — keeps the head/torso/bow-tie reading the
   way the figma intends without depending on mask-image (broken in
   Telegram WebView). */
.home-v2__welcome {
  position: relative;
  width: 100%;
  height: 160px;
  overflow: hidden;
  user-select: none;
}
/* Soft fade-out at the bottom — playtester ask "добавь ему размытие
   снизу". A gradient overlay fading to the page bg blue (#0d68db)
   sits over the lower 70px of the mascot, so the legs blend out
   smoothly instead of getting hard-cropped by overflow:hidden alone.
   z-index: 1 puts it above the mascot but below greeting/settings. */
.home-v2__welcome::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 70px;
  background: linear-gradient(180deg, rgba(13, 104, 219, 0) 0%, #0d68db 75%);
  pointer-events: none;
  z-index: 1;
}
.home-v2__mascot {
  position: absolute;
  top: 0;
  left: -16px;
  width: 220px;
  height: 220px;
  object-fit: contain;
  pointer-events: none;
}
.home-v2__settings {
  position: absolute;
  top: 35px;
  right: 0;
  width: 48px;
  height: 48px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 120ms ease;
  z-index: 3;
}
.home-v2__settings img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 66px;
  height: 66px;
  object-fit: contain;
  pointer-events: none;
}
.home-v2__settings:active { transform: scale(0.92); }

/* ── Greeting — bottom-anchored inside the welcome block so the text
   baseline crosses the character's bow tie / lower torso area. ── */
.home-v2__greeting {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 28px;
  line-height: 34px;
  color: #fff;
  /* z-index: 2 — sits above the welcome::after fade overlay (z:1) so
     the text reads at full white instead of getting tinted by the
     gradient. */
  z-index: 2;
  /* Single drop-shadow — figma "stroke" on text always lands as a
     centred webkit-text-stroke in the browser, which fuzzes heavy
     glyphs (Golos 700 / Unbounded Black) into an unreadable double
     outline. Playtester 2026-05-03 — drop the stroke everywhere. */
  text-shadow: 1px 1px 0 #000;
  pointer-events: none;
}

/* ── Inline name edit ── */
.home-v2__name-edit {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 14px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.home-v2__name-input {
  flex: 1;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  color: #000;
  font-size: 14px;
  font-family: 'Golos Text', sans-serif;
  outline: none;
}
.home-v2__name-save {
  padding: 8px 14px;
  background: #fff;
  color: #0d68db;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-family: 'Golos Text', sans-serif;
  font-size: 16px;
  cursor: pointer;
}

/* ── Active-match rejoin card (Figma 133:14865 / 133:14910). Lives at the
   top of the home cards stack; matches the figma 15px padding + 12px gap
   between the title block and the button row. */
.home-v2__active-match {
  background: #faf3e2;
  border-radius: 18px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #000;
}
.home-v2__active-match-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.home-v2__active-match-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 24px;
  color: #000;
}
.home-v2__active-match-sub {
  margin: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}
.home-v2__active-match-row {
  display: flex;
  gap: 4px;
}
.home-v2__active-match-btn {
  flex: 1;
  height: 40px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.8);
  cursor: pointer;
  transition: transform 120ms ease, filter 120ms ease;
}
.home-v2__active-match-btn:active { transform: scale(0.98); }
.home-v2__active-match-btn--leave  { background: #f34822; }
.home-v2__active-match-btn--return { background: #43c22d; }

.rejoin-fade-enter-active, .rejoin-fade-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.rejoin-fade-enter-from, .rejoin-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ── Leave-confirm popup (Figma 133:14910 popup-info 133:14952). Bottom-
   anchored parchment card with red ВЫЙТИ + green ВЕРНУТЬСЯ К ИГРЕ. The
   buttons reuse the in-game lobby-modal silhouette but rendered locally
   so HomeView stays self-contained. */
.leave-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 320;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 24px;
  padding-bottom: calc(24px + var(--tg-safe-area-inset-bottom, 0px));
}
.leave-confirm-card {
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.leave-confirm-text {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}
.leave-confirm-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #000;
}
.leave-confirm-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: #000;
}
.leave-confirm-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.leave-confirm-btn {
  position: relative;
  width: 100%;
  height: 56px;
  border: 2px solid #000;
  border-radius: 18px;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1.4px 1.4px 0 rgba(0, 0, 0, 0.6);
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.leave-confirm-btn:active {
  transform: translateY(2px);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}
.leave-confirm-btn--leave  { background: #f34822; }
.leave-confirm-btn--return { background: #43c22d; }
.leave-confirm-enter-active, .leave-confirm-leave-active {
  transition: opacity 200ms ease;
}
.leave-confirm-enter-active .leave-confirm-card,
.leave-confirm-leave-active .leave-confirm-card {
  transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.leave-confirm-enter-from, .leave-confirm-leave-to { opacity: 0; }
.leave-confirm-enter-from .leave-confirm-card,
.leave-confirm-leave-to .leave-confirm-card {
  transform: translateY(24px);
}

/* ── Primary cards ── */
.home-v2__cards {
  display: flex;
  flex-direction: column;
  /* Figma 13:2077 — without an active match the create+join cards sit
     24px apart and the stack starts 40px below the greeting.
     With an active match (Figma 133:14869) the inner gap tightens to
     12px and the stack starts 24px below the greeting — that's the
     spec, and now that the mascot is properly clipped (no mask
     dependency) the active-match card no longer collides with it. */
  gap: 24px;
  margin-top: 40px;
}
.home-v2__cards--with-active {
  gap: 12px;
  margin-top: 24px;
}
.home-v2__card {
  position: relative;
  width: 100%;
  min-height: 140px;
  padding: 76px 16px 22px;
  background: #faf3e2;
  border: none;
  border-radius: 18px;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.16),
    inset 0 0 8px rgba(0, 0, 0, 0.16);
  text-align: left;
  cursor: pointer;
  color: #000;
  overflow: visible;
  transition: transform 120ms ease;
}
.home-v2__card--join { min-height: 156px; }
.home-v2__card:active { transform: scale(0.99); }

.home-v2__card-art {
  position: absolute;
  top: -37px;
  left: 3px;
  width: 128px;
  height: 128px;
  object-fit: contain;
  pointer-events: none;
}
.home-v2__card-art--join {
  top: -24px;
  left: 5px;
  width: 102px;
  height: 102px;
}

.home-v2__card-title {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 26px;
  color: #000;
}
.home-v2__card-sub {
  margin-top: 10px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}

/* ── Bottom 3-tile nav ── */
.home-v2__nav {
  margin-top: auto;
  padding-top: 32px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.home-v2__nav-item {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 72px;
  transition: transform 120ms ease;
}
/* Figma 13:2108-13:2119 — each nav slot is a 72×72 footprint, but the icon
   art overflows out of it (98 for history/profile, 112 for shop) so the
   character pieces bleed past the tap target. The container stays 72×72 for
   alignment; overflow is visible so the bleed actually shows. */
.home-v2__nav-icon {
  position: relative;
  width: 72px;
  height: 72px;
  pointer-events: none;
}
.home-v2__nav-icon img {
  position: absolute;
  top: -13px;
  left: -13px;
  width: 98px;
  height: 98px;
  object-fit: contain;
  pointer-events: none;
}
.home-v2__nav-item--shop .home-v2__nav-icon img {
  top: -20px;
  left: -20px;
  width: 112px;
  height: 112px;
}
.home-v2__nav-label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #feffff;
  /* See .home-v2__greeting — webkit-text-stroke removed app-wide. */
  text-shadow: 1px 1px 0 #000;
}
.home-v2__nav-item:active { transform: scale(0.92); }

/* ── Bonus toast ── */
.bonus-toast {
  position: fixed;
  top: calc(12px + var(--tg-safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  color: #000;
  z-index: 90;
}
.bonus-toast__icon { font-size: 28px; }
.bonus-toast__title {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.6);
}
.bonus-toast__val {
  font-weight: 700;
  font-size: 18px;
  color: #0d68db;
  margin-top: 2px;
  font-family: 'Golos Text', sans-serif;
}
.bonus-enter-active, .bonus-leave-active {
  transition: transform 0.3s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.2s;
}
.bonus-enter-from, .bonus-leave-to {
  transform: translate(-50%, -30px);
  opacity: 0;
}

/* ── Dead-invite popup (Figma 133:15574). Centred parchment card with the
   confused-mascot illustration on top, title underneath, and a quiet
   "auto-close" hint at the bottom. No buttons — it's a status notice,
   not a prompt. */
.invite-error-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.invite-error-card {
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.invite-error-art {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.invite-error-art img {
  width: 240px;
  height: 240px;
  object-fit: contain;
  /* Crop the mascot vertically so the head + shrug fits the 160px box
     without resizing the figure itself — matches the figma mask. */
  margin-top: 24px;
  pointer-events: none;
  user-select: none;
}
.invite-error-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  text-align: center;
}
.invite-error-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: rgba(0, 0, 0, 0.4);
  text-align: center;
}

@media (min-width: 900px) {
  .home-v2__content { padding: 40px 40px 40px; }
  .home-v2__greeting { font-size: 34px; line-height: 40px; }
  .home-v2__card-title { font-size: 28px; line-height: 30px; }
}
</style>

<style>
/* Figma bg lives on <body> so it fills every pixel of the Telegram viewport
   including the safe-area strips above/below the app. Every wrapper between
   <html> and .home-v2 is forced transparent so the body layer shows through.
   The pattern sits under a 55% blue overlay (layer order: overlay → pattern →
   solid color) so the icons show at ~45% strength — matches the previous
   <img opacity: 0.4> look without needing an extra element. */
html.home-figma-root,
body.home-figma-root {
  background-color: #0d68db !important;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
}
body.home-figma-root #app,
body.home-figma-root .app-root,
body.home-figma-root .app-main,
body.home-figma-root .home-v2 {
  background: transparent !important;
}
</style>
