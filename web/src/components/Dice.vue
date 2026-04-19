<script setup lang="ts">
defineProps<{
  dice: [number, number] | null;
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
