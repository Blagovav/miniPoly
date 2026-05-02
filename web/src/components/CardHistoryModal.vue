<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import type { DrawnCard, Locale, Player } from "../../../shared/types";
import TokenArt, { type TokenArtId } from "./TokenArt.vue";
import { tokenArtFor } from "../utils/palette";

const props = defineProps<{ open: boolean; onClose: () => void }>();
const { locale } = useI18n();
const game = useGameStore();

type Filter = "all" | "mine";
const filter = ref<Filter>("all");

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      eyebrow: "Архив",
      title: "Действия с карточкой",
      tabAll: "Все игроки",
      tabMine: "Только мои",
      emptyMine: "Ты ещё не тянул карт",
      emptyAll: "Никто ещё не тянул карт",
      deckChance: "Шанс",
      deckChest: "Сундук",
      ago: "назад",
      close: "Закрыть",
    }
  : {
      eyebrow: "Archive",
      title: "Card actions",
      tabAll: "Everyone",
      tabMine: "Mine only",
      emptyMine: "You haven't drawn any cards yet",
      emptyAll: "No cards have been drawn yet",
      deckChance: "Chance",
      deckChest: "Chest",
      ago: "ago",
      close: "Close",
    });

const cards = computed<DrawnCard[]>(() => {
  const hist = game.room?.cardHistory ?? [];
  const mine = game.myPlayerId;
  const filtered = filter.value === "mine" && mine ? hist.filter((c) => c.by === mine) : hist;
  return [...filtered].reverse();
});

function playerFor(id: string): Player | null {
  return game.room?.players.find((p) => p.id === id) ?? null;
}
function playerName(id: string): string {
  return playerFor(id)?.name ?? "—";
}
function playerColor(id: string): string {
  return playerFor(id)?.color ?? "#484337";
}
function playerTokenId(id: string): TokenArtId {
  return tokenArtFor(playerFor(id)?.token || "knight");
}
function deckLabel(deck: DrawnCard["deck"]): string {
  return deck === "chance" ? L.value.deckChance : L.value.deckChest;
}
function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) {
    return isRu.value ? `${sec} сек. ${L.value.ago}` : `${sec}s ${L.value.ago}`;
  }
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    return isRu.value ? `${m} мин. ${L.value.ago}` : `${m}m ${L.value.ago}`;
  }
  const h = Math.floor(sec / 3600);
  return isRu.value ? `${h} ч. ${L.value.ago}` : `${h}h ${L.value.ago}`;
}
</script>

<template>
  <transition name="history-fade">
    <div v-if="props.open" class="history-scrim" @click="props.onClose">
      <div class="history-wrap" @click.stop>
        <div class="history-card">
          <!-- Header: "Архив" badge + title -->
          <div class="history-head">
            <span class="history-eyebrow">{{ L.eyebrow }}</span>
            <h2 class="history-title">{{ L.title }}</h2>
          </div>

          <!-- Tab switcher (segmented pill) -->
          <div class="history-tabs" role="tablist">
            <button
              class="history-tab"
              :class="{ 'history-tab--active': filter === 'all' }"
              role="tab"
              :aria-selected="filter === 'all'"
              @click="filter = 'all'"
            >{{ L.tabAll }}</button>
            <button
              class="history-tab"
              :class="{ 'history-tab--active': filter === 'mine' }"
              role="tab"
              :aria-selected="filter === 'mine'"
              @click="filter = 'mine'"
            >{{ L.tabMine }}</button>
          </div>

          <!-- Empty state -->
          <div v-if="cards.length === 0" class="history-empty">
            {{ filter === "mine" ? L.emptyMine : L.emptyAll }}
          </div>

          <!-- List of card-task entries -->
          <div v-else class="history-list">
            <div
              v-for="(c, i) in cards"
              :key="c.ts + '-' + i"
              class="card-task"
              :style="{ '--player-color': playerColor(c.by) }"
            >
              <div class="card-task__icon">
                <span>{{ c.deck === "chance" ? "?" : "⎔" }}</span>
              </div>
              <div class="card-task__body">
                <div class="card-task__title">{{ c.text[locale as Locale] }}</div>
                <div class="card-task__time">{{ timeAgo(c.ts) }}</div>
                <div class="card-task__reward">
                  <span class="card-task__deck">{{ deckLabel(c.deck) }}</span>
                  <span class="card-task__player">
                    <span
                      class="card-task__player-token"
                      :style="{ background: playerColor(c.by) }"
                    >
                      <TokenArt
                        :id="playerTokenId(c.by)"
                        :size="16"
                        color="#fff"
                        shadow="rgba(0,0,0,0.55)"
                      />
                    </span>
                    <span
                      class="card-task__player-name"
                      :style="{ color: playerColor(c.by) }"
                    >{{ playerName(c.by) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Close FAB sits below the card, mirroring the figma popup-info
             standalone close button (75:5658 / 138:16662). -->
        <button
          type="button"
          class="history-close"
          :aria-label="L.close"
          @click="props.onClose"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="#000"
              stroke-width="2.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Scrim: dark 40% overlay, vertically centred to match the figma
   popup-history pattern. The wrap below stacks the card and the
   standalone close FAB so they read as one unit. */
.history-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(16px + var(--sat, 0px)) 24px calc(16px + var(--csab, 0px));
}
.history-wrap {
  width: 100%;
  max-width: 345px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-height: 0;
}
.history-card {
  width: 100%;
  background: #faf3e2;
  border-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Card scrolls internally if the history is long; the close FAB
     below stays visible. 60px reserves room for the FAB + gap. */
  max-height: calc(100vh - 60px - 32px - var(--sat, 0px) - var(--csab, 0px));
  overflow: hidden;
  font-family: 'Unbounded', sans-serif;
  color: #000;
}

/* ── Standalone close FAB — Figma 138:16662 */
.history-close {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 4px solid #000;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 80ms ease;
}
.history-close:active { transform: scale(0.94); }

/* ── Header ── */
.history-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.history-eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #484337;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
}
.history-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
}

/* ── Tab switcher: pill container with 2 equal halves ── */
.history-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}
.history-tab {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  cursor: pointer;
  transition: background 120ms ease, transform 80ms ease;
}
.history-tab:active { transform: translateY(1px); }
.history-tab--active {
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* ── Empty state ── */
.history-empty {
  padding: 28px 8px;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.5);
}

/* ── List ── */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
  padding-right: 2px;
}
.history-list::-webkit-scrollbar { width: 4px; }
.history-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

/* ── card-task: Figma 43:4743 — white rounded card, right-edge player colour
     bar via inset shadow. Content: round icon + title + time + reward row. ── */
.card-task {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  box-shadow: inset -4px 0 0 0 var(--player-color, #484337);
}
.card-task__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.55);
  flex-shrink: 0;
}
.card-task__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-task__title {
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  word-break: break-word;
}
.card-task__time {
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  color: rgba(0, 0, 0, 0.4);
}
.card-task__reward {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 14px;
  color: #000;
}
.card-task__deck { color: #000; }
.card-task__player {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.card-task__player-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: inset 0 0.5px 0.5px rgba(255, 255, 255, 0.3),
              inset 0 -0.5px 0.5px rgba(0, 0, 0, 0.25);
}
.card-task__player-token :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.card-task__player-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
}

/* ── Transitions ── */
.history-fade-enter-active, .history-fade-leave-active { transition: opacity 0.2s ease; }
.history-fade-enter-from, .history-fade-leave-to { opacity: 0; }
.history-fade-enter-active .history-card,
.history-fade-leave-active .history-card {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.history-fade-enter-from .history-card,
.history-fade-leave-to .history-card { transform: translateY(12%); }
</style>