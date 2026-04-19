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
  ownerColor?: string;
  ownerIsFriend?: boolean;
}>();

const game = useGameStore();
function open() {
  game.selectTile(props.tile.index);
}

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));

/** Пастельный цвет группы в manifest-шаблоне medieval. */
const bandColor = computed(() => {
  if (props.tile.kind === "street") return GROUP_COLORS[props.tile.group];
  return null;
});

// Icon per tile — used sparingly, mainly for corners and special tiles.
const STREET_ICONS: Record<number, string> = {
  1: "🏖️", 3: "🌊",
  6: "🏛️", 8: "🏰", 9: "⛲",
  11: "🎭", 13: "🎨", 14: "🎪",
  16: "🚢", 18: "🎸", 19: "🗽",
  21: "🏇", 23: "🏟️", 24: "🎰",
  26: "🏝️", 27: "🎡", 29: "🌴",
  31: "🌉", 32: "🌁", 34: "🗿",
  37: "🏙️", 39: "🎆",
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
      return STREET_ICONS[t.index] ?? null;
    default:
      return null;
  }
});

const showIcon = computed(() => props.side === "corner" || props.tile.kind !== "street");

/** Короткое название для corner-клеток и спец-клеток, многострочно. */
const short = computed(() => {
  const t = props.tile;
  if (t.kind === "street" || t.kind === "railroad" || t.kind === "utility") return "";
  const full = t.name[loc.value];
  if (full.length < 16) return full;
  // Stripped for compactness.
  return full.split(" ").slice(0, 2).join(" ");
});

const priceLabel = computed(() => {
  if (
    props.tile.kind === "street"
    || props.tile.kind === "railroad"
    || props.tile.kind === "utility"
  ) {
    return props.tile.price;
  }
  return null;
});
</script>

<template>
  <button
    type="button"
    :class="[
      'board-tile',
      props.side === 'corner' && 'corner',
      `side-${props.side}`,
      `kind-${tile.kind}`,
      owned && 'is-owned',
      ownerIsFriend && 'is-friend',
    ]"
    :style="ownerColor ? { '--owner-hue': ownerColor } : undefined"
    @click="open"
  >
    <!-- Group-color strip (streets only): sits on the inner edge so the
         coloured band faces the middle of the board. -->
    <div
      v-if="bandColor"
      class="band"
      :style="{ background: bandColor }"
    />

    <!-- Owner stripe: mirrors the group band on the OUTER edge of the tile,
         a touch thinner so the two lines read as a pair without competing. -->
    <div v-if="owned" class="owner-band" />

    <!-- Tile body: icon (optional), name, price. Oriented per side so that
         text on side rows reads sideways like a real Monopoly board. -->
    <div class="body">
      <div v-if="showIcon && tileIcon" class="icon">{{ tileIcon }}</div>
      <div v-if="short" class="name">{{ short }}</div>
      <div v-if="priceLabel !== null" class="price">◈ {{ priceLabel }}</div>
    </div>

    <!-- Mortgage padlock -->
    <div v-if="owned && owned.mortgaged" class="mortgage" aria-label="Mortgaged">🔒</div>

    <!-- House / hotel markers -->
    <div v-if="owned && owned.hotel" class="hotel" aria-label="Hotel">🏨</div>
    <div v-else-if="owned && owned.houses > 0" class="houses">
      <span v-for="n in owned.houses" :key="n" class="house">▲</span>
    </div>
  </button>
</template>

<style scoped>
/* Base parchment tile. Matches .board-tile from design reference. */
.board-tile {
  background: var(--card-alt);
  position: relative;
  overflow: hidden;
  padding: 0;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  color: var(--ink);
  display: flex;
  font-size: 8px;
  min-width: 0;
  min-height: 0;
  transition: background 0.15s ease, box-shadow 0.2s ease, transform 0.1s ease;
}
.board-tile:hover { background: #fff9e4; }
.board-tile:active { transform: scale(0.98); }

/* Corner plate: softer gradient, parchment into deep. */
.board-tile.corner {
  background: linear-gradient(145deg, var(--card), var(--bg-deep));
}

/* Ownership stripe — thin line on the OUTER edge, coloured with the
   owner's hue. Mirrors the group-colour band on the inner edge. */
.owner-band {
  position: absolute;
  background: var(--owner-hue, var(--primary));
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  z-index: 0;
}
/* Bottom row: owner stripe on the bottom (outer) edge. */
.board-tile.side-bottom .owner-band {
  bottom: 0; left: 0; right: 0;
  height: 10%;
}
/* Top row: owner stripe on the top (outer) edge. */
.board-tile.side-top .owner-band {
  top: 0; left: 0; right: 0;
  height: 10%;
}
/* Left column: owner stripe on the left (outer) edge. */
.board-tile.side-left .owner-band {
  top: 0; left: 0; bottom: 0;
  width: 10%;
}
/* Right column: owner stripe on the right (outer) edge. */
.board-tile.side-right .owner-band {
  top: 0; right: 0; bottom: 0;
  width: 10%;
}
/* Friend (Telegram co-player): gold halo around the stripe so it's
   still easy to spot without overriding the owner's hue. */
.board-tile.is-owned.is-friend .owner-band {
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.2),
    0 0 0 1.5px var(--gold-soft, #d4a84a);
}

/* ─── Group-colour strip. Always rides the INNER edge of the tile ─── */
.band {
  position: absolute;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.22);
}
/* Bottom row: strip along the top (which is inside) */
.board-tile.side-bottom .band {
  top: 0;
  left: 0;
  right: 0;
  height: 18%;
}
/* Top row: strip along the bottom (inside) */
.board-tile.side-top .band {
  bottom: 0;
  left: 0;
  right: 0;
  height: 18%;
}
/* Left column: strip along the right side (inside) */
.board-tile.side-left .band {
  top: 0;
  right: 0;
  bottom: 0;
  width: 18%;
}
/* Right column: strip along the left side (inside) */
.board-tile.side-right .band {
  top: 0;
  left: 0;
  bottom: 0;
  width: 18%;
}

/* ─── Body layout per side: push text to the OUTER edge ─── */
.body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  text-align: center;
  padding: 3px;
  min-width: 0;
  min-height: 0;
}
.board-tile.side-bottom .body { padding-top: 22%; }
.board-tile.side-top    .body { padding-bottom: 22%; }
.board-tile.side-left   .body { padding-right: 22%; }
.board-tile.side-right  .body { padding-left: 22%; }

/* Side rows rotate so the name reads from outside. */
.board-tile.side-left .body,
.board-tile.side-right .body {
  flex-direction: row;
}

/* ─── Pieces ─── */
.icon {
  font-size: clamp(10px, 1.8vmin, 15px);
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(42, 29, 16, 0.25));
}
.board-tile.corner .icon {
  font-size: clamp(14px, 2.6vmin, 22px);
}
.name {
  font-family: var(--font-body);
  font-size: clamp(6.5px, 1vmin, 9px);
  line-height: 1.05;
  color: var(--ink);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.board-tile.corner .name {
  font-family: var(--font-title);
  font-size: clamp(7.5px, 1.2vmin, 11px);
  letter-spacing: 0.14em;
  color: var(--primary);
}
.price {
  font-family: var(--font-mono);
  font-size: clamp(7px, 1vmin, 9px);
  color: var(--gold);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

/* ─── Overlays: mortgage, houses, hotel ─── */
.mortgage {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 9px;
  line-height: 1;
  opacity: 0.9;
  filter: drop-shadow(0 0 2px rgba(139, 26, 26, 0.6));
  z-index: 2;
}
.board-tile.is-owned:has(.mortgage) {
  opacity: 0.6;
  filter: grayscale(0.55);
}
.houses {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 1px;
  line-height: 1;
  z-index: 2;
  color: var(--emerald, #2d7a4f);
  font-size: 8px;
  text-shadow: 0 0 2px rgba(247, 238, 218, 0.7);
}
.hotel {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  line-height: 1;
  z-index: 2;
  filter: drop-shadow(0 0 2px rgba(247, 238, 218, 0.8));
}

/* Special tiles: gentle parchment tints to hint at their type. */
.board-tile.kind-go {
  background: linear-gradient(145deg, #f0e4c8, #e5d5a8);
}
.board-tile.kind-chance,
.board-tile.kind-chest {
  background: linear-gradient(145deg, var(--card-alt), #f4e7c4);
}
.board-tile.kind-tax {
  background: linear-gradient(145deg, var(--card-alt), #f0dcd0);
}
</style>
