<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import type { DrawnCard, Locale } from "../../../shared/types";

const { locale } = useI18n();
const game = useGameStore();

const visible = ref(false);
const current = ref<DrawnCard | null>(null);
let timeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => game.room?.lastCard?.ts,
  (ts) => {
    if (!ts || !game.room?.lastCard) return;
    current.value = game.room.lastCard;
    visible.value = true;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => (visible.value = false), 3500);
  },
);

function close() {
  visible.value = false;
  if (timeout) clearTimeout(timeout);
}
</script>

<template>
  <transition name="card-pop">
    <div v-if="visible && current" class="card-overlay" @click="close">
      <div
        :class="['draw-card', current.deck === 'chance' ? 'draw-card--chance' : 'draw-card--chest']"
        @click.stop
      >
        <div class="draw-card__head">
          {{ current.deck === "chance" ? "CHANCE" : "COMMUNITY CHEST" }}
        </div>
        <div class="draw-card__icon">
          {{ current.deck === "chance" ? "❓" : "🎁" }}
        </div>
        <div class="draw-card__text">
          {{ current.text[locale as Locale] }}
        </div>
        <button class="btn btn--primary draw-card__close" @click="close">
          OK
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.card-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
}
.draw-card {
  width: min(320px, 100%);
  padding: 24px;
  border-radius: 18px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: card-float 0.6s ease-out;
}
.draw-card--chance {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #1a1000;
}
.draw-card--chest {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #e0f2fe;
}
.draw-card__head {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.3em;
  opacity: 0.75;
}
.draw-card__icon {
  font-size: 54px;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3));
}
.draw-card__text {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
}
.draw-card__close {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 10px 28px;
  border-radius: 999px;
  font-weight: 700;
  margin-top: 4px;
}

@keyframes card-float {
  0% { transform: rotateY(180deg) translateY(20px) scale(0.8); opacity: 0; }
  60% { transform: rotateY(0) translateY(-4px) scale(1.03); opacity: 1; }
  100% { transform: rotateY(0) translateY(0) scale(1); opacity: 1; }
}
.card-pop-enter-active, .card-pop-leave-active { transition: opacity 0.25s ease; }
.card-pop-enter-from, .card-pop-leave-to { opacity: 0; }
</style>
