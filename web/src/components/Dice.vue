<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";

const props = defineProps<{
  dice: [number, number] | null;
  rolling: boolean;
}>();

// What's drawn on each face at any given moment. While rolling=true we
// scramble these every 60ms so the dice feel like they're tumbling; when
// rolling flips false we snap to the real values from the server.
const shownA = ref<number>(props.dice?.[0] ?? 1);
const shownB = ref<number>(props.dice?.[1] ?? 1);
const flashing = ref(false);
let tumbleHandle: ReturnType<typeof setInterval> | null = null;
let flashHandle: ReturnType<typeof setTimeout> | null = null;

function randFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function startTumble() {
  stopTumble();
  tumbleHandle = setInterval(() => {
    shownA.value = randFace();
    shownB.value = randFace();
  }, 60);
}
function stopTumble() {
  if (tumbleHandle) {
    clearInterval(tumbleHandle);
    tumbleHandle = null;
  }
}

watch(
  () => props.rolling,
  (isRolling) => {
    if (isRolling) {
      startTumble();
      flashing.value = false;
      if (flashHandle) { clearTimeout(flashHandle); flashHandle = null; }
    } else {
      stopTumble();
      if (props.dice) {
        shownA.value = props.dice[0];
        shownB.value = props.dice[1];
      }
      flashing.value = true;
      flashHandle = setTimeout(() => {
        flashing.value = false;
        flashHandle = null;
      }, 450);
    }
  },
);

// Server may resend final dice values while we're not rolling (reconnect).
watch(
  () => props.dice,
  (d) => {
    if (!props.rolling && d) {
      shownA.value = d[0];
      shownB.value = d[1];
    }
  },
);

onBeforeUnmount(() => {
  stopTumble();
  if (flashHandle) clearTimeout(flashHandle);
});

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
    <div :class="['die', rolling && 'die--rolling', flashing && 'die--flash']">
      <span
        v-for="p in pips(shownA)"
        :key="p"
        :class="['pip', `pip--${p}`]"
      />
    </div>
    <div :class="['die', rolling && 'die--rolling', flashing && 'die--flash']">
      <span
        v-for="p in pips(shownB)"
        :key="p"
        :class="['pip', `pip--${p}`]"
      />
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
  animation: dieRoll 0.6s cubic-bezier(0.3, 1.2, 0.4, 1) infinite;
}
.die--flash {
  animation: dieFlash 0.45s ease-out;
}
@keyframes dieRoll {
  0%   { transform: rotate(0) scale(1); }
  25%  { transform: rotate(180deg) scale(1.12); }
  50%  { transform: rotate(360deg) scale(0.92); }
  75%  { transform: rotate(540deg) scale(1.08); }
  100% { transform: rotate(720deg) scale(1); }
}
@keyframes dieFlash {
  0% {
    transform: scale(1.2);
    background: linear-gradient(145deg, #fff 0%, #fff3d4 100%);
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.8),
      0 4px 10px rgba(212, 168, 74, 0.5),
      0 0 0 0 rgba(212, 168, 74, 0.9);
  }
  100% {
    transform: scale(1);
    background: linear-gradient(145deg, #fefaf0 0%, #e8dcc0 100%);
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.6),
      inset 0 -2px 3px rgba(90, 60, 30, 0.2),
      0 3px 6px rgba(42, 29, 16, 0.25),
      0 0 0 14px rgba(212, 168, 74, 0);
  }
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
