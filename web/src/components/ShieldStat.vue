<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value: string | number;
  accent?: string;
}>(), { accent: "var(--primary)" });
</script>

<template>
  <div class="shield-stat">
    <div class="shield-stat__bar" :style="{ background: accent }"/>
    <div class="shield-stat__val">{{ value }}</div>
    <div class="shield-stat__lbl">{{ label }}</div>
  </div>
</template>

<style scoped>
.shield-stat {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.shield-stat__bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
}
.shield-stat__val {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--ink);
  font-weight: 400;
  letter-spacing: 0.02em;
}
.shield-stat__lbl {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 2px;
}
</style>
