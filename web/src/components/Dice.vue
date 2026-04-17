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
  width: 52px;
  height: 52px;
  background: linear-gradient(145deg, #fefaf0 0%, #e8dcc0 100%);
  border: 1px solid #c9b88e;
  border-radius: 7px;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.6),
    inset 0 -2px 3px rgba(90, 60, 30, 0.2),
    0 3px 6px rgba(42, 29, 16, 0.25);
  display: grid;
  grid-template-areas:
    "tl .  tr"
    "ml m  mr"
    "bl .  br";
  padding: 8px;
  gap: 2px;
}
.die--speed {
  background: linear-gradient(145deg, var(--gold-soft) 0%, var(--gold) 100%);
  border-color: #8a6520;
  display: grid;
  grid-template-areas: none;
  place-items: center;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.4),
    inset 0 -2px 3px rgba(90, 60, 30, 0.3),
    0 3px 6px rgba(139, 105, 20, 0.35);
}
.speed-face {
  font-size: 20px;
  color: #2a1d10;
  font-weight: 700;
  font-family: var(--font-display);
}
.die--rolling {
  animation: dieRoll 0.6s cubic-bezier(0.3, 1.2, 0.4, 1);
}
@keyframes dieRoll {
  0%   { transform: rotate(0) scale(1); }
  25%  { transform: rotate(180deg) scale(1.12); }
  50%  { transform: rotate(360deg) scale(0.92); }
  75%  { transform: rotate(540deg) scale(1.08); }
  100% { transform: rotate(720deg) scale(1); }
}
.pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2a1d10;
  box-shadow: inset 0 0 1px rgba(212, 168, 74, 0.6);
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
