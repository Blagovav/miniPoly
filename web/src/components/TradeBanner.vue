<script setup lang="ts">
import { computed } from "vue";
import { BOARD } from "../../../shared/board";
import { useI18n } from "vue-i18n";
import type { Locale } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

const props = defineProps<{
  onRespond: (accept: boolean) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const isRu = computed(() => locale.value === "ru");
const game = useGameStore();

// Показываем только если предложение адресовано мне.
const offerForMe = computed(() => {
  const t = game.room?.pendingTrade;
  if (!t || !game.me) return null;
  return t.toId === game.me.id ? t : null;
});

const fromPlayer = computed(() => {
  const t = offerForMe.value;
  if (!t || !game.room) return null;
  return game.room.players.find((p) => p.id === t.fromId) ?? null;
});

const fromIndex = computed(() => {
  const t = offerForMe.value;
  if (!t || !game.room) return -1;
  return game.room.players.findIndex((p) => p.id === t.fromId);
});

const fromColor = computed(() => {
  const idx = fromIndex.value;
  return idx >= 0 ? ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length] : ORDERED_PLAYER_COLORS[0];
});

const tile = computed(() => {
  const t = offerForMe.value;
  return t ? BOARD[t.tileIndex] : null;
});

const L = computed(() => isRu.value
  ? {
      eyebrow: "Гонец",
      title: "Предложение сделки",
      he: "Он предлагает",
      for: "За",
      decline: "Отказать",
      accept: "Принять",
    }
  : {
      eyebrow: "Messenger",
      title: "A proposal arrives",
      he: "He offers",
      for: "For",
      decline: "Decline",
      accept: "Accept",
    });

void props;
</script>

<template>
  <transition name="slide">
    <div v-if="offerForMe && tile" class="trade-banner">
      <div class="trade-banner__head">
        <div class="trade-banner__eyebrow">{{ L.eyebrow }}</div>
        <div class="trade-banner__title">{{ L.title }}</div>
      </div>

      <div class="trade-banner__body row">
        <Sigil
          :name="fromPlayer?.name ?? '?'"
          :color="fromColor"
          :size="36"
        />
        <div class="trade-banner__text">
          <div class="trade-banner__from">{{ fromPlayer?.name }}</div>
          <div class="trade-banner__deal">
            <div class="row between">
              <span class="trade-banner__label">{{ L.he }}</span>
              <span class="trade-banner__money">&#9670; {{ offerForMe.cash }}</span>
            </div>
            <div class="row between">
              <span class="trade-banner__label">{{ L.for }}</span>
              <span class="trade-banner__tile">{{ tile.name[loc] }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="trade-banner__actions">
        <button class="btn btn-ghost" @click="onRespond(false)">
          <Icon name="x" :size="14" color="var(--ink-2)"/>
          {{ L.decline }}
        </button>
        <button class="btn btn-emerald" @click="onRespond(true)">
          <Icon name="check" :size="14" color="#fff"/>
          {{ L.accept }}
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.trade-banner {
  position: fixed;
  top: calc(70px + var(--tg-safe-area-inset-top, 0px));
  left: 14px;
  right: 14px;
  max-width: 460px;
  margin: 0 auto;
  z-index: 105;
  background: var(--card-alt);
  border: 2px solid var(--gold);
  border-radius: var(--r-md);
  padding: 14px 16px;
  box-shadow:
    0 12px 32px rgba(42, 29, 16, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: trade-glow 2.4s ease-in-out infinite;
}

.trade-banner__head {
  text-align: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--divider);
}
.trade-banner__eyebrow {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-3);
  text-transform: uppercase;
}
.trade-banner__title {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--ink);
  margin-top: 2px;
}

.trade-banner__body {
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.trade-banner__text {
  flex: 1;
  min-width: 0;
}
.trade-banner__from {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
  margin-bottom: 6px;
}

.trade-banner__deal {
  background: var(--bg);
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.trade-banner__label {
  color: var(--ink-3);
  font-size: 11px;
}
.trade-banner__money {
  font-family: var(--font-mono);
  color: var(--gold);
  font-weight: 600;
  font-size: 13px;
}
.trade-banner__tile {
  font-family: var(--font-display);
  color: var(--ink);
  font-size: 13px;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-banner__actions {
  display: flex;
  gap: 8px;
}
.trade-banner__actions .btn {
  flex: 1;
  padding: 10px;
  font-size: 13px;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.22s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}

@keyframes trade-glow {
  0%, 100% {
    box-shadow:
      0 12px 32px rgba(42, 29, 16, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 0 0 rgba(184, 137, 46, 0);
  }
  50% {
    box-shadow:
      0 16px 40px rgba(42, 29, 16, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 0 3px rgba(212, 168, 74, 0.25);
  }
}
</style>
