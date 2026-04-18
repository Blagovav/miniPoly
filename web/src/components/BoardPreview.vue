<script setup lang="ts">
import { computed } from "vue";
import type { BoardDef } from "../utils/boards";

const props = withDefaults(defineProps<{
  board: BoardDef;
  size?: number;
}>(), { size: 120 });

const tileColors = computed(() => {
  const t = props.board.tiles;
  return [t.brown, t.teal, t.pink, t.orange, t.red, t.yellow, t.green, t.blue];
});
</script>

<template>
  <svg viewBox="0 0 100 100" :width="size" :height="size" style="display: block;">
    <rect x="0" y="0" width="100" height="100" :fill="board.palette.bg" rx="3"/>
    <rect x="14" y="14" width="72" height="72" :fill="board.palette.land" opacity="0.6"/>

    <!-- top edge -->
    <rect v-for="i in 7" :key="'t' + i" :x="(i - 1) * 14" y="0" width="14" height="14"
      :fill="i === 1 || i === 7 ? board.palette.gold : tileColors[(i - 1) % tileColors.length]"
      :stroke="board.palette.line" stroke-width="0.3"/>

    <!-- bottom edge -->
    <rect v-for="i in 7" :key="'b' + i" :x="(i - 1) * 14" y="86" width="14" height="14"
      :fill="i === 1 || i === 7 ? board.palette.gold : tileColors[(i - 1 + 3) % tileColors.length]"
      :stroke="board.palette.line" stroke-width="0.3"/>

    <!-- left edge (rows 1..5) -->
    <rect v-for="i in 5" :key="'l' + i" x="0" :y="i * 14" width="14" height="14"
      :fill="tileColors[(i + 2) % tileColors.length]"
      :stroke="board.palette.line" stroke-width="0.3"/>

    <!-- right edge -->
    <rect v-for="i in 5" :key="'r' + i" x="86" :y="i * 14" width="14" height="14"
      :fill="tileColors[(i + 5) % tileColors.length]"
      :stroke="board.palette.line" stroke-width="0.3"/>

    <!-- per-board scenery -->
    <g v-if="board.id === 'eldmark'">
      <path d="M 35 58 L 40 45 L 50 52 L 60 45 L 65 58 Z" :fill="board.palette.gold" :stroke="board.palette.line" stroke-width="0.4"/>
      <circle cx="50" cy="52" r="1.5" :fill="board.palette.accent"/>
      <text x="50" y="42" text-anchor="middle" font-size="5" :fill="board.palette.line" font-family="serif" font-weight="700">M</text>
    </g>
    <g v-else-if="board.id === 'silvermere'">
      <path d="M 32 62 L 68 62 L 64 68 L 36 68 Z" :fill="board.palette.accent"/>
      <line x1="50" y1="40" x2="50" y2="62" :stroke="board.palette.line" stroke-width="0.6"/>
      <path d="M 50 42 L 62 52 L 50 54 Z" :fill="board.palette.gold"/>
      <path d="M 50 44 L 40 54 L 50 56 Z" :fill="board.palette.gold" opacity="0.7"/>
    </g>
    <g v-else-if="board.id === 'emberhold'">
      <path d="M 28 68 L 42 40 L 58 40 L 72 68 Z" :fill="board.palette.line"/>
      <path d="M 42 40 Q 50 32 58 40" :fill="board.palette.accent"/>
      <circle cx="50" cy="38" r="2" :fill="board.palette.gold"/>
      <path d="M 46 42 L 44 48 M 50 42 L 50 50 M 54 42 L 56 48" :stroke="board.palette.gold" stroke-width="0.6" opacity="0.8"/>
    </g>
    <g v-else-if="board.id === 'thornwood'">
      <rect x="48" y="58" width="4" height="10" :fill="board.palette.line"/>
      <circle cx="50" cy="50" r="10" :fill="board.palette.accent"/>
      <circle cx="44" cy="46" r="5" :fill="board.palette.accent" opacity="0.8"/>
      <circle cx="56" cy="48" r="6" :fill="board.palette.accent" opacity="0.9"/>
    </g>
    <g v-else-if="board.id === 'frostpeak'">
      <path d="M 28 68 L 40 42 L 48 52 L 58 38 L 72 68 Z" :fill="board.palette.accent"/>
      <path d="M 34 56 L 40 42 L 45 50 M 52 48 L 58 38 L 63 50" stroke="#f7f7ff" stroke-width="0.5" fill="none"/>
      <g transform="translate(50, 35)" :stroke="board.palette.line" stroke-width="0.4" fill="none">
        <line x1="-4" y1="0" x2="4" y2="0"/>
        <line x1="0" y1="-4" x2="0" y2="4"/>
        <line x1="-3" y1="-3" x2="3" y2="3"/>
        <line x1="-3" y1="3" x2="3" y2="-3"/>
      </g>
    </g>
    <g v-else-if="board.id === 'scarletmarch'">
      <g transform="translate(50, 50)">
        <line x1="-12" y1="-12" x2="12" y2="12" :stroke="board.palette.line" stroke-width="1.2"/>
        <line x1="12" y1="-12" x2="-12" y2="12" :stroke="board.palette.line" stroke-width="1.2"/>
        <rect x="-2" y="-14" width="4" height="4" :fill="board.palette.gold" transform="rotate(45)"/>
        <rect x="-2" y="-14" width="4" height="4" :fill="board.palette.gold" transform="rotate(-45)"/>
        <circle cx="0" cy="0" r="3" :fill="board.palette.accent"/>
      </g>
    </g>
    <g v-else-if="board.id === 'goldensteppe'">
      <circle cx="50" cy="42" r="7" :fill="board.palette.accent"/>
      <line x1="61" y1="42" x2="65" y2="42" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="57.78" y1="49.78" x2="60.61" y2="52.61" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="50" y1="53" x2="50" y2="57" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="42.22" y1="49.78" x2="39.39" y2="52.61" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="39" y1="42" x2="35" y2="42" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="42.22" y1="34.22" x2="39.39" y2="31.39" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="50" y1="31" x2="50" y2="27" :stroke="board.palette.accent" stroke-width="0.8"/>
      <line x1="57.78" y1="34.22" x2="60.61" y2="31.39" :stroke="board.palette.accent" stroke-width="0.8"/>
      <path d="M 30 62 Q 36 56 42 62 Q 48 58 54 62 Q 60 56 66 62 Q 70 64 70 66 L 30 66 Z" :fill="board.palette.line"/>
    </g>
    <g v-else-if="board.id === 'moonspire'">
      <circle cx="50" cy="40" r="6" :fill="board.palette.gold"/>
      <circle cx="53" cy="38" r="5" :fill="board.palette.bg"/>
      <path d="M 46 68 L 48 50 L 50 44 L 52 50 L 54 68 Z" :fill="board.palette.accent"/>
      <circle cx="50" cy="45" r="1" :fill="board.palette.gold"/>
      <circle cx="30" cy="44" r="0.8" :fill="board.palette.gold"/>
      <circle cx="70" cy="50" r="0.6" :fill="board.palette.gold"/>
      <circle cx="38" cy="55" r="0.7" :fill="board.palette.gold"/>
    </g>
    <g v-else-if="board.id === 'dragonreach'">
      <path d="M 30 55 Q 30 40 50 40 Q 68 40 68 55 Q 68 66 52 66 Q 38 66 38 58 Q 38 52 48 52 Q 56 52 56 58"
        fill="none" :stroke="board.palette.accent" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="30" cy="55" r="2" :fill="board.palette.gold"/>
      <circle cx="29" cy="54" r="0.6" fill="#000"/>
      <circle cx="46" cy="66" r="1.5" :fill="board.palette.gold"/>
      <circle cx="50" cy="66" r="1.5" :fill="board.palette.gold"/>
      <circle cx="54" cy="66" r="1.5" :fill="board.palette.gold"/>
    </g>
    <g v-else-if="board.id === 'sunderhall'">
      <ellipse cx="40" cy="48" rx="8" ry="3" :fill="board.palette.land"/>
      <rect x="38" y="44" width="4" height="4" :fill="board.palette.accent"/>
      <ellipse cx="60" cy="54" rx="10" ry="3" :fill="board.palette.land"/>
      <path d="M 57 48 L 60 42 L 63 48" :fill="board.palette.gold"/>
      <path d="M 32 60 Q 40 56 48 60 Q 56 64 64 60 Q 68 58 72 62" :stroke="board.palette.accent" stroke-width="0.8" fill="none" stroke-dasharray="1 1.5"/>
    </g>
    <g v-else>
      <circle cx="50" cy="50" r="6" :fill="board.palette.gold"/>
    </g>
  </svg>
</template>
