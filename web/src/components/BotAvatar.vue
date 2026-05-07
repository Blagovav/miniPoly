<script setup lang="ts">
import { computed } from "vue";
import { botAvatarColor } from "../utils/palette";
import { useGameStore } from "../stores/game";

const props = defineProps<{
  seed: string;
  size?: number;
}>();

const game = useGameStore();
// Pass the in-room bot seeds so two bots whose names hash to the same
// colour don't end up wearing the same pink. Order matches room.players
// so a returning bot keeps its assigned colour as long as no earlier bot
// in the list joined/left.
const peerSeeds = computed(() =>
  (game.room?.players ?? [])
    .filter((p) => p.isBot)
    .map((p) => p.name || p.id),
);
const dim = computed(() => props.size ?? 40);
const bg = computed(() => botAvatarColor(props.seed, peerSeeds.value));
// Figma framing is a 61×61 mascot in a 40×40 circle, offset by 7.5px down
// and 0.5px right. Scale both proportionally so any size keeps the same
// crop (head/torso centered, boots clipped).
const imgPx = computed(() => Math.round(dim.value * (61 / 40)));
const offsetY = computed(() => +(dim.value * (7.5 / 40)).toFixed(2));
</script>

<template>
  <span
    class="bot-avatar"
    :style="{
      width: dim + 'px',
      height: dim + 'px',
      background: bg,
    }"
    aria-hidden="true"
  >
    <img
      class="bot-avatar__img"
      src="/figma/lobby/bot-mascot.webp"
      :style="{
        width: imgPx + 'px',
        height: imgPx + 'px',
        transform: `translate(calc(-50% + 0.5px), calc(-50% + ${offsetY}px))`,
      }"
      alt=""
    />
  </span>
</template>

<style scoped>
.bot-avatar {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: inline-block;
  box-shadow: inset 0 -2px 2px rgba(0, 0, 0, 0.18);
}
.bot-avatar__img {
  position: absolute;
  left: 50%;
  top: 50%;
  pointer-events: none;
  user-select: none;
}
</style>
