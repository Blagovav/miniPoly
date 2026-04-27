<script setup lang="ts">
import { ref } from "vue";
import RarityGlow, { type Rarity } from "./RarityGlow.vue";

export type MapType =
  | "classic" | "mars" | "space_station"
  | "amsterdam" | "london" | "tokio";

const props = withDefaults(
  defineProps<{
    type: MapType;
    rarity?: Rarity;
    size?: number;
  }>(),
  { rarity: "common", size: 100 },
);

/** Emoji fallback used until designer drops PNGs into web/figma-src/shop/maps/<type>.png. */
const FALLBACK_EMOJI: Record<MapType, string> = {
  classic: "🏛️",
  mars: "🪐",
  space_station: "🛰️",
  amsterdam: "🏘️",
  london: "🗼",
  tokio: "🗾",
};

const imgFailed = ref(false);
const src = `/figma/shop/maps/${props.type}.webp`;
</script>

<template>
  <div class="map" :style="{ width: size + 'px', height: size + 'px' }">
    <RarityGlow :rarity="rarity" :size="Math.round(size * 0.76)" class="map__glow"/>
    <img
      v-if="!imgFailed"
      class="map__img"
      :src="src"
      :alt="type"
      @error="imgFailed = true"
    />
    <div v-else class="map__emoji" :style="{ fontSize: Math.round(size * 0.55) + 'px' }">
      {{ FALLBACK_EMOJI[type] }}
    </div>
  </div>
</template>

<style scoped>
.map {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.map__glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 0;
}
.map__img {
  position: relative;
  z-index: 1;
  width: 134%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
}
.map__emoji {
  position: relative;
  z-index: 1;
  line-height: 1;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
}
</style>
