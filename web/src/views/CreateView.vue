<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { useWs } from "../composables/useWs";
import { useGameStore } from "../stores/game";
import BoardPreview from "../components/BoardPreview.vue";
import BoardSelectModal from "../components/BoardSelectModal.vue";
import { findBoard } from "../utils/boards";

const { locale } = useI18n();
const router = useRouter();
const { initData, userName, haptic } = useTelegram();

const isPublic = ref(true);
const maxPlayers = ref(3);
const loading = ref(false);
const boardId = ref<string>("eldmark");
const boardModalOpen = ref(false);

const CASH_PRESETS = [1000, 1500, 2000, 2500, 3000];
const ENTRY_PRESETS = [0, 50, 100, 250, 500, 1000];
const startingCash = ref(1500);
const auctionsOn = ref(true);
const fastPace = ref(false);
const entryFee = ref(100);

function cycle<T>(arr: readonly T[], current: T): T {
  const i = arr.indexOf(current as any);
  return arr[(i + 1) % arr.length];
}
function cycleCash() { haptic("light"); startingCash.value = cycle(CASH_PRESETS, startingCash.value); }
function cycleEntry() { haptic("light"); entryFee.value = cycle(ENTRY_PRESETS, entryFee.value); }
function toggleAuctions() { haptic("light"); auctionsOn.value = !auctionsOn.value; }
function toggleFast() { haptic("light"); fastPace.value = !fastPace.value; }
function togglePrivate() { haptic("light"); isPublic.value = !isPublic.value; }
function pickPlayers(n: number) {
  if (maxPlayers.value === n) return;
  haptic("light");
  maxPlayers.value = n;
}

const fmtCash = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

const ws = useWs();
const game = useGameStore();

const off = ws.onMessage((m) => {
  game.applyMessage(m);
  if (m.type === "joined") {
    router.replace({ name: "room", params: { id: m.roomId } });
  }
});
onUnmounted(off);

const isRu = computed(() => locale.value === "ru");
const board = computed(() => findBoard(boardId.value));
const boardName = computed(() => isRu.value ? board.value.ru : board.value.name);
const boardDesc = computed(() => isRu.value ? board.value.desc.ru : board.value.desc.en);

const L = computed(() => isRu.value
  ? {
      title: "Создание партии",
      subtitle: "Настройки партии",
      boardLabel: "Поле",
      generalLabel: "Общие настройки",
      players: "Количество игроков",
      privateLabel: "Приватная партия",
      rules: "Правила",
      ruleCash: "Стартовый капитал",
      ruleAuctions: "Аукционы",
      rulePace: "Быстрый темп",
      ruleEntry: "Вход",
      create: "СОЗДАТЬ ПАРТИЮ",
    }
  : {
      title: "New Match",
      subtitle: "Match settings",
      boardLabel: "Map",
      generalLabel: "General",
      players: "Player count",
      privateLabel: "Private match",
      rules: "Rules",
      ruleCash: "Starting cash",
      ruleAuctions: "Auctions",
      rulePace: "Fast pace",
      ruleEntry: "Entry",
      create: "CREATE MATCH",
    });

function createRoom() {
  if (loading.value) return;
  haptic("medium");
  loading.value = true;
  ws.send({
    type: "create",
    tgInitData: initData.value,
    name: userName.value,
    isPublic: isPublic.value,
    maxPlayers: maxPlayers.value,
  });
}

function goBack() {
  haptic("light");
  router.back();
}

const scrollEl = ref<HTMLElement | null>(null);
const scrolled = ref(false);
function onScroll() {
  if (!scrollEl.value) return;
  scrolled.value = scrollEl.value.scrollTop > 4;
}

onMounted(() => {
  document.documentElement.classList.add("create-figma-root");
  document.body.classList.add("create-figma-root");
});
onUnmounted(() => {
  document.documentElement.classList.remove("create-figma-root");
  document.body.classList.remove("create-figma-root");
});
</script>

<template>
  <div class="app create-v2">
    <div class="create-v2__header" :class="{ 'create-v2__header--stuck': scrolled }">
      <button class="create-v2__back" :aria-label="'back'" @click="goBack">
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
      <div class="create-v2__title-col">
        <h1 class="create-v2__title">{{ L.title }}</h1>
        <p class="create-v2__subtitle">{{ L.subtitle }}</p>
      </div>
    </div>

    <div ref="scrollEl" class="create-v2__scroll" @scroll="onScroll">
      <!-- Board pick -->
      <section class="create-v2__section create-v2__section--card">
        <div class="create-v2__label">{{ L.boardLabel }}</div>
        <button type="button" class="create-v2__board" @click="boardModalOpen = true">
          <div class="create-v2__board-art">
            <BoardPreview :board="board" :size="56"/>
          </div>
          <div class="create-v2__board-body">
            <div class="create-v2__board-name">{{ boardName }}</div>
            <div class="create-v2__board-desc">{{ boardDesc }}</div>
          </div>
          <img class="create-v2__board-edit" src="/figma/create/edit-pencil.svg" alt="" aria-hidden="true"/>
        </button>
      </section>

      <!-- General settings -->
      <section class="create-v2__section">
        <div class="create-v2__label">{{ L.generalLabel }}</div>
        <div class="create-v2__group">
          <div class="create-v2__cell create-v2__cell--stack">
            <div class="create-v2__cell-caption">{{ L.players }}</div>
            <div class="create-v2__players">
              <button
                v-for="n in [2, 3, 4, 5, 6]"
                :key="n"
                type="button"
                class="create-v2__pbtn"
                :class="{ 'create-v2__pbtn--active': maxPlayers === n }"
                @click="pickPlayers(n)"
              >{{ n }}</button>
            </div>
          </div>
          <div class="create-v2__cell">
            <span class="create-v2__cell-text">{{ L.privateLabel }}</span>
            <button
              type="button"
              class="create-v2__toggle"
              :class="{ 'create-v2__toggle--on': !isPublic }"
              role="switch"
              :aria-checked="!isPublic"
              @click="togglePrivate"
            >
              <span class="create-v2__toggle-dot"/>
            </button>
          </div>
        </div>
      </section>

      <!-- Rules -->
      <section class="create-v2__section">
        <div class="create-v2__label">{{ L.rules }}</div>
        <div class="create-v2__group">
          <button type="button" class="create-v2__cell create-v2__cell--shaded" @click="cycleCash">
            <span class="create-v2__cell-text">{{ L.ruleCash }}</span>
            <span class="create-v2__cell-val">
              <img class="create-v2__coin" src="/figma/create/money.webp" alt="" aria-hidden="true"/>
              {{ fmtCash(startingCash) }}
            </span>
          </button>
          <div class="create-v2__cell">
            <span class="create-v2__cell-text">{{ L.ruleAuctions }}</span>
            <button
              type="button"
              class="create-v2__toggle"
              :class="{ 'create-v2__toggle--on': auctionsOn }"
              role="switch"
              :aria-checked="auctionsOn"
              @click="toggleAuctions"
            >
              <span class="create-v2__toggle-dot"/>
            </button>
          </div>
          <div class="create-v2__cell create-v2__cell--shaded">
            <span class="create-v2__cell-text">{{ L.rulePace }}</span>
            <button
              type="button"
              class="create-v2__toggle"
              :class="{ 'create-v2__toggle--on': fastPace }"
              role="switch"
              :aria-checked="fastPace"
              @click="toggleFast"
            >
              <span class="create-v2__toggle-dot"/>
            </button>
          </div>
          <button type="button" class="create-v2__cell" @click="cycleEntry">
            <span class="create-v2__cell-text">{{ L.ruleEntry }}</span>
            <span class="create-v2__cell-val">
              <img class="create-v2__coin" src="/figma/create/money.webp" alt="" aria-hidden="true"/>
              {{ fmtCash(entryFee) }}
            </span>
          </button>
        </div>
      </section>
    </div>

    <div class="create-v2__cta-wrap">
      <button class="create-v2__cta" :disabled="loading" @click="createRoom">
        <span class="create-v2__cta-text">{{ L.create }}</span>
        <svg
          class="create-v2__cta-deco"
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

    <BoardSelectModal
      :open="boardModalOpen"
      :selected-id="boardId"
      :is-host="true"
      :on-close="() => (boardModalOpen = false)"
      :on-select="(id) => (boardId = id)"
    />
  </div>
</template>

<style scoped>
.create-v2 {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: transparent;
  color: #000;
  overflow: hidden;
  font-family: 'Golos Text', sans-serif;
}

/* ── Header ── */
.create-v2__header {
  position: relative;
  z-index: 3;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 24px 12px;
  background: #faf3e2;
  transition: box-shadow 160ms ease;
}
.create-v2__header--stuck {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
}
/* Figma 73:2685 — flat 44×44 white circle, no shadow. Designer flagged
   the prior soft-shadow look as off-spec (#2.1). */
.create-v2__back {
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 120ms ease;
}
.create-v2__back:active { transform: scale(0.92); }
.create-v2__title-col {
  display: flex;
  flex-direction: column;
  /* Figma 73:3588/73:3589 — title at navbar-y=4, subtitle at y=33,
     i.e. ~9px gap between baselines. Was 1px which read as a single
     stuck block (#2.2). */
  gap: 9px;
  min-width: 0;
}
.create-v2__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #000;
}
.create-v2__subtitle {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  opacity: 0.4;
}

/* ── Scroll area ── */
.create-v2__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 24px 96px;
  scrollbar-width: thin;
}
.create-v2__scroll::-webkit-scrollbar { width: 4px; }
.create-v2__scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.create-v2__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.create-v2__section + .create-v2__section {
  margin-top: 20px;
}
.create-v2__section--card {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
}
.create-v2__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
}

/* ── Board pick ── */
.create-v2__board {
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
.create-v2__board-art {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  flex-shrink: 0;
  line-height: 0;
}
.create-v2__board-art :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.create-v2__board-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #000;
}
.create-v2__board-name {
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
}
.create-v2__board-desc {
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  opacity: 0.85;
}
.create-v2__board-edit {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  pointer-events: none;
}

/* ── Grouped cells ── */
.create-v2__group {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  overflow: hidden;
}
.create-v2__group > .create-v2__cell + .create-v2__cell {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.create-v2__cell {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: transparent;
  border: none;
  cursor: default;
  text-align: left;
  transition: background 120ms ease;
}
button.create-v2__cell { cursor: pointer; }
button.create-v2__cell:active { background: rgba(0, 0, 0, 0.06); }
.create-v2__cell--shaded { background: rgba(0, 0, 0, 0.04); }
button.create-v2__cell.create-v2__cell--shaded:active { background: rgba(0, 0, 0, 0.08); }
.create-v2__cell--stack {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.create-v2__cell-caption {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #484337;
}
.create-v2__cell-text {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #484337;
}
.create-v2__cell-val {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #484337;
}
.create-v2__coin {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

/* ── Players 1–6 ── */
.create-v2__players {
  display: flex;
  gap: 10px;
}
.create-v2__pbtn {
  flex: 1;
  height: 40px;
  padding: 0;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  color: #000;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease, transform 80ms ease;
}
.create-v2__pbtn:active { transform: translateY(1px); }
.create-v2__pbtn--active {
  background: #43c22d;
  border-color: rgba(0, 0, 0, 0.2);
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
}

/* ── Toggle (44×24) ── */
.create-v2__toggle {
  position: relative;
  width: 44px;
  height: 24px;
  padding: 0;
  background: #8d8d8d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 160ms ease;
  flex-shrink: 0;
}
.create-v2__toggle--on { background: #43c22d; }
.create-v2__toggle-dot {
  position: absolute;
  top: 50%;
  left: 3px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  transform: translateY(-50%);
  transition: left 160ms ease;
}
.create-v2__toggle--on .create-v2__toggle-dot { left: 23px; }

/* ── Bottom CTA ── */
.create-v2__cta-wrap {
  /* Figma 73:2774 anchors the CTA to bottom-16. We tighten the wrap
     padding so the CTA doesn't sit ~28px higher than figma in iPhone
     viewports — designer flagged the gap as «отступ больше» (#2.4). */
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 24px calc(16px + var(--sab, 0px));
  background: linear-gradient(180deg, rgba(250, 243, 226, 0), #faf3e2 40%);
  pointer-events: none;
}
.create-v2__cta {
  pointer-events: auto;
  position: relative;
  width: 100%;
  height: 56px;
  padding: 0 18px;
  border: 2px solid #000;
  border-radius: 18px;
  background: #43c22d;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease, filter 120ms ease;
}
.create-v2__cta:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.create-v2__cta:disabled {
  filter: grayscale(0.4) brightness(0.85);
  cursor: not-allowed;
}
.create-v2__cta-text {
  position: relative;
  z-index: 1;
  /* Figma 73:2776 — Golos Text Black 24/26, no letter-spacing. The 0.01em
     extra tracking we had was non-spec and read as too airy (#2.3). */
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 24px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
}
.create-v2__cta-deco {
  position: absolute;
  top: 4px;
  right: 8px;
  width: 98px;
  height: 32.5px;
  pointer-events: none;
}

@media (min-width: 900px) {
  .create-v2__header { padding: 16px 40px 16px; }
  .create-v2__scroll { padding: 20px 40px 96px; }
  .create-v2__cta-wrap { padding-left: 40px; padding-right: 40px; }
}
</style>

<style>
/* Paint html/body parchment so Telegram safe-area strips match the screen
   instead of flashing the blue home/rooms background. Mirrors Rooms/Home. */
html.create-figma-root,
body.create-figma-root {
  background-color: #faf3e2 !important;
  background-image: none !important;
}
body.create-figma-root #app,
body.create-figma-root .app-root,
body.create-figma-root .app-main,
body.create-figma-root .create-v2 {
  background: transparent !important;
}
</style>
