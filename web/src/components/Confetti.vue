<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const COLORS = ["#fbbf24", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4"];
const COUNT = 80;

interface Piece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  shape: "square" | "circle" | "triangle";
  size: number;
}

const pieces = ref<Piece[]>([]);
let timer: ReturnType<typeof setTimeout> | null = null;

function fire() {
  pieces.value = Array.from({ length: COUNT }, (_, i) => ({
    id: Date.now() + i,
    x: Math.random() * 100,
    delay: Math.random() * 600,
    duration: 2400 + Math.random() * 1800,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotate: Math.random() * 720 - 360,
    shape: (["square", "circle", "triangle"] as const)[Math.floor(Math.random() * 3)],
    size: 6 + Math.random() * 8,
  }));
  timer = setTimeout(() => (pieces.value = []), 4500);
}

onMounted(fire);
onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="confetti">
    <div
      v-for="p in pieces"
      :key="p.id"
      :class="['piece', `piece--${p.shape}`]"
      :style="{
        left: `${p.x}%`,
        animationDelay: `${p.delay}ms`,
        animationDuration: `${p.duration}ms`,
        background: p.shape === 'triangle' ? 'transparent' : p.color,
        borderBottomColor: p.color,
        width: p.shape === 'triangle' ? 0 : `${p.size}px`,
        height: p.shape === 'triangle' ? 0 : `${p.size}px`,
        borderLeftWidth: p.shape === 'triangle' ? `${p.size / 2}px` : 0,
        borderRightWidth: p.shape === 'triangle' ? `${p.size / 2}px` : 0,
        borderBottomWidth: p.shape === 'triangle' ? `${p.size}px` : 0,
        transform: `rotate(${p.rotate}deg)`,
      }"
    />
  </div>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 200;
  overflow: hidden;
}
.piece {
  position: absolute;
  top: -20px;
  animation: fall linear forwards;
  will-change: transform, top;
}
.piece--circle { border-radius: 50%; }
.piece--triangle {
  border-style: solid;
  border-color: transparent;
}
@keyframes fall {
  0% { transform: translateY(0) rotate(0); opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
</style>
