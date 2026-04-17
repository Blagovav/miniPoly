<script setup lang="ts">
import { computed } from "vue";
import type { SpeedDieFace } from "../../../shared/types";

const props = defineProps<{
  dice: [number, number] | null;
  speedDie: SpeedDieFace | null;
  rolling: boolean;
}>();

function pips(v: number) {
  const map: Record<number, Array<"tl" | "tr" | "ml" | "m" | "mr" | "bl" | "br">> = {
    1: ["m"],
    2: ["tl", "br"],
    3: ["tl", "m", "br"],
    4: ["tl", "tr", "bl", "br"],
    5: ["tl", "tr", "m", "bl", "br"],
    6: ["tl", "tr", "ml", "mr", "bl", "br"],
  };
  return map[v] ?? [];
}

const speedLabel = computed(() => {
  const v = props.speedDie;
  if (v === null) return "";
  if (v === "bus") return "🚌";
  if (v === "monopoly") return "🎩";
  return String(v);
});
</script>

<template>
  <div class="dice-row">
    <div :class="['die', rolling && 'die--rolling']">
      <template v-if="dice">
        <span
          v-for="p in pips(dice[0])"
          :key="p"
          :class="['pip', `pip--${p}`]"
        />
      </template>
    </div>
    <div :class="['die', rolling && 'die--rolling']">
      <template v-if="dice">
        <span
          v-for="p in pips(dice[1])"
          :key="p"
          :class="['pip', `pip--${p}`]"
        />
      </template>
    </div>

    <div v-if="speedDie !== null" :class="['die', 'die--speed', rolling && 'die--rolling']">
      <span class="speed-face">{{ speedLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.dice-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
}
.die {
  position: relative;
  width: 56px;
  height: 56px;
  background:
    linear-gradient(145deg, #ffffff 0%, #d1d5db 100%);
  border-radius: 14px;
  box-shadow:
    0 10px 24px -6px rgba(0, 0, 0, 0.55),
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 2px 0 rgba(255, 255, 255, 0.95),
    inset 0 -4px 10px rgba(0, 0, 0, 0.12),
    inset 2px 0 0 rgba(255, 255, 255, 0.4);
  display: grid;
  grid-template-areas:
    "tl .  tr"
    "ml m  mr"
    "bl .  br";
  padding: 9px;
  gap: 2px;
}
.die--speed {
  background: linear-gradient(145deg, var(--gold) 0%, #d97706 100%);
  display: grid;
  grid-template-areas: none;
  place-items: center;
  box-shadow:
    0 10px 24px -6px rgba(217, 119, 6, 0.5),
    inset 0 2px 0 rgba(255, 255, 255, 0.6),
    inset 0 -4px 8px rgba(0, 0, 0, 0.18);
}
.speed-face {
  font-size: 22px;
  color: #1a1204;
  font-weight: 900;
}
.die--rolling {
  animation: roll 0.6s cubic-bezier(0.3, 1.2, 0.4, 1);
}
@keyframes roll {
  0%   { transform: rotate(0) scale(1); }
  25%  { transform: rotate(180deg) scale(1.15); }
  50%  { transform: rotate(360deg) scale(0.9); }
  75%  { transform: rotate(540deg) scale(1.1); }
  100% { transform: rotate(720deg) scale(1); }
}
.pip {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #4b5563, #0f172a);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  align-self: center;
  justify-self: center;
}
.pip--tl { grid-area: tl; }
.pip--tr { grid-area: tr; }
.pip--ml { grid-area: ml; }
.pip--m  { grid-area: m; }
.pip--mr { grid-area: mr; }
.pip--bl { grid-area: bl; }
.pip--br { grid-area: br; }
</style>
