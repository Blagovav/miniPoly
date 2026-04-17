<script setup lang="ts">
defineProps<{ text?: string }>();
</script>

<template>
  <div class="fleuron">
    <div class="fleuron__rule fleuron__rule--left" />
    <span class="fleuron__text">{{ text || "❦" }}</span>
    <div class="fleuron__rule fleuron__rule--right" />
  </div>
</template>

<style scoped>
.fleuron {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  color: var(--ink-3);
}
.fleuron__rule {
  flex: 1;
  height: 1px;
}
.fleuron__rule--left {
  background: linear-gradient(90deg, transparent, var(--line-strong));
}
.fleuron__rule--right {
  background: linear-gradient(90deg, var(--line-strong), transparent);
}
.fleuron__text {
  font-size: 12px;
  font-family: var(--font-title);
  letter-spacing: 0.15em;
}
</style>
