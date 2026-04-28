<script setup lang="ts">
// Parchment board — 40-tile perimeter on an 11x11 grid, inner 9x9 is the
// Mini-Poly emblem. Ported from design-ref/screens_game.vue.js → GameScreen
// board section (the inline BoardTile there is the visual reference;
// we keep our own BoardTile.vue because the outer shell + mortgage/house
// markers live there).
//
// Live-data bindings preserved:
//   • animatedPositions from the game store (for smooth hop animation)
//   • per-player hue from ORDERED_PLAYER_COLORS
//   • ownerIsFriend highlighting via game.isFriend()
//   • BoardTile click opens the TileInfoModal through game.selectTile()
//   • TokenArt for pieces, tinted by player colour
import { computed } from "vue";
import { BOARD } from "../../../shared/board";
import type { Player, RoomState } from "../../../shared/types";
import BoardTile from "./BoardTile.vue";
import { useGameStore } from "../stores/game";
import { ORDERED_PLAYER_COLORS, lighten } from "../utils/palette";
import { capTypeFor } from "../shop/cosmetics";

const props = defineProps<{ room: RoomState }>();
const game = useGameStore();

function gridPos(index: number): { row: number; col: number; side: "top" | "bottom" | "left" | "right" | "corner" } {
  if (index === 0) return { row: 10, col: 10, side: "corner" };
  if (index === 10) return { row: 10, col: 0, side: "corner" };
  if (index === 20) return { row: 0, col: 0, side: "corner" };
  if (index === 30) return { row: 0, col: 10, side: "corner" };
  if (index >= 1 && index <= 9) return { row: 10, col: 10 - index, side: "bottom" };
  if (index >= 11 && index <= 19) return { row: 20 - index, col: 0, side: "left" };
  if (index >= 21 && index <= 29) return { row: 0, col: index - 20, side: "top" };
  return { row: index - 30, col: 10, side: "right" };
}

/** Tile centre in % — 11x11 equal cells, half-step offset. */
function tileCenter(index: number): { xPct: number; yPct: number } {
  const { row, col } = gridPos(index);
  const step = 100 / 11;
  return {
    xPct: (col + 0.5) * step,
    yPct: (row + 0.5) * step,
  };
}

interface PositionedTile {
  tile: (typeof BOARD)[number];
  row: number;
  col: number;
  side: "top" | "bottom" | "left" | "right" | "corner";
}

const tiles = computed<PositionedTile[]>(() =>
  BOARD.map((tile) => {
    const p = gridPos(tile.index);
    return { tile, ...p };
  }),
);

/** Stable index of the player in room.players — used for deterministic colour. */
function playerIndex(p: Player): number {
  return props.room.players.findIndex((pp) => pp.id === p.id);
}
function playerHue(p: Player): string {
  const i = playerIndex(p);
  if (i < 0) return p.color;
  return ORDERED_PLAYER_COLORS[i % ORDERED_PLAYER_COLORS.length];
}

/** Owner-colour halo on a tile (null for unowned). */
function ownerHue(idx: number): string | null {
  const owned = props.room.properties[idx];
  if (!owned) return null;
  const owner = props.room.players.find((pp) => pp.id === owned.ownerId);
  if (!owner) return null;
  return playerHue(owner);
}

/** Is the owner of this tile a Telegram friend? — golden highlight if yes. */
function ownerIsFriend(idx: number): boolean {
  const owned = props.room.properties[idx];
  if (!owned) return false;
  const owner = props.room.players.find((pp) => pp.id === owned.ownerId);
  if (!owner) return false;
  return game.isFriend(owner.tgUserId);
}

interface PlacedPlayer {
  player: Player;
  color: string;
  xPct: number;
  yPct: number;
  offsetX: number;
  offsetY: number;
  isCurrent: boolean;
  isFriend: boolean;
}

/** GO tile центр — нужен для "+◈200"-взрыва при проходе круга. */
const goTileCenter = computed(() => tileCenter(0));

/** Позиция и цвет landing-шоквейва, если фишка только что приземлилась. */
const landedTileCenter = computed(() => {
  const lt = game.landedTile;
  return lt ? tileCenter(lt.tileIndex) : null;
});
const landedTileColor = computed(() => {
  const lt = game.landedTile;
  if (!lt) return "#d4a84a";
  const pl = props.room.players.find((p) => p.id === lt.playerId);
  return pl ? playerHue(pl) : "#d4a84a";
});

function positionOffset(idx: number, total: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0, dy: 0 };
  // 2 tokens — side-by-side horizontally (vertical stack squished them).
  if (total === 2) return { dx: idx === 0 ? -12 : 12, dy: 0 };
  // 3+ tokens — fan around the tile centre with a wider radius.
  const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
  const r = 14;
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
}

const currentPlayerId = computed(() => props.room.players[props.room.currentTurn]?.id ?? null);

function playerVisualPos(p: Player): number {
  const animated = game.animatedPositions?.[p.id];
  return animated !== undefined ? animated : p.position;
}

// Tokens grouped by tile, then fanned out around the tile centre.
const tokens = computed<PlacedPlayer[]>(() => {
  const byTile = new Map<number, Player[]>();
  for (const p of props.room.players) {
    if (p.bankrupt) continue;
    const pos = playerVisualPos(p);
    const arr = byTile.get(pos) ?? [];
    arr.push(p);
    byTile.set(pos, arr);
  }
  const out: PlacedPlayer[] = [];
  for (const [tileIdx, list] of byTile) {
    const { xPct, yPct } = tileCenter(tileIdx);
    list.forEach((player, i) => {
      const { dx, dy } = positionOffset(i, list.length);
      out.push({
        player,
        color: playerHue(player),
        xPct,
        yPct,
        offsetX: dx,
        offsetY: dy,
        isCurrent: player.id === currentPlayerId.value,
        isFriend: game.isFriend(player.tgUserId),
      });
    });
  }
  return out;
});

void lighten;
</script>

<template>
  <div class="board-wrap">
    <div class="board">
      <!-- ── Central area (inner 9x9) — stays blank. In the new Figma
           design the board centre is overlaid by the RoomView HUD
           (dice + turn banner + timer + budget), so we just paint a
           soft green wash here and let the parent render on top. ── -->
      <div class="board-center" aria-hidden="true"></div>

      <!-- ── 40 perimeter tiles ── -->
      <BoardTile
        v-for="t in tiles"
        :key="t.tile.index"
        :tile="t.tile"
        :side="t.side"
        :owned="room.properties[t.tile.index]"
        :owner="room.properties[t.tile.index] && room.players.find((p) => p.id === room.properties[t.tile.index].ownerId) || undefined"
        :owner-color="ownerHue(t.tile.index) ?? undefined"
        :owner-is-friend="ownerIsFriend(t.tile.index)"
        :style="{ gridRow: t.row + 1, gridColumn: t.col + 1 }"
      />

      <!-- ── Juice: landing impact (shockwave + color flash on tile) ── -->
      <div
        v-if="landedTileCenter"
        class="impact-layer"
        :key="game.landedTile?.ts"
      >
        <div
          class="impact-ring"
          :style="{
            left: `${landedTileCenter.xPct}%`,
            top: `${landedTileCenter.yPct}%`,
            '--impact-color': landedTileColor,
          }"
        />
        <div
          class="impact-flash"
          :style="{
            left: `${landedTileCenter.xPct}%`,
            top: `${landedTileCenter.yPct}%`,
            '--impact-color': landedTileColor,
          }"
        />
      </div>

      <!-- ── Juice: Pass GO burst — "+◈200" над GO-клеткой ── -->
      <div
        v-if="game.passedGo"
        class="passgo-layer"
        :key="`go-${game.passedGo.ts}`"
      >
        <div
          class="passgo-halo"
          :style="{ left: `${goTileCenter.xPct}%`, top: `${goTileCenter.yPct}%` }"
        />
        <div
          class="passgo-burst"
          :style="{ left: `${goTileCenter.xPct}%`, top: `${goTileCenter.yPct}%` }"
        >
          +◈200
        </div>
      </div>

      <!-- ── Tokens layer (absolute-positioned over the grid) ── -->
      <div class="tokens-layer">
        <template v-for="pt in tokens" :key="pt.player.id">
          <!-- Active-turn ring pulse -->
          <div
            v-if="pt.isCurrent"
            class="token-ring"
            :style="{
              left: `${pt.xPct}%`,
              top: `${pt.yPct}%`,
              '--ring-color': pt.color,
              transform: `translate(-50%, -50%) translate(${pt.offsetX}px, ${pt.offsetY}px)`,
            }"
          />
          <div
            :class="[
              'token',
              game.animatingPlayerId === pt.player.id && 'token--animating',
              pt.isCurrent && 'token--active',
              pt.isFriend && 'token--friend',
            ]"
            :style="{
              left: `${pt.xPct}%`,
              top: `${pt.yPct}%`,
              '--token-shadow': pt.color,
              transform: `translate(-50%, -50%) translate(${pt.offsetX}px, ${pt.offsetY}px)`,
            }"
            :title="pt.player.name"
          >
            <div class="token__base" :style="{ background: pt.color }" />
            <img
              class="token__cap"
              :src="`/figma/shop/caps/${capTypeFor(pt.player.token)}.webp`"
              :alt="pt.player.name"
              draggable="false"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  Board-wrap centres the square board inside the room view while letting
  the outer .room column keep its vertical padding.
*/
.board-wrap {
  padding: 4px 4px 8px;
  position: relative;
  z-index: 4;
}

.board {
  position: relative;
  aspect-ratio: 1/1;
  display: grid;
  /* Perimeter tiles get 1.4fr, inner 9 columns/rows stay 1fr — matches the
     classic Monopoly proportions where edge tiles are taller than the inner
     emblem is wide, without having to change the grid span of .board-center. */
  grid-template-columns: 1.4fr repeat(9, 1fr) 1.4fr;
  grid-template-rows: 1.4fr repeat(9, 1fr) 1.4fr;
  gap: 0;
  background: transparent;
  border-radius: 6px;
  padding: 0;
  overflow: visible;

  /* Fit within Telegram's safe area. */
  --safe-h: calc(
    var(--tg-viewport-stable-height, 100dvh)
    - var(--tg-safe-area-inset-top, 0px)
    - var(--tg-safe-area-inset-bottom, 0px)
    - var(--tg-content-safe-area-inset-top, 0px)
    - var(--tg-content-safe-area-inset-bottom, 0px)
  );
  --safe-w: calc(
    100vw
    - var(--tg-safe-area-inset-left, 0px)
    - var(--tg-safe-area-inset-right, 0px)
    - var(--tg-content-safe-area-inset-left, 0px)
    - var(--tg-content-safe-area-inset-right, 0px)
  );
  width: min(calc(var(--safe-w) - 12px), calc(var(--safe-h) - 300px), 760px);
  margin: 0 auto;
}

/* Inner 9x9 area — left blank; RoomView paints its HUD on top. */
.board-center {
  grid-column: 2 / 11;
  grid-row: 2 / 11;
  background: transparent;
  pointer-events: none;
}

/* ── Juice: landing impact ── */
.impact-layer, .passgo-layer {
  position: absolute;
  inset: 1px;
  pointer-events: none;
  z-index: 6;
}
.impact-ring {
  position: absolute;
  width: 9%;
  height: 9%;
  border: 2px solid var(--impact-color, #d4a84a);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: impact-ring 0.8s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
  box-shadow: 0 0 10px var(--impact-color, #d4a84a);
}
.impact-flash {
  position: absolute;
  width: 8%;
  height: 8%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--impact-color, #d4a84a) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  animation: impact-flash 0.65s ease-out forwards;
  mix-blend-mode: screen;
}
@keyframes impact-ring {
  0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 1; border-width: 3px; }
  100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; border-width: 1px; }
}
@keyframes impact-flash {
  0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
  35%  { transform: translate(-50%, -50%) scale(1.1); opacity: 0.85; }
  100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}

/* ── Juice: Pass GO burst ── */
.passgo-halo {
  position: absolute;
  width: 18%;
  height: 18%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 110, 0.7) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  animation: passgo-halo 1.1s ease-out forwards;
  mix-blend-mode: screen;
}
.passgo-burst {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(16px, 3.2vmin, 22px);
  color: #fff8da;
  text-shadow:
    0 0 10px #ffd86e,
    0 0 20px rgba(255, 216, 110, 0.7),
    0 2px 4px rgba(120, 80, 10, 0.5);
  white-space: nowrap;
  letter-spacing: 0.03em;
  animation: passgo-burst 1.1s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
  pointer-events: none;
  z-index: 9;
}
@keyframes passgo-halo {
  0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
  30%  { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
}
@keyframes passgo-burst {
  0%   { transform: translate(-50%, -40%) scale(0.4); opacity: 0; }
  20%  { transform: translate(-50%, -75%) scale(1.4); opacity: 1; }
  80%  { transform: translate(-50%, -140%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -190%) scale(0.85); opacity: 0; }
}

/* ── Tokens layer ── */
.tokens-layer {
  position: absolute;
  inset: 1px;
  pointer-events: none;
  z-index: 5;
}
.token {
  position: absolute;
  width: clamp(30px, 5.2vmin, 42px);
  height: clamp(30px, 5.2vmin, 42px);
  display: grid;
  place-items: end center;
  pointer-events: none;
  transition:
    left 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    top 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: left, top, transform;
}
/* Player-color "ground shadow" pinned to the bottom of the cell — gives
   instant player identification when several pieces share the same cap. */
.token__base {
  grid-row: 1;
  grid-column: 1;
  align-self: end;
  width: 70%;
  height: 18%;
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0.7;
  box-shadow:
    0 0 0 1px rgba(42, 29, 16, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.5);
}
.token__cap {
  grid-row: 1;
  grid-column: 1;
  width: 110%;
  height: 110%;
  object-fit: contain;
  align-self: stretch;
  justify-self: center;
  filter: drop-shadow(0 3px 4px rgba(42, 29, 16, 0.55));
  user-select: none;
  -webkit-user-drag: none;
}
.token--active { z-index: 7; }
.token--animating {
  animation: token-hop 0.18s ease-in-out;
  z-index: 8;
}
.token--animating .token__cap {
  filter:
    drop-shadow(0 3px 4px rgba(42, 29, 16, 0.55))
    drop-shadow(0 0 8px var(--token-shadow));
}
.token--friend .token__base {
  background: var(--gold-soft, #d4a84a) !important;
  opacity: 0.85;
}
@keyframes token-hop {
  0% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -62%) scale(1.18); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
.token-ring {
  position: absolute;
  width: clamp(38px, 6.4vmin, 52px);
  height: clamp(38px, 6.4vmin, 52px);
  border-radius: 50%;
  border: 2px solid var(--ring-color);
  opacity: 0.55;
  pointer-events: none;
  z-index: 4;
  animation: ring-pulse 1.6s ease-in-out infinite;
}
@keyframes ring-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.35); opacity: 0; }
}
</style>
