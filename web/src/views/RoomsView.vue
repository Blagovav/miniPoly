<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { PublicRoomSummary } from "../../../shared/types";
import { useTelegram } from "../composables/useTelegram";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

const { locale } = useI18n();
const router = useRouter();
const { haptic } = useTelegram();

const rooms = ref<PublicRoomSummary[]>([]);
const loading = ref(false);
// 0 = All, 1 = Friends (placeholder — no friend data yet), 2 = Free seats only.
const activeFilter = ref(0);

const API_URL = (import.meta.env.VITE_API_URL as string) || "";

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Игры",
      openCount: (n: number) => n > 0 ? `Открытых партий ${n}` : "Открытых партий нет",
      filters: ["Все игры", "Друзья", "Свободные"],
      roomPrefix: "Комната",
      freeSeats: (n: number) => `Свободных мест: ${n}`,
      noFreeSeats: "Свободных мест нет",
      enter: "ВОЙТИ",
      create: "СОЗДАТЬ ПАРТИЮ",
      emptyLine1: "Открытых партий нет.",
      emptyLine2: "Но вы можете создать свою",
    }
  : {
      title: "Games",
      openCount: (n: number) => n > 0 ? `Open matches ${n}` : "No open matches",
      filters: ["All", "Friends", "Open"],
      roomPrefix: "Room",
      freeSeats: (n: number) => `Free seats: ${n}`,
      noFreeSeats: "No free seats",
      enter: "JOIN",
      create: "CREATE MATCH",
      emptyLine1: "No open matches.",
      emptyLine2: "But you can create your own",
    });

const filteredRooms = computed(() => {
  if (activeFilter.value === 2) {
    return rooms.value.filter((r) => r.playerCount < r.maxPlayers);
  }
  // Filter 1 (Друзья) is a placeholder — no friend data on the server yet.
  // Show the full list so the chip is clickable without breaking anything.
  return rooms.value;
});

async function load() {
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/api/rooms/public`);
    const data = await res.json();
    rooms.value = data.rooms ?? [];
  } finally {
    loading.value = false;
  }
}

function join(id: string, disabled: boolean) {
  if (disabled) return;
  haptic("medium");
  router.push({ name: "room", params: { id } });
}

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

// Scroll-aware header shadow — same pattern as RoomView.
const scrollEl = ref<HTMLDivElement | null>(null);
const scrolled = ref(false);
function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  scrolled.value = el.scrollTop > 4;
}

// Deterministic color for a host name so the sigil is stable across renders.
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % ORDERED_PLAYER_COLORS.length;
  return ORDERED_PLAYER_COLORS[idx];
}

onMounted(() => {
  load();
  // Paint html/body blue so Telegram safe-area strips stay blue instead of
  // flashing the parchment #f0e4c8 from the global stylesheet.
  document.documentElement.classList.add("rooms-figma-root");
  document.body.classList.add("rooms-figma-root");
});
onUnmounted(() => {
  document.documentElement.classList.remove("rooms-figma-root");
  document.body.classList.remove("rooms-figma-root");
});
</script>

<template>
  <div class="app rooms-v2">
    <div class="rooms-v2__header" :class="{ 'rooms-v2__header--scrolled': scrolled }">
      <div class="rooms-v2__navbar">
        <button class="rooms-v2__back" :aria-label="'back'" @click="goBack">
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
        <h1 class="rooms-v2__title">{{ L.title }}</h1>
        <div class="rooms-v2__count-pill">{{ L.openCount(rooms.length) }}</div>
      </div>

      <div class="rooms-v2__filters">
        <button
          v-for="(f, i) in L.filters"
          :key="i"
          class="rooms-v2__chip"
          :class="{ 'rooms-v2__chip--active': activeFilter === i }"
          @click="setFilter(i)"
        >{{ f }}</button>
      </div>
    </div>

    <div class="rooms-v2__scroll" ref="scrollEl" @scroll.passive="onScroll">
      <div v-if="!loading && filteredRooms.length === 0" class="rooms-v2__empty">
        <img
          class="rooms-v2__empty-art"
          src="/figma/rooms/char-empty.webp"
          alt=""
        />
        <div class="rooms-v2__empty-text">
          <p>{{ L.emptyLine1 }}</p>
          <p>{{ L.emptyLine2 }}</p>
        </div>
      </div>

      <div v-else class="rooms-v2__list">
        <div
          v-for="r in filteredRooms"
          :key="r.id"
          class="rooms-v2__card"
        >
          <div class="rooms-v2__card-body">
            <div class="rooms-v2__card-name">
              {{ L.roomPrefix }} {{ r.id }}
            </div>
            <div class="rooms-v2__card-host">
              <span
                class="rooms-v2__host-dot"
                :style="{ background: `radial-gradient(circle at 30% 30%, ${colorFor(r.hostName)}aa, ${colorFor(r.hostName)})` }"
              >{{ r.hostName[0]?.toUpperCase() || '?' }}</span>
              <span class="rooms-v2__host-name">{{ r.hostName }}</span>
            </div>
            <div
              class="rooms-v2__seat-pill"
              :class="{ 'rooms-v2__seat-pill--full': r.playerCount >= r.maxPlayers }"
            >
              <span
                v-if="r.playerCount < r.maxPlayers"
                class="rooms-v2__seat-dot"
                aria-hidden="true"
              />
              <span class="rooms-v2__seat-text">
                {{ r.playerCount < r.maxPlayers
                  ? L.freeSeats(r.maxPlayers - r.playerCount)
                  : L.noFreeSeats }}
              </span>
            </div>
          </div>
          <button
            class="rooms-v2__enter"
            :class="{ 'rooms-v2__enter--disabled': r.playerCount >= r.maxPlayers }"
            :disabled="r.playerCount >= r.maxPlayers"
            @click="join(r.id, r.playerCount >= r.maxPlayers)"
          >{{ L.enter }}</button>
        </div>
      </div>
    </div>

    <div class="rooms-v2__cta-wrap">
      <button class="rooms-v2__cta" @click="goCreate">
        <span class="rooms-v2__cta-text">{{ L.create }}</span>
        <svg
          class="rooms-v2__cta-deco"
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
.rooms-v2 {
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

/* ── Sticky header (navbar + filter chips). Transparent at rest so the
   body's blue + pattern overlay shows through unbroken (Figma 67:1216 —
   the header in the design carries its own copy of the pattern, but on
   the web the body's background-attachment: fixed achieves the same
   continuity for free). */
.rooms-v2__header {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  padding: 16px 24px 20px;
  transition: box-shadow 200ms ease, border-radius 200ms ease;
}
/* On scroll: rounded bottom + shadow detach the header from the list,
   matching RoomView's scrolled-topbar pattern. */
.rooms-v2__header--scrolled {
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
}
.rooms-v2__navbar {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-height: 56px;
  padding-top: 4px;
}
.rooms-v2__back {
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
.rooms-v2__back:active { transform: scale(0.92); }
.rooms-v2__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}
.rooms-v2__count-pill {
  position: absolute;
  /* Figma 67:1298 — pill is centred horizontally under the navbar at
     top:30. Designer feedback 2026-05-02 #4.1: prior left-anchored
     placement (60px) didn't match the figma centred layout. */
  left: 50%;
  transform: translateX(-50%);
  top: 30px;
  padding: 3px 8px;
  background: #fff;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  pointer-events: none;
}

.rooms-v2__filters {
  /* Designer feedback 2026-05-02 #4.2: «Все игры / Друзья / Свободные»
     wrapped to a second row at narrow viewports because the chips were
     allowed to shrink-and-wrap. Hold them to a single line and let the
     row scroll horizontally if the locale ever pushes them past the
     viewport, scrollbar hidden. */
  display: flex;
  gap: 6px;
  margin-top: 16px;
  overflow-x: auto;
  scrollbar-width: none;
}
.rooms-v2__filters::-webkit-scrollbar { display: none; }
.rooms-v2__chip {
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
.rooms-v2__chip--active {
  background: #fff;
  border-color: #fff;
  color: #000;
  text-shadow: none;
}

/* ── Scroll area ── */
.rooms-v2__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 24px 96px;
  scrollbar-width: thin;
}
.rooms-v2__scroll::-webkit-scrollbar { width: 4px; }
.rooms-v2__scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 2px;
}

/* ── Room cards ── */
.rooms-v2__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rooms-v2__card {
  background: #faf3e2;
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rooms-v2__card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rooms-v2__card-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 20px;
  color: #000;
}
.rooms-v2__card-host {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rooms-v2__host-dot {
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
.rooms-v2__host-name {
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

.rooms-v2__seat-pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px 8px 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 100px;
}
.rooms-v2__seat-pill--full {
  padding-left: 14px;
}
.rooms-v2__seat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #6de84d, #2eab1e);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), inset 0 -1px 1px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
.rooms-v2__seat-text {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
}

.rooms-v2__enter {
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
.rooms-v2__enter:active { transform: translateY(1px); }
.rooms-v2__enter--disabled {
  background: #b5b5b5;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  cursor: not-allowed;
}
.rooms-v2__enter--disabled:active { transform: none; }

/* ── Empty state ── */
.rooms-v2__empty {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding-bottom: 40px;
}
.rooms-v2__empty-art {
  width: 240px;
  height: 240px;
  object-fit: contain;
  pointer-events: none;
}
.rooms-v2__empty-text {
  text-align: center;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 30px;
  color: #fff;
  /* Stroke + shadow combo to match the figma empty-state (59:65) +
     designer pattern from PR-A's greeting (#4.3). */
  -webkit-text-stroke: 1px #000;
  text-shadow: 1px 1px 0 #000;
}
.rooms-v2__empty-text p { margin: 0; }

/* ── Bottom CTA ── */
.rooms-v2__cta-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 24px calc(16px + var(--sab, 0px));
  background: linear-gradient(180deg, rgba(13, 104, 219, 0), #0d68db 35%);
  pointer-events: none;
}
.rooms-v2__cta {
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
.rooms-v2__cta:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.rooms-v2__cta-text {
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
.rooms-v2__cta-deco {
  position: absolute;
  top: 4px;
  right: 8px;
  width: 98px;
  height: 32.5px;
  pointer-events: none;
}

@media (min-width: 900px) {
  .rooms-v2__header { padding: 24px 40px 20px; }
  .rooms-v2__scroll { padding: 20px 40px 96px; }
  .rooms-v2__cta-wrap { padding-left: 40px; padding-right: 40px; }
}
</style>

<style>
/* Blue background + pattern painted onto <html>/<body> so Telegram safe-area
   strips (top/bottom) stay blue instead of flashing the parchment #f0e4c8
   from the global stylesheet. Mirrors the approach used by HomeView. */
html.rooms-figma-root,
body.rooms-figma-root {
  background-color: #0d68db !important;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
}
body.rooms-figma-root #app,
body.rooms-figma-root .app-root,
body.rooms-figma-root .app-main,
body.rooms-figma-root .rooms-v2 {
  background: transparent !important;
}
</style>
