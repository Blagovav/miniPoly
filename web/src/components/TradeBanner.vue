<script setup lang="ts">
import { computed } from "vue";
import { BOARD } from "../../../shared/board";
import { useI18n } from "vue-i18n";
import type { Locale } from "../../../shared/types";
import { useGameStore } from "../stores/game";

const props = defineProps<{
  onRespond: (accept: boolean) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
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

const tile = computed(() => {
  const t = offerForMe.value;
  return t ? BOARD[t.tileIndex] : null;
});
</script>

<template>
  <transition name="slide">
    <div v-if="offerForMe && tile" class="trade-banner">
      <div class="trade-banner__head">
        💱 Предложение о покупке
      </div>
      <div class="trade-banner__body">
        <b :style="{ color: fromPlayer?.color }">{{ fromPlayer?.name }}</b>
        предлагает
        <b class="money">${{ offerForMe.cash }}</b>
        за
        <b>{{ tile.name[loc] }}</b>
      </div>
      <div class="trade-banner__actions">
        <button class="btn btn--ghost" @click="onRespond(false)">Отказаться</button>
        <button class="btn btn--neon" @click="onRespond(true)">✓ Продать</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.trade-banner {
  position: fixed;
  top: 70px;
  left: 14px;
  right: 14px;
  max-width: 460px;
  margin: 0 auto;
  z-index: 105;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), var(--surface-strong) 40%);
  border: 1px solid var(--purple);
  border-radius: 16px;
  padding: 14px 16px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px -15px rgba(168, 85, 247, 0.45), 0 0 0 1px var(--purple);
  animation: trade-glow 2.2s ease-in-out infinite;
}
.trade-banner__head {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--purple);
  margin-bottom: 6px;
}
.trade-banner__body {
  font-size: 14px;
  margin-bottom: 10px;
  line-height: 1.4;
}
.trade-banner__actions {
  display: flex;
  gap: 6px;
}
.trade-banner__actions .btn {
  flex: 1;
  padding: 10px;
  font-size: 13px;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.2s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}

@keyframes trade-glow {
  0%, 100% { box-shadow: 0 20px 50px -15px rgba(168, 85, 247, 0.45), 0 0 0 1px var(--purple); }
  50% { box-shadow: 0 20px 60px -10px rgba(168, 85, 247, 0.7), 0 0 0 2px var(--purple); }
}
</style>
