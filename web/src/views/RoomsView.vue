<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { PublicRoomSummary } from "../../../shared/types";
import { useTelegram } from "../composables/useTelegram";
import Icon from "../components/Icon.vue";
import Sigil from "../components/Sigil.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

const { locale } = useI18n();
const router = useRouter();
const { haptic } = useTelegram();

const rooms = ref<PublicRoomSummary[]>([]);
const loading = ref(false);
const codeInput = ref("");
const activeFilter = ref(0);

const API_URL = (import.meta.env.VITE_API_URL as string) || "";

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Игры",
      subtitle: (n: number) => `Открытых партий · ${n}`,
      codePlaceholder: "Введите код…",
      create: "Создать",
      filters: ["Все", "Публичные", "Друзья", "Ставка"],
      empty: "Пока нет открытых партий. Создай первую!",
      host: "Хост",
      stake: "ставка",
      refresh: "Обновить",
    }
  : {
      title: "Games",
      subtitle: (n: number) => `Open matches · ${n}`,
      codePlaceholder: "Enter code…",
      create: "Create",
      filters: ["All", "Public", "Friends", "Stakes"],
      empty: "No open matches yet. Be the first!",
      host: "Host",
      stake: "stake",
      refresh: "Refresh",
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

function join(id: string) {
  haptic("medium");
  router.push({ name: "room", params: { id } });
}

function joinFromInput() {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) return;
  join(code);
}

function goBack() {
  haptic("light");
  router.back();
}

function goCreate() {
  haptic("light");
  router.push({ name: "create" });
}

// Deterministic color for a host name so the sigil is stable across renders.
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % ORDERED_PLAYER_COLORS.length;
  return ORDERED_PLAYER_COLORS[idx];
}

// Stable, tongue-in-cheek "stake" per room so the UI isn't empty. Does NOT hit the API.
function stakeFor(id: string): number {
  const stakes = [100, 250, 500, 1000];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return stakes[Math.abs(hash) % stakes.length];
}

onMounted(load);
</script>

<template>
  <div class="app rooms">
    <div class="topbar">
      <button class="icon-btn" aria-label="back" @click="goBack">
        <Icon name="back" :size="18"/>
      </button>
      <div class="title">
        <h1>{{ L.title }}</h1>
        <div class="sub">{{ L.subtitle(rooms.length) }}</div>
      </div>
      <button
        class="icon-btn"
        :aria-label="L.refresh"
        :disabled="loading"
        @click="load"
      >
        <span :class="{ spin: loading }" style="display: flex;">
          <Icon name="search" :size="18"/>
        </span>
      </button>
    </div>

    <div class="content">
      <!-- Search + Create row -->
      <div class="row" style="gap: 8px; margin-bottom: 12px;">
        <div class="card search-card">
          <Icon name="search" :size="16" color="var(--ink-3)"/>
          <input
            v-model="codeInput"
            class="search-input"
            :placeholder="L.codePlaceholder"
            maxlength="12"
            @keydown.enter="joinFromInput"
          />
        </div>
        <button class="btn btn-primary create-btn" @click="goCreate">
          {{ L.create }}
        </button>
      </div>

      <!-- Filter chips -->
      <div class="filters" style="margin-bottom: 12px;">
        <button
          v-for="(f, i) in L.filters"
          :key="i"
          class="filter-chip"
          :class="{ active: activeFilter === i }"
          @click="activeFilter = i"
        >{{ f }}</button>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && rooms.length === 0" class="card empty">
        <div class="empty__icon">
          <Icon name="tavern" :size="28" color="var(--ink-3)"/>
        </div>
        <p>{{ L.empty }}</p>
        <button class="btn btn-primary" @click="goCreate">
          <Icon name="plus" :size="14" color="#fff"/>
          {{ L.create }}
        </button>
      </div>

      <!-- Rooms list -->
      <div v-else class="rooms-list">
        <button
          v-for="r in rooms"
          :key="r.id"
          class="room-row"
          @click="join(r.id)"
        >
          <Sigil :name="r.hostName" :color="colorFor(r.hostName)" :size="40"/>
          <div class="room-row__body">
            <div class="row" style="gap: 6px;">
              <div class="room-row__code">{{ r.id }}</div>
              <div v-if="r.playerCount >= r.maxPlayers" class="live-pill">LIVE</div>
            </div>
            <div class="room-row__meta">
              {{ L.host }} · {{ r.hostName }} · {{ stakeFor(r.id) }}◈ {{ L.stake }}
            </div>
          </div>
          <div class="room-row__right">
            <div class="room-row__count">{{ r.playerCount }}/{{ r.maxPlayers }}</div>
            <div class="seat-dots">
              <div
                v-for="i in r.maxPlayers"
                :key="i"
                class="seat-dot"
                :class="{ filled: i <= r.playerCount }"
              />
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--bg);
}

/* Topbar back icon color alignment */
.icon-btn :deep(svg) { color: var(--ink-2); }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Search input card */
.search-card {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--ink);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  min-width: 0;
}
.search-input::placeholder {
  color: var(--ink-3);
  text-transform: none;
  letter-spacing: normal;
}
.create-btn {
  padding: 10px 16px;
  white-space: nowrap;
}

/* Filter chips */
.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.filter-chip {
  padding: 6px 12px;
  background: transparent;
  color: var(--ink-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 12px;
  font-family: var(--font-body);
  font-weight: 500;
  cursor: pointer;
  line-height: 1.2;
}
.filter-chip.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

/* Rooms list */
.rooms-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.room-row {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-body);
  color: var(--ink);
  transition: transform 80ms, border-color 160ms;
}
.room-row:active { transform: translateY(1px); }
.room-row:hover { border-color: var(--line-strong); }

.room-row__body { flex: 1; min-width: 0; }
.room-row__code {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--ink);
  letter-spacing: 0.05em;
}
.room-row__meta {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.room-row__right { text-align: right; flex-shrink: 0; }
.room-row__count {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
}
.seat-dots {
  display: flex;
  gap: 2px;
  margin-top: 4px;
  justify-content: flex-end;
}
.seat-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--line-strong);
}
.seat-dot.filled { background: var(--emerald); }

.live-pill {
  padding: 2px 6px;
  background: rgba(139, 26, 26, 0.12);
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  border-radius: 3px;
  line-height: 1.2;
}

/* Empty state */
.empty {
  padding: 32px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}
.empty__icon {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: rgba(90, 58, 24, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty p {
  color: var(--ink-3);
  margin: 0;
  font-size: 13px;
}
</style>
