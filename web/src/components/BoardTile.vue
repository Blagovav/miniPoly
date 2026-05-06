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

// ── Figma-redesign assets (nodes 19:2781, 19:2783, 19:2880, 19:2888).
// The PNGs were downloaded with semantic-ish filenames that turned out
// not to match their actual artwork (Figma exported by image-id). Map
// to the real contents here:
//   tile-parking.png     = parking P sign + car  → Free Parking (index 20)
//   tile-jail.png        = metal bars            → Jail / Just Visiting (index 10)
//   tile-luxury.png      = brick "JAIL" building → Go-to-Jail (index 30)
//   tile-question.png    = treasure chest        → Community Chest
//   tile-chest2.png      = red-gold "?"          → Chance
//   tile-chest.png       = steam locomotive      → Railroads
//   tile-bag.png         = bound stack of 100s   → Tax
//   tile-money-stack.png = house + lightning bolt → Electric utility
//   tile-coin.png        = house + water drop    → Water utility
// Index 0 (GO) is rendered as a text label; no PNG in the Figma.
const CORNER_ART: Record<number, string> = {
  10: "/figma/room/tile-jail.webp",     // Jail / Just Visiting — metal bars (Figma 19:2783)
  20: "/figma/room/tile-parking.webp",  // Free Parking — P sign (Figma 19:2781)
  30: "/figma/room/tile-luxury.webp",   // Go-to-Jail — brick building (Figma 19:2880)
};

// Specials that show a PNG icon instead of a price label.
function specialArt(kind: string, index: number): string | null {
  switch (kind) {
    case "chance":   return "/figma/room/tile-chest2.webp";       // red ?
    case "chest":    return "/figma/room/tile-question.webp";     // chest
    // Tax: reuse the live money icon (PR #81) so the tile shows the
    // same sticker as the rest of the UI. tile-bag.webp is the legacy
    // green-dollar PNG and stayed behind during the icon refresh.
    case "tax":      return "/figma/room/icon-money.webp";
    case "railroad": return "/figma/room/tile-chest.webp";        // train
    case "utility":
      // Index 12 is the Electric Company, 28 is the Water Works.
      return index === 12
        ? "/figma/room/tile-money-stack.webp"
        : "/figma/room/tile-coin.webp";
    default: return null;
  }
}

const cornerArt = computed(() => CORNER_ART[props.tile.index] ?? null);
const kindArt = computed(() => specialArt(props.tile.kind, props.tile.index));
const isStartTile = computed(() => props.tile.index === 0);

// Outer-corner rounding — the 4 corner tiles each round ONLY their
// outward-facing corner so the perimeter reads as a single rounded rail
// (Figma nodes 19:2780/19:2782/19:2879/19:2888 — Rectangle54/55/74/75
// are all square PNGs with one rounded corner matching board orientation).
const cornerOrientClass = computed<string | null>(() => {
  switch (props.tile.index) {
    case 0:  return "corner-br"; // bottom-right, СТАРТ
    case 10: return "corner-bl"; // bottom-left, Jail
    case 20: return "corner-tl"; // top-left, Free Parking
    case 30: return "corner-tr"; // top-right, Go-to-Jail
    default: return null;
  }
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
// Price pill is shown for any "ownable" tile — streets, railroads
// and utilities all carry a cost in the Figma mockup.
const showPrice = computed(() =>
  props.tile.kind === "street"
  || props.tile.kind === "railroad"
  || props.tile.kind === "utility",
);
</script>

<template>
  <button
    type="button"
    :class="[
      'board-tile',
      props.side === 'corner' && 'corner',
      cornerOrientClass,
      `side-${props.side}`,
      `kind-${tile.kind}`,
      bandColor && 'has-band',
      owned && 'is-owned',
      ownerIsFriend && 'is-friend',
    ]"
    :style="{
      ...(ownerColor ? { '--owner-hue': ownerColor } : {}),
      ...(bandColor ? { '--band-color': bandColor } : {}),
    }"
    @click="open"
  >

    <!-- Owner stripe: mirrors the group band on the OUTER edge of the tile,
         a touch thinner so the two lines read as a pair without competing. -->
    <div v-if="owned" class="owner-band" />

    <!-- Per Figma node 13:1790, each tile is an absolute-positioned
         composition: corner tiles = full PNG; chance/chest/tax = big
         centred icon; railroad/utility = icon at outer edge + price
         pill at inner edge; street = just the centred price pill. -->
    <img
      v-if="cornerArt"
      :src="cornerArt"
      :alt="''"
      class="corner-art"
    />
    <div v-else-if="isStartTile" class="start-label">
      {{ loc === 'ru' ? 'СТАРТ' : 'START' }}
    </div>
    <img
      v-else-if="kindArt"
      :src="kindArt"
      :alt="''"
      class="kind-art"
    />
    <div v-if="showPrice && priceLabel !== null" class="price">{{ priceLabel }}</div>

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
/* ── New Figma-flat tile (nodes 19:2778 and family): white body,
   rgba(58,94,35,0.6) border, 6px inset colour strip on the inner
   edge; price is Unbounded Black 10px in #31581a. Exact values from
   the Figma export — don't relax the border / stripe to % here or
   the board stops matching the designer's comp at the pixel level. ── */
.board-tile {
  background: #fff;
  border: 1px solid rgba(58, 94, 35, 0.6);
  /* Edge/side tiles sit flush; only the 4 corner tiles round their
     outer-facing corner (corner-tl/tr/bl/br below) so the overall
     perimeter reads as a single rounded rail. */
  border-radius: 0;
  position: relative;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  font-family: 'Unbounded', sans-serif;
  color: #31581a;
  display: flex;
  font-size: 10px;
  min-width: 0;
  min-height: 0;
  transition: background 0.15s ease, transform 0.1s ease;
}
.board-tile:hover { background: #f7fff0; }
.board-tile:active { transform: scale(0.97); }

/* Corner plate: only the OUTER corner is rounded — grid indices:
   0=bottom-right, 10=bottom-left, 20=top-left, 30=top-right. Figma
   nodes 19:2780/2782/2879/2888 use ~12px radius at the 44px tile
   size; `clamp` keeps the corner readable when the board scales. */
.board-tile.corner {
  background: #fff;
  border: 1px solid rgba(58, 94, 35, 0.6);
}
.board-tile.corner-tl { border-top-left-radius: clamp(8px, 1.8vmin, 14px); }
.board-tile.corner-tr { border-top-right-radius: clamp(8px, 1.8vmin, 14px); }
.board-tile.corner-bl { border-bottom-left-radius: clamp(8px, 1.8vmin, 14px); }
.board-tile.corner-br { border-bottom-right-radius: clamp(8px, 1.8vmin, 14px); }
.start-label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: clamp(7px, 1.4vmin, 11px);
  line-height: 1;
  color: #000;
  text-align: center;
  letter-spacing: 0.02em;
}

/* Ownership stripe: thin line on the OUTER edge in owner's hue. */
.owner-band {
  position: absolute;
  background: var(--owner-hue, #5a3a9a);
  z-index: 0;
}
.board-tile.side-bottom .owner-band { bottom: 0; left: 0; right: 0; height: 8%; }
.board-tile.side-top    .owner-band { top: 0;    left: 0; right: 0; height: 8%; }
.board-tile.side-left   .owner-band { top: 0; left: 0; bottom: 0; width: 8%; }
.board-tile.side-right  .owner-band { top: 0; right: 0; bottom: 0; width: 8%; }
.board-tile.is-owned.is-friend .owner-band {
  box-shadow: 0 0 0 1.5px #d4a84a;
}

/* Group-colour strip on INNER edge. Implemented as a 6px inset
   box-shadow on the tile itself (matches Figma rect 13:1878 which
   uses `shadow-[inset_0px_-6px_0px_0px_#dc2626]`). The band div is
   only a coloured pass-through so `bandColor` becomes the shadow
   colour via CSS custom property. */
.band {
  display: none;
}
.board-tile[style*="--band"] { }  /* reset */
.board-tile.side-bottom.has-band { box-shadow: inset 0 6px 0 0 var(--band-color); }
.board-tile.side-top.has-band    { box-shadow: inset 0 -6px 0 0 var(--band-color); }
.board-tile.side-left.has-band   { box-shadow: inset -6px 0 0 0 var(--band-color); }
.board-tile.side-right.has-band  { box-shadow: inset 6px 0 0 0 var(--band-color); }

/* ─── Absolute-positioned pieces (no flex body wrapper) ─── */

/* Corner tile: full PNG fills the tile. */
.corner-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

/* Start tile (index 0): small text label, no PNG. */
.start-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: clamp(7px, 1.4vmin, 11px);
  color: #000;
}

/* Kind art (chance / chest / tax / railroad / utility). Default =
   centred (used for chance, chest, tax where there's no price pill). */
.kind-art {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  height: 90%;
  object-fit: contain;
  pointer-events: none;
}
/* For tiles that ALSO show a price (railroad / utility), push the
   icon to the OUTER edge so the pill has room on the INNER edge. */
.board-tile.kind-railroad.side-top .kind-art,
.board-tile.kind-utility.side-top .kind-art {
  top: 30%; height: 70%; width: 90%;
}
.board-tile.kind-railroad.side-bottom .kind-art,
.board-tile.kind-utility.side-bottom .kind-art {
  top: 70%; height: 70%; width: 90%;
}
.board-tile.kind-railroad.side-left .kind-art,
.board-tile.kind-utility.side-left .kind-art {
  left: 30%; width: 70%; height: 90%;
}
.board-tile.kind-railroad.side-right .kind-art,
.board-tile.kind-utility.side-right .kind-art {
  left: 70%; width: 70%; height: 90%;
}

/* Price — Figma node 19:2778: Unbounded Black 10px text in #31581a,
   centered in the tile. No pill, no background. Designer feedback
   2026-05-02 #5.3 — bumped clamp ceiling 10 → 12 + min 8 → 9 so the
   number reads at the larger Telegram viewports without forcing big
   tiles to a tiny 8px floor. */
.price {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: clamp(9px, 1.4vmin, 12px);
  line-height: 12px;
  color: #31581a;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  white-space: nowrap;
  z-index: 2;
}
/* Railroad / utility tiles: price anchors near the INNER edge so
   the icon has room on the outer side of the tile. */
.board-tile.kind-railroad.side-top .price,
.board-tile.kind-utility.side-top .price {
  top: auto; bottom: 3px;
  transform: translate(-50%, 0);
}
.board-tile.kind-railroad.side-bottom .price,
.board-tile.kind-utility.side-bottom .price {
  top: 3px;
  transform: translate(-50%, 0);
}
.board-tile.kind-railroad.side-left .price,
.board-tile.kind-utility.side-left .price {
  left: auto; right: 3px;
  transform: translate(0, -50%);
}
.board-tile.kind-railroad.side-right .price,
.board-tile.kind-utility.side-right .price {
  left: 3px;
  transform: translate(0, -50%);
}

/* ─── Overlays: mortgage, houses, hotel ─── */
.mortgage {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 9px;
  line-height: 1;
  opacity: 0.9;
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
  color: #2d7a4f;
  font-size: 8px;
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.9);
}
.hotel {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  line-height: 1;
  z-index: 2;
}
</style>
