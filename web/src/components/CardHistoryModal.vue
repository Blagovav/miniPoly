<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import type { DrawnCard, Locale } from "../../../shared/types";
import Icon from "./Icon.vue";

const props = defineProps<{ open: boolean; onClose: () => void }>();
const { locale } = useI18n();
const game = useGameStore();

type Filter = "all" | "mine";
const filter = ref<Filter>("all");

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Свиток указов",
      tabAll: "Все",
      tabMine: "Мои",
      emptyMine: "Ты ещё не тянул карт",
      emptyAll: "Никто ещё не тянул карт",
      deckChance: "Указ",
      deckChest: "Сундук",
      ago: "назад",
      close: "Закрыть",
    }
  : {
      title: "Scroll of decrees",
      tabAll: "All",
      tabMine: "Mine",
      emptyMine: "You haven't drawn any cards yet",
      emptyAll: "No decrees have been drawn yet",
      deckChance: "Decree",
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

function playerName(id: string): string {
  return game.room?.players.find((p) => p.id === id)?.name ?? "—";
}
function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return isRu.value ? `${sec}с` : `${sec}s`;
  if (sec < 3600) return isRu.value ? `${Math.floor(sec / 60)}м` : `${Math.floor(sec / 60)}m`;
  return isRu.value ? `${Math.floor(sec / 3600)}ч` : `${Math.floor(sec / 3600)}h`;
}
</script>

<template>
  <transition name="fade">
    <div v-if="props.open" class="modal-scrim" @click="props.onClose">
      <div class="modal-card history-card" @click.stop>
        <div class="grab-bar" />

        <header class="history-head">
          <div class="history-head__eyebrow">
            {{ isRu ? "Архив" : "Archive" }}
          </div>
          <div class="history-head__title">{{ L.title }}</div>
          <button class="history-close" :aria-label="L.close" @click="props.onClose">
            <Icon name="x" :size="14" color="var(--ink-2)" />
          </button>
        </header>

        <div class="tabs">
          <button
            class="tab"
            :class="{ 'tab--active': filter === 'all' }"
            @click="filter = 'all'"
          >{{ L.tabAll }}</button>
          <button
            class="tab"
            :class="{ 'tab--active': filter === 'mine' }"
            @click="filter = 'mine'"
          >{{ L.tabMine }}</button>
        </div>

        <div v-if="cards.length === 0" class="empty">
          <div class="empty__seal">
            <span>❦</span>
          </div>
          <p>{{ filter === "mine" ? L.emptyMine : L.emptyAll }}</p>
        </div>

        <div v-else class="list">
          <div
            v-for="(c, i) in cards"
            :key="c.ts + '-' + i"
            class="entry"
            :class="`entry--${c.deck}`"
          >
            <div class="entry__seal">
              <span>{{ c.deck === "chance" ? "?" : "⎔" }}</span>
            </div>
            <div class="entry__body">
              <div class="entry__text">{{ c.text[locale as Locale] }}</div>
              <div class="entry__meta">
                <span class="entry__deck">{{ c.deck === "chance" ? L.deckChance : L.deckChest }}</span>
                <span class="entry__sep">·</span>
                <span class="entry__player">{{ playerName(c.by) }}</span>
                <span class="entry__sep">·</span>
                <span class="entry__time">{{ timeAgo(c.ts) }} {{ L.ago }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Scrim / card (parchment bottom-sheet) ── */
.modal-scrim {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}
.modal-card {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--card-alt);
  border-top: 3px solid var(--primary);
  border-radius: 16px 16px 0 0;
  padding: 14px 16px calc(20px + var(--tg-safe-area-inset-bottom, 0px));
  animation: sheet-unfurl 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom;
  box-shadow: 0 -8px 24px rgba(42, 29, 16, 0.25);
}
.grab-bar {
  width: 40px;
  height: 4px;
  background: var(--line-strong);
  border-radius: 2px;
  margin: -2px auto 10px;
  flex-shrink: 0;
}

/* ── Header ── */
.history-head {
  position: relative;
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 10px;
  flex-shrink: 0;
}
.history-head__eyebrow {
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--ink-3);
  text-transform: uppercase;
}
.history-head__title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--ink);
  margin-top: 2px;
}
.history-close {
  position: absolute;
  top: -2px;
  right: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--line);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.history-close:hover {
  background: var(--card);
}

/* ── Tabs ── */
.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.tab {
  padding: 6px 14px;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  background: var(--card);
  color: var(--ink-2);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: transform 80ms, background 120ms;
}
.tab:active { transform: translateY(1px); }
.tab--active {
  background: linear-gradient(180deg, var(--primary-soft) 0%, var(--primary) 100%);
  color: #fff;
  border-color: var(--primary);
  box-shadow: 0 2px 4px rgba(62, 34, 114, 0.25);
}

/* ── Empty state ── */
.empty {
  padding: 36px 16px;
  text-align: center;
  color: var(--ink-3);
}
.empty__seal {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin: 0 auto 10px;
  background: radial-gradient(circle at 35% 30%, var(--bg-deep), var(--line));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--ink-3);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.1);
}
.empty p {
  margin: 0;
  font-size: 13px;
  font-family: var(--font-display);
}

/* ── List ── */
.list {
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
  min-height: 0;
}
.entry {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.entry--chance {
  border-color: rgba(184, 137, 46, 0.4);
  background: linear-gradient(145deg, rgba(212, 168, 74, 0.06), var(--card));
}
.entry--chest {
  border-color: rgba(90, 58, 154, 0.3);
  background: linear-gradient(145deg, rgba(138, 104, 208, 0.06), var(--card));
}
.entry__seal {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 16px;
  color: #fff;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.2);
}
.entry--chance .entry__seal {
  background: radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold));
}
.entry--chest .entry__seal {
  background: radial-gradient(circle at 35% 30%, var(--primary-soft), var(--primary));
}
.entry__body {
  flex: 1;
  min-width: 0;
}
.entry__text {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink);
  line-height: 1.4;
  word-wrap: break-word;
}
.entry__meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-3);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-family: var(--font-body);
}
.entry__deck {
  font-family: var(--font-title);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 10px;
}
.entry--chance .entry__deck { color: var(--gold); }
.entry--chest .entry__deck { color: var(--primary); }
.entry__player { color: var(--ink-2); }
.entry__sep { opacity: 0.5; }
.entry__time { font-family: var(--font-mono); }

/* ── Animations ── */
@keyframes sheet-unfurl {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active .modal-card,
.fade-leave-active .modal-card {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-leave-to .modal-card { transform: translateY(20%); }
</style>
