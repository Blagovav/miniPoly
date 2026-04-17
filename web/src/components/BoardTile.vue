<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Tile, OwnedProperty, Player, Locale } from "../../../shared/types";
import { GROUP_COLORS } from "../../../shared/board";
import { useGameStore } from "../stores/game";

const props = defineProps<{
  tile: Tile;
  side: "top" | "bottom" | "left" | "right" | "corner";
  owned?: OwnedProperty;
  owner?: Player;
}>();

const game = useGameStore();
function open() {
  game.selectTile(props.tile.index);
}

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));

const bandColor = computed(() => {
  if (props.tile.kind === "street") return GROUP_COLORS[props.tile.group];
  return null;
});

// Тематическая иконка на каждую клетку (особенно уличные)
const STREET_ICONS: Record<number, string> = {
  1: "🏖️", 3: "🌊",                        // brown (Mediterranean/Baltic)
  6: "🏛️", 8: "🏰", 9: "⛲",               // lightBlue
  11: "🎭", 13: "🎨", 14: "🎪",             // pink
  16: "🚢", 18: "🎸", 19: "🗽",             // orange
  21: "🏇", 23: "🏟️", 24: "🎰",             // red
  26: "🏝️", 27: "🎡", 29: "🌴",             // yellow
  31: "🌉", 32: "🌁", 34: "🗿",             // green
  37: "🏙️", 39: "🎆",                       // darkBlue
};

const tileIcon = computed(() => {
  const t = props.tile;
  switch (t.kind) {
    case "go": return "▶";
    case "jail": return "🔒";
    case "goToJail": return "👮";
    case "freeParking": return "🅿️";
    case "chance": return "❓";
    case "chest": return "🎁";
    case "tax": return "💸";
    case "railroad": return "🚂";
    case "utility":
      return t.index === 12 ? "💡" : "💧";
    case "street":
      return STREET_ICONS[t.index] ?? "🏠";
    default: return "";
  }
});

// Короткое имя только для углов (corner) и спец-клеток; улицы — только иконка + цена
const short = computed(() => {
  const t = props.tile;
  if (t.kind === "street" || t.kind === "railroad" || t.kind === "utility") return "";
  const full = t.name[loc.value];
  if (full.length < 14) return full;
  return full.split(" ").slice(0, 2).join(" ");
});

const priceLabel = computed(() => {
  if (props.tile.kind === "street" || props.tile.kind === "railroad" || props.tile.kind === "utility") {
    return `$${props.tile.price}`;
  }
  return null;
});
</script>

<template>
  <div
    :class="['tile', `tile--${tile.kind}`, `tile--${side}`, owned && 'tile--owned']"
    @click="open"
  >
    <div v-if="bandColor" class="tile__band" :style="{ background: bandColor }" />

    <div class="tile__body">
      <div v-if="tileIcon" class="tile__icon">{{ tileIcon }}</div>
      <div v-if="short" class="tile__name">{{ short }}</div>
      <div v-if="priceLabel" class="tile__price">{{ priceLabel }}</div>
    </div>

    <div v-if="owned && owner" class="tile__owner" :style="{ background: owner.color }" />

    <div v-if="owned && owned.houses > 0 && !owned.hotel" class="tile__houses">
      <span v-for="n in owned.houses" :key="n">🏠</span>
    </div>
    <div v-if="owned && owned.hotel" class="tile__hotel">🏨</div>

    <div v-if="owned && owned.mortgaged" class="tile__mortgaged">🔒</div>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  background: var(--tile-bg, rgba(12, 17, 33, 0.85));
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.4s ease;
  cursor: pointer;
}
.tile:active { transform: scale(0.95); }
.tile:hover { border-color: rgba(168, 85, 247, 0.5); z-index: 2; }

.tile__band {
  height: 7px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
}
.tile--left .tile__band { height: 100%; width: 7px; border-bottom: none; border-right: 1px solid rgba(0, 0, 0, 0.3); position: absolute; right: 0; top: 0; }
.tile--right .tile__band { height: 100%; width: 7px; border-bottom: none; border-right: none; border-left: 1px solid rgba(0, 0, 0, 0.3); position: absolute; left: 0; top: 0; }
.tile--top .tile__band { position: absolute; bottom: 0; top: auto; left: 0; right: 0; border-bottom: none; border-top: 1px solid rgba(0, 0, 0, 0.3); }

.tile__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px;
  gap: 2px;
  text-align: center;
  min-width: 0;
}
.tile--left .tile__body { padding-right: 10px; }
.tile--right .tile__body { padding-left: 10px; }
.tile--top .tile__body { padding-bottom: 10px; }

.tile__icon {
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.4));
}
.tile__name {
  font-size: 9px;
  line-height: 1.1;
  color: var(--text);
  font-weight: 700;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.tile__price {
  font-size: 9px;
  color: var(--gold);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.tile--corner {
  background: linear-gradient(135deg, rgba(26, 34, 59, 0.9), rgba(16, 22, 40, 0.95));
}
.tile--corner .tile__icon { font-size: 20px; }

.tile--go {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.15));
}

.tile__owner {
  position: absolute;
  bottom: 2px;
  left: 2px;
  right: 2px;
  height: 3px;
  border-radius: 2px;
  box-shadow: 0 0 8px currentColor;
}
.tile--left .tile__owner { left: auto; right: 10px; top: 2px; bottom: 2px; width: 3px; height: auto; }
.tile--right .tile__owner { right: auto; left: 10px; top: 2px; bottom: 2px; width: 3px; height: auto; }
.tile--top .tile__owner { top: 2px; bottom: auto; }

.tile__houses, .tile__hotel {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 8px;
  line-height: 1;
  display: flex;
  gap: 1px;
}
.tile__mortgaged {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
  filter: grayscale(0.5) drop-shadow(0 0 4px rgba(239, 68, 68, 0.6));
}
.tile--owned.tile--street:has(.tile__mortgaged),
.tile--owned.tile--railroad:has(.tile__mortgaged),
.tile--owned.tile--utility:has(.tile__mortgaged) {
  opacity: 0.6;
  filter: grayscale(0.6);
}
</style>
