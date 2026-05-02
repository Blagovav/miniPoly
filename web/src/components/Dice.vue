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
/* Redesigned for the Figma room-screen (node 16:2339) — bright white
   rounded cube with subtle soft-shadow, no parchment/cream tint. The
   pip grid + tumble animation are unchanged so the roll feel matches
   whatever muscle memory the existing player has. */
.die {
  position: relative;
  width: 56px;
  height: 56px;
  background: #ffffff;
  border: none;
  /* Designer feedback 2026-05-02 #5.9 — figma uses a softer 16px corner;
     12px read as a hard-edged cube. */
  border-radius: 16px;
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.18),
    0 1px 0 rgba(0, 0, 0, 0.08),
    inset 0 -4px 0 rgba(0, 0, 0, 0.06);
  display: grid;
  grid-template-areas:
    "tl .  tr"
    "ml m  mr"
    "bl .  br";
  padding: 10px;
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
    background: #fff;
    box-shadow:
      0 8px 20px rgba(34, 131, 243, 0.45),
      0 0 0 0 rgba(34, 131, 243, 0.4);
  }
  100% {
    transform: scale(1);
    background: #fff;
    box-shadow:
      0 6px 12px rgba(0, 0, 0, 0.18),
      0 1px 0 rgba(0, 0, 0, 0.08),
      inset 0 -4px 0 rgba(0, 0, 0, 0.06),
      0 0 0 14px rgba(34, 131, 243, 0);
  }
}
.pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #000;
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
