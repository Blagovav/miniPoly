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
const { haptic, notify, userName, setUserName, tg } = useTelegram();

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
      friends: "Друзья",
      daily:   "Ежедневный бонус",
      settingsAria: "Настройки",
      playerFallback: "Игрок",
      rejoinEyebrow: "Активная партия",
      rejoinMsg: "Ты не вышел из партии — вернуться к игре?",
      rejoinBtn: "Вернуться",
      rejoinForget: "Забыть",
      saveName: "Сохранить",
      inviteErrorTitle: "Приглашение больше неактуально",
      inviteErrorSub: "Закроется автоматически",
      playerLeftTitle: "Игрок покинул партию",
      playerLeftSub: "Закроется автоматически",
    }
  : {
      greeting: "Welcome!",
      createT: "Create match",
      createS: "Your rules, your guest list",
      joinT:   "Join a match",
      joinS:   "Hop into matches other players have set up",
      history: "History",
      shop:    "Shop",
      friends: "Friends",
      daily:   "Daily bonus",
      settingsAria: "Settings",
      playerFallback: "Player",
      rejoinEyebrow: "Active match",
      rejoinMsg: "You didn't leave the match — want to return?",
      rejoinBtn: "Return",
      rejoinForget: "Forget",
      saveName: "Save",
      inviteErrorTitle: "This invite is no longer valid",
      inviteErrorSub: "Will close automatically",
      playerLeftTitle: "A player left the match",
      playerLeftSub: "Will close automatically",
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
      <transition name="rejoin-fade">
        <div v-if="activeRoomId" class="home-v2__rejoin">
          <div class="home-v2__rejoin-body">
            <div class="home-v2__rejoin-eyebrow">
              {{ L.rejoinEyebrow }} · {{ activeRoomId }}
            </div>
            <div class="home-v2__rejoin-msg">{{ L.rejoinMsg }}</div>
          </div>
          <button class="home-v2__rejoin-go" @click="rejoinRoom">
            {{ L.rejoinBtn }}
          </button>
          <button
            class="home-v2__rejoin-forget"
            @click="forgetRoom"
            :aria-label="L.rejoinForget"
          >
            ✕
          </button>
        </div>
      </transition>

      <div class="home-v2__hero">
        <div class="home-v2__mascot-clip" aria-hidden="true">
          <img class="home-v2__mascot" src="/figma/home/mascot.webp" alt="" />
        </div>
        <button
          class="home-v2__settings"
          :aria-label="L.settingsAria"
          @click="startEditName"
        >
          <img src="/figma/home/settings.webp" alt="" />
        </button>
      </div>
      <h1 class="home-v2__greeting">{{ L.greeting }}</h1>

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

      <div class="home-v2__cards">
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
        <button class="home-v2__nav-item" @click="go('history')">
          <img src="/figma/home/history.webp" alt="" />
          <span>{{ L.history }}</span>
        </button>
        <button class="home-v2__nav-item" @click="go('shop')">
          <img src="/figma/home/shop.webp" alt="" />
          <span>{{ L.shop }}</span>
        </button>
        <button class="home-v2__nav-item" @click="go('friends')">
          <img src="/figma/home/friends.webp" alt="" />
          <span>{{ L.friends }}</span>
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

/* ── Hero: mascot + settings gear. Matches Figma main-menu (node 13:2077):
   mascot box is 190×190 at viewport (24, 69) — left-aligned at the content
   edge. Inside the box the character is rendered at 190×190 and offset by
   (-18, -6) to match Figma's mask-position, which puts the bow-tie center
   at ~(113, 140) in viewport coords (verified pixel-for-pixel vs Figma).
   The greeting then sits 103px below the box top and overlaps the lower
   portion of the character just like in the Figma screenshot. */
.home-v2__hero {
  position: relative;
  height: 190px;
  margin-top: 45px;
  margin-bottom: -87px;
}
.home-v2__mascot-clip {
  position: absolute;
  top: 0;
  left: 0;
  width: 190px;
  height: 190px;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}
.home-v2__mascot {
  position: absolute;
  left: -18px;
  top: -6px;
  width: 190px;
  height: 190px;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.home-v2__settings {
  position: absolute;
  top: 47px;
  right: 0;
  width: 48px;
  height: 48px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 120ms ease;
  z-index: 1;
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

/* ── Greeting — overlaps the lower portion of the clipped mascot box ── */
.home-v2__greeting {
  position: relative;
  margin: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 28px;
  line-height: 34px;
  color: #fff;
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

/* ── Rejoin banner ── */
.home-v2__rejoin {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 10px 10px 14px;
  background: #feffff;
  border-radius: 14px;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.16),
    inset 0 0 8px rgba(0, 0, 0, 0.06);
  color: #000;
}
.home-v2__rejoin-body { flex: 1; min-width: 0; line-height: 1.25; }
.home-v2__rejoin-eyebrow {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: #0d68db;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.home-v2__rejoin-msg {
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: #000;
  margin-top: 2px;
}
.home-v2__rejoin-go {
  background: #0d68db;
  color: #fff;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
.home-v2__rejoin-forget {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.14);
  background: #fff;
  color: #000;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.rejoin-fade-enter-active, .rejoin-fade-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.rejoin-fade-enter-from, .rejoin-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ── Primary cards ── */
.home-v2__cards {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 40px;
}
.home-v2__card {
  position: relative;
  width: 100%;
  min-height: 140px;
  padding: 76px 16px 22px;
  background: #feffff;
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
  top: -40px;
  left: -1px;
  width: 134px;
  height: 134px;
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
.home-v2__nav-item img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  pointer-events: none;
}
.home-v2__nav-item span {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #feffff;
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
