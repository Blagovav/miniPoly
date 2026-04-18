<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { PLAYER_COLORS } from "../utils/palette";

defineProps<{
  open: boolean;
  winnerName: string;
  winnerColor?: string;
  treasury?: number;
  rankDelta?: number;
  onClose: () => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

const coins = (() => {
  const arr: { i: number; left: number; shape: string; color: string; duration: number; delay: number }[] = [];
  for (let i = 0; i < 24; i++) {
    arr.push({
      i,
      left: (i * 4.3) % 100,
      shape: i % 3 === 0 ? "50%" : "50% 0",
      color: i % 3 === 0 ? "var(--gold)" : i % 3 === 1 ? "#c04040" : "#b8892e",
      duration: 3 + (i % 5) * 0.5,
      delay: i * 0.2,
    });
  }
  return arr;
})();

function fmt(n: number): string {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("en-US").replace(/,/g, " ");
}
</script>

<template>
  <transition name="cor-fade">
    <div v-if="open" class="cor-overlay">
      <div v-for="c in coins" :key="c.i" class="cor-coin" :style="{
        left: c.left + '%',
        borderRadius: c.shape,
        background: c.color,
        animation: `cor-fall ${c.duration}s linear ${c.delay}s infinite`,
      }"/>

      <div class="cor-eyebrow">
        {{ isRu ? "Победа" : "Winner" }}
      </div>
      <div class="cor-title">{{ winnerName }}</div>

      <svg viewBox="0 0 200 200" class="cor-crown">
        <rect x="60" y="90" width="80" height="60" fill="#4a2e1a" stroke="#d4a84a" stroke-width="2" rx="3"/>
        <rect x="50" y="40" width="100" height="60" fill="#5a3820" stroke="#d4a84a" stroke-width="2" rx="4"/>
        <path d="M70 40 L80 20 L100 10 L120 20 L130 40" fill="none" stroke="#d4a84a" stroke-width="2"/>
        <circle cx="100" cy="12" r="4" fill="#d4a84a"/>
        <rect x="55" y="140" width="10" height="40" fill="#3a2818" stroke="#d4a84a" stroke-width="1"/>
        <rect x="135" y="140" width="10" height="40" fill="#3a2818" stroke="#d4a84a" stroke-width="1"/>
        <circle cx="100" cy="80" r="20" :fill="winnerColor || PLAYER_COLORS.you" stroke="#d4a84a" stroke-width="2"/>
        <text x="100" y="87" text-anchor="middle" fill="#fff" font-size="20" font-family="serif">
          {{ winnerName.charAt(0).toUpperCase() }}
        </text>
        <path d="M80 50 L84 40 L92 46 L100 34 L108 46 L116 40 L120 50 Z" fill="#d4a84a" stroke="#8b6914" stroke-width="1"/>
      </svg>

      <div class="cor-sub">
        {{ isRu
          ? "Ты выиграл партию! Весь капитал твой."
          : "You won the match! The pot is yours." }}
      </div>

      <div class="cor-stats">
        <div class="cor-stats__item">
          <div class="cor-stats__val">◈ {{ fmt(treasury ?? 0) }}</div>
          <div class="cor-stats__lbl">{{ isRu ? "Капитал" : "Cash" }}</div>
        </div>
        <div class="cor-stats__sep"/>
        <div class="cor-stats__item">
          <div class="cor-stats__val">+ {{ rankDelta ?? 0 }}</div>
          <div class="cor-stats__lbl">{{ isRu ? "Ранг" : "Rank" }}</div>
        </div>
      </div>

      <button class="btn btn-primary cor-btn" @click="onClose">
        {{ isRu ? "Вернуться" : "Return" }}
      </button>
    </div>
  </transition>
</template>

<style scoped>
.cor-overlay {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: radial-gradient(ellipse at 50% 40%, rgba(90, 58, 154, 0.92), rgba(26, 15, 5, 0.96));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 24px;
}
.cor-coin {
  position: absolute;
  top: -20px;
  width: 10px;
  height: 10px;
  opacity: 0.85;
  pointer-events: none;
}
@keyframes cor-fall {
  to { transform: translateY(110vh) rotate(540deg); }
}

.cor-eyebrow {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--gold);
  text-transform: uppercase;
}
.cor-title {
  font-family: var(--font-title);
  font-size: 30px;
  color: #f7eeda;
  letter-spacing: 0.05em;
  margin-top: 6px;
  text-align: center;
  text-transform: uppercase;
}
.cor-crown {
  width: 180px;
  margin: 14px 0;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4));
}
.cor-sub {
  font-family: var(--font-display);
  font-size: 15px;
  color: #c9b88e;
  text-align: center;
  max-width: 280px;
  line-height: 1.4;
}
.cor-stats {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.cor-stats__item {
  text-align: center;
}
.cor-stats__val {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--gold);
}
.cor-stats__lbl {
  font-size: 10px;
  color: #b8a580;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 2px;
}
.cor-stats__sep {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.18);
}
.cor-btn {
  margin-top: 22px;
  padding: 12px 28px;
}

.cor-fade-enter-active, .cor-fade-leave-active { transition: opacity 350ms ease; }
.cor-fade-enter-from, .cor-fade-leave-to { opacity: 0; }
</style>
