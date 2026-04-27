<script setup lang="ts">
import { ref } from "vue";
import RarityGlow, { type Rarity } from "./RarityGlow.vue";

export type CapType =
  | "hat" | "car" | "ship" | "dog" | "cat" | "ufo"
  | "plane" | "robot" | "balloon" | "duck" | "dyno";

const props = withDefaults(
  defineProps<{
    type: CapType;
    rarity?: Rarity;
    size?: number;
  }>(),
  { rarity: "common", size: 72 },
);

/** Emoji fallback used until designer drops PNGs into web/figma-src/shop/caps/<type>.png. */
const FALLBACK_EMOJI: Record<CapType, string> = {
  hat: "🎩",
  car: "🚗",
  ship: "🚢",
  dog: "🐕",
  cat: "🐈",
  ufo: "🛸",
  plane: "✈️",
  robot: "🤖",
  balloon: "🎈",
  duck: "🦆",
  dyno: "🦖",
};

const imgFailed = ref(false);
const src = `/figma/shop/caps/${props.type}.webp`;
</script>

<template>
  <div class="cap" :style="{ width: size + 'px', height: size + 'px' }">
    <RarityGlow :rarity="rarity" :size="size" class="cap__glow"/>
    <img
      v-if="!imgFailed"
      class="cap__img"
      :src="src"
      :alt="type"
      @error="imgFailed = true"
    />
    <div v-else class="cap__emoji" :style="{ fontSize: Math.round(size * 0.7) + 'px' }">
      {{ FALLBACK_EMOJI[type] }}
    </div>
  </div>
</template>

<style scoped>
.cap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cap__glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 0;
}
.cap__img {
  position: relative;
  z-index: 1;
  width: 118%;
  height: 118%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45));
}
.cap__emoji {
  position: relative;
  z-index: 1;
  line-height: 1;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45));
}
</style>
