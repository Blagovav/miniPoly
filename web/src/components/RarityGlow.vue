<script setup lang="ts">
export type Rarity = "common" | "rare" | "epic" | "exotic";

withDefaults(
  defineProps<{
    rarity?: Rarity;
    size?: number;
  }>(),
  { rarity: "common", size: 76 },
);
</script>

<template>
  <div
    class="rg"
    :class="`rg--${rarity}`"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
</template>

<style scoped>
/* Two stacked radial gradients reproduce Figma's rarity-glow-bg + rarity-glow-fg.
   bg: wide soft halo (≈83% inset) — frames the figurine.
   fg: tight bright spot (≈40% inset) — kicks the figurine toward the viewer. */
.rg {
  position: relative;
  pointer-events: none;
}
.rg::before,
.rg::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
}
.rg::before { transform: scale(1.6); filter: blur(10px); opacity: 0.8; }
.rg::after  { transform: scale(0.55); filter: blur(6px); opacity: 0.95; }

.rg--common::before, .rg--common::after { display: none; }

.rg--rare::before {
  background: radial-gradient(circle, rgba(53, 125, 219, 0.65), rgba(53, 125, 219, 0) 70%);
}
.rg--rare::after {
  background: radial-gradient(circle, rgba(120, 180, 255, 0.95), rgba(53, 125, 219, 0) 70%);
}

.rg--epic::before {
  background: radial-gradient(circle, rgba(221, 67, 200, 0.65), rgba(221, 67, 200, 0) 70%);
}
.rg--epic::after {
  background: radial-gradient(circle, rgba(255, 140, 240, 0.95), rgba(221, 67, 200, 0) 70%);
}

.rg--exotic::before {
  background: radial-gradient(circle, rgba(219, 53, 53, 0.7), rgba(219, 53, 53, 0) 70%);
}
.rg--exotic::after {
  background: radial-gradient(circle, rgba(255, 130, 130, 0.95), rgba(219, 53, 53, 0) 70%);
}
</style>
