<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

interface HistoryMatch {
  id: number;
  roomId: string;
  endedAt: string;
  won: boolean;
  cashAtEnd: number;
  opponentNames: string[];
  opponentCash: number[];
}

const { locale } = useI18n();
const router = useRouter();
const { haptic, userId } = useTelegram();

// History list — fetched from /api/users/:tgUserId/history. The
// engine writes a row per participant on game end (engine.ts
// checkWinCondition → recordMatch). Read-only — the user explicitly
// asked NOT to make the rows clickable for rejoin («просто история»).
const matches = ref<HistoryMatch[]>([]);
const loading = ref(false);
const activeFilter = ref(0);

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "История игр",
      filters: ["Все игры", "Победы"],
      roomPrefix: "Комната",
      victory: "Победа",
      placeNth: (n: number) => `${n} место`,
      unfinished: "Не завершена",
      versus: "против",
      create: "СОЗДАТЬ ПАРТИЮ",
      emptyLine1: "Истории партий пока нет.",
      emptyLine2: "Сыграй первую партию",
    }
  : {
      title: "Match History",
      filters: ["All", "Victories"],
      roomPrefix: "Room",
      victory: "Victory",
      placeNth: (n: number) => `${n}${ordinalSuffix(n)} place`,
      unfinished: "Unfinished",
      versus: "vs",
      create: "CREATE MATCH",
      emptyLine1: "No match history yet.",
      emptyLine2: "Play your first match",
    });

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// Final standing within the match — rank everyone by cash desc, find me.
// Server records `won` directly, so the winner is `1` regardless. Lower
// places are computed from opponentCash + my cashAtEnd.
function placeFor(m: HistoryMatch): number {
  if (m.won) return 1;
  const cashes = [m.cashAtEnd, ...m.opponentCash];
  const sorted = [...cashes].sort((a, b) => b - a);
  return sorted.indexOf(m.cashAtEnd) + 1;
}

const filteredMatches = computed(() => {
  if (activeFilter.value === 1) return matches.value.filter((m) => m.won);
  return matches.value;
});

function goBack() {
  haptic("light");
  router.back();
}

function goCreate() {
  haptic("medium");
  router.push({ name: "create" });
}

function setFilter(i: number) {
  if (activeFilter.value === i) return;
  haptic("light");
  activeFilter.value = i;
}

async function loadHistory() {
  if (!userId.value) return;
  loading.value = true;
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const res = await fetch(`${base}/api/users/${userId.value}/history`);
    if (!res.ok) return;
    const data = await res.json();
    matches.value = (data.matches ?? []) as HistoryMatch[];
  } catch {
    // network — empty state covers it
  } finally {
    loading.value = false;
  }
}

const scrollEl = ref<HTMLDivElement | null>(null);
const scrolled = ref(false);
function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  scrolled.value = el.scrollTop > 4;
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % ORDERED_PLAYER_COLORS.length;
  return ORDERED_PLAYER_COLORS[idx];
}

onMounted(() => {
  document.documentElement.classList.add("history-figma-root");
  document.body.classList.add("history-figma-root");
  void loadHistory();
});
onUnmounted(() => {
  document.documentElement.classList.remove("history-figma-root");
  document.body.classList.remove("history-figma-root");
});
</script>

<template>
  <div class="app history-v2">
    <div class="history-v2__header" :class="{ 'history-v2__header--scrolled': scrolled }">
      <div class="history-v2__navbar">
        <button class="history-v2__back" :aria-label="'back'" @click="goBack">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="#0d68db"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h1 class="history-v2__title">{{ L.title }}</h1>
      </div>

      <div class="history-v2__filters">
        <button
          v-for="(f, i) in L.filters"
          :key="i"
          class="history-v2__chip"
          :class="{ 'history-v2__chip--active': activeFilter === i }"
          @click="setFilter(i)"
        >{{ f }}</button>
      </div>
    </div>

    <div class="history-v2__scroll" ref="scrollEl" @scroll.passive="onScroll">
      <div v-if="filteredMatches.length === 0" class="history-v2__empty">
        <img
          class="history-v2__empty-art"
          src="/figma/rooms/char-empty.webp"
          alt=""
        />
        <div class="history-v2__empty-text">
          <p>{{ L.emptyLine1 }}</p>
          <p>{{ L.emptyLine2 }}</p>
        </div>
      </div>

      <div v-else class="history-v2__list">
        <div
          v-for="m in filteredMatches"
          :key="m.id"
          class="history-v2__card"
        >
          <div class="history-v2__card-body">
            <div class="history-v2__card-name">
              {{ L.roomPrefix }} {{ m.roomId }}
            </div>
            <div
              v-if="m.opponentNames.length > 0"
              class="history-v2__card-host"
            >
              <span
                class="history-v2__host-dot"
                :style="{ background: `radial-gradient(circle at 30% 30%, ${colorFor(m.opponentNames[0])}aa, ${colorFor(m.opponentNames[0])})` }"
              >{{ m.opponentNames[0][0]?.toUpperCase() || '?' }}</span>
              <span class="history-v2__host-name">
                {{ L.versus }} {{ m.opponentNames.join(', ') }}
              </span>
            </div>
            <!-- Result pill replaces the seats pill from rooms-list. Green
                 for victory, slate for non-podium. No JOIN button — user
                 explicitly asked the history rows be read-only. -->
            <div
              class="history-v2__result-pill"
              :class="m.won ? 'history-v2__result-pill--win' : 'history-v2__result-pill--place'"
            >
              <span class="history-v2__result-text">
                {{ m.won ? L.victory : L.placeNth(placeFor(m)) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="history-v2__cta-wrap">
      <button class="history-v2__cta" @click="goCreate">
        <span class="history-v2__cta-text">{{ L.create }}</span>
        <svg
          class="history-v2__cta-deco"
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
</template>

<style scoped>
.history-v2 {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: transparent;
  color: #fff;
  overflow: hidden;
  font-family: 'Golos Text', sans-serif;
}

.history-v2__header {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  padding: 16px 24px 20px;
  transition: box-shadow 200ms ease, border-radius 200ms ease;
}
.history-v2__header--scrolled {
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
}
.history-v2__navbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
}
.history-v2__back {
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
.history-v2__back:active { transform: scale(0.92); }
.history-v2__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}

.history-v2__filters {
  display: flex;
  gap: 6px;
  margin-top: 16px;
  overflow-x: auto;
  scrollbar-width: none;
}
.history-v2__filters::-webkit-scrollbar { display: none; }
.history-v2__chip {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 #000;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.history-v2__chip--active {
  background: #fff;
  border-color: #fff;
  color: #000;
  text-shadow: none;
}

.history-v2__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 24px 96px;
  scrollbar-width: thin;
}
.history-v2__scroll::-webkit-scrollbar { width: 4px; }
.history-v2__scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 2px;
}

.history-v2__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-v2__card {
  background: #faf3e2;
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.history-v2__card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history-v2__card-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 20px;
  color: #000;
}
.history-v2__card-host {
  display: flex;
  align-items: center;
  gap: 8px;
}
.history-v2__host-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'SF Pro Rounded', 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);
  flex-shrink: 0;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25), inset 0 -1px 1px rgba(0, 0, 0, 0.2);
}
.history-v2__host-name {
  flex: 1;
  min-width: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-v2__result-pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 100px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.history-v2__result-pill--win {
  background: #43c22d;
}
.history-v2__result-pill--place {
  background: #6b7280;
}
.history-v2__result-text {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  text-shadow: 0.4px 0.4px 0 rgba(0, 0, 0, 0.4);
  white-space: nowrap;
}

.history-v2__seat-pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px 8px 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 100px;
}
.history-v2__seat-pill--full {
  padding-left: 14px;
}
.history-v2__seat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #6de84d, #2eab1e);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), inset 0 -1px 1px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
.history-v2__seat-text {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
}

.history-v2__enter {
  width: 100%;
  height: 40px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  background: #4ed636;
  color: #fff;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  text-align: center;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.8);
  cursor: pointer;
  transition: transform 80ms ease, filter 120ms ease;
}
.history-v2__enter:active { transform: translateY(1px); }
.history-v2__enter--disabled {
  background: #b5b5b5;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  cursor: not-allowed;
}
.history-v2__enter--disabled:active { transform: none; }

.history-v2__empty {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding-bottom: 40px;
}
.history-v2__empty-art {
  width: 240px;
  height: 240px;
  object-fit: contain;
  pointer-events: none;
}
.history-v2__empty-text {
  text-align: center;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 30px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}
.history-v2__empty-text p { margin: 0; }

.history-v2__cta-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 24px calc(16px + var(--sab, 0px));
  background: linear-gradient(180deg, rgba(13, 104, 219, 0), #0d68db 35%);
  pointer-events: none;
}
.history-v2__cta {
  pointer-events: auto;
  position: relative;
  width: 100%;
  height: 56px;
  padding: 0 18px;
  border: 2px solid #000;
  border-radius: 18px;
  background: #4ed636;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease, filter 120ms ease;
}
.history-v2__cta:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.history-v2__cta-text {
  position: relative;
  z-index: 1;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 24px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.01em;
}
.history-v2__cta-deco {
  position: absolute;
  top: 4px;
  right: 8px;
  width: 98px;
  height: 32.5px;
  pointer-events: none;
}

@media (min-width: 900px) {
  .history-v2__header { padding: 24px 40px 20px; }
  .history-v2__scroll { padding: 20px 40px 96px; }
  .history-v2__cta-wrap { padding-left: 40px; padding-right: 40px; }
}
</style>

<style>
html.history-figma-root,
body.history-figma-root {
  background-color: #0d68db !important;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
}
body.history-figma-root #app,
body.history-figma-root .app-root,
body.history-figma-root .app-main,
body.history-figma-root .history-v2 {
  background: transparent !important;
}
</style>
