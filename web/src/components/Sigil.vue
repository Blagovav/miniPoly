<script setup lang="ts">
import { computed } from "vue";
import { lighten } from "../utils/palette";

const props = defineProps<{
  name?: string;
  color: string;
  size?: number;
  initial?: string;
}>();

const dim = computed(() => props.size ?? 22);
const bgStyle = computed(() => {
  const c = props.color;
  // Handle hex (lighten only works on hex). For CSS vars, fall back to solid.
  const start = c.startsWith("#") ? lighten(c, 0.2) : c;
  return `radial-gradient(circle at 30% 30%, ${start}, ${c})`;
});
const label = computed(() => {
  if (props.initial) return props.initial;
  if (props.name) return props.name[0].toUpperCase();
  return "?";
});
const fontSize = computed(() => Math.round(dim.value * 0.5));
</script>

<template>
  <div
    class="sigil"
    :style="{
      width: dim + 'px',
      height: dim + 'px',
      background: bgStyle,
      fontSize: fontSize + 'px',
    }"
  >{{ label }}</div>
</template>

<style scoped>
.sigil {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--font-display);
  font-weight: 500;
  flex-shrink: 0;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25), inset 0 -1px 1px rgba(0, 0, 0, 0.2);
  letter-spacing: 0;
}
</style>
