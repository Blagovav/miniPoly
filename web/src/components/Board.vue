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
import { ORDERED_PLAYER_COLORS, tokenArtFor, lighten } from "../utils/palette";
import TokenArt from "./TokenArt.vue";

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
      <!-- ── Central emblem (inner 9x9) ── -->
      <div class="board-center">
        <div class="board-center__stack">
          <svg viewBox="0 0 80 40" class="board-center__crown" aria-hidden="true">
            <path d="M5 30 L12 10 L25 22 L40 5 L55 22 L68 10 L75 30 Z" fill="currentColor"/>
            <circle cx="12" cy="10" r="2" fill="currentColor"/>
            <circle cx="40" cy="5" r="2" fill="currentColor"/>
            <circle cx="68" cy="10" r="2" fill="currentColor"/>
          </svg>
          <div class="board-center__title">MINI·POLY</div>
          <div class="board-center__sub">— ❦ —</div>
        </div>
        <!-- Decorative shields (heraldic, no interaction) -->
        <div class="board-center__shield board-center__shield--wax" aria-hidden="true">
          <div class="board-center__shield-inner" />
        </div>
        <div class="board-center__shield board-center__shield--plum" aria-hidden="true">
          <div class="board-center__shield-inner board-center__shield-inner--star">✦</div>
        </div>
      </div>

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
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.45), ${pt.color} 70%)`,
              color: pt.color,
              transform: `translate(-50%, -50%) translate(${pt.offsetX}px, ${pt.offsetY}px)`,
            }"
            :title="pt.player.name"
          >
            <TokenArt
              :id="tokenArtFor(pt.player.token || pt.player.id)"
              :size="18"
              color="#fff"
              :shadow="pt.color"
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
  gap: 1px;
  background: var(--ink-2);
  border-radius: 6px;
  padding: 1px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);

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

/* Inner 9x9 emblem */
.board-center {
  grid-column: 2 / 11;
  grid-row: 2 / 11;
  background:
    repeating-linear-gradient(45deg, transparent 0 8px, rgba(180, 140, 80, 0.07) 8px 9px),
    linear-gradient(145deg, var(--card-alt), var(--bg-deep));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
  pointer-events: none;
  color: var(--gold);
  gap: 6px;
  padding: 12px;
}
.board-center__stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.board-center__crown {
  width: clamp(44px, 14%, 96px);
  opacity: 0.8;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.15));
}
.board-center__title {
  font-family: var(--font-title);
  font-size: clamp(14px, 3.4vmin, 26px);
  letter-spacing: 0.22em;
  color: var(--primary);
  text-transform: uppercase;
  text-shadow: 0 1px 0 rgba(247, 238, 218, 0.6);
}
.board-center__sub {
  font-family: var(--font-display);
  font-size: clamp(8px, 1.4vmin, 11px);
  letter-spacing: 0.28em;
  color: var(--ink-3);
  margin-top: 2px;
}

/* Decorative tilted shields (from design-ref) */
.board-center__shield {
  position: absolute;
  border-radius: 2px;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
.board-center__shield--wax {
  top: 18%;
  right: 14%;
  width: clamp(26px, 5.2vmin, 40px);
  height: clamp(18px, 3.8vmin, 28px);
  background: linear-gradient(135deg, #8b1a1a, #6a1212);
  border: 1px solid #4a0e0e;
  transform: rotate(-12deg);
}
.board-center__shield--plum {
  bottom: 22%;
  left: 18%;
  width: clamp(24px, 4.8vmin, 36px);
  height: clamp(16px, 3.5vmin, 26px);
  background: linear-gradient(135deg, #3e2272, #2d1a5a);
  border: 1px solid #1a0e3a;
  transform: rotate(14deg);
}
.board-center__shield-inner {
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(212, 168, 74, 0.5);
  border-radius: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(212, 168, 74, 0.8);
  font-size: clamp(8px, 1.6vmin, 12px);
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
  width: clamp(18px, 3.2vmin, 26px);
  height: clamp(18px, 3.2vmin, 26px);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  box-shadow:
    0 0 0 1px rgba(42, 29, 16, 0.55),
    0 0 0 2px rgba(247, 238, 218, 0.9),
    0 4px 10px rgba(42, 29, 16, 0.45),
    inset 0 1px 1px rgba(255, 255, 255, 0.4),
    inset 0 -1px 1px rgba(0, 0, 0, 0.2);
  transition:
    left 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    top 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: left, top, transform;
}
.token--active { z-index: 7; }
.token--animating {
  animation: token-hop 0.18s ease-in-out;
  z-index: 8;
  box-shadow:
    0 0 0 1px rgba(42, 29, 16, 0.55),
    0 0 0 2px #f7eeda,
    0 0 16px currentColor,
    0 6px 14px rgba(42, 29, 16, 0.5),
    inset 0 1px 1px rgba(255, 255, 255, 0.5);
}
.token--friend {
  box-shadow:
    0 0 0 1px rgba(42, 29, 16, 0.55),
    0 0 0 2px var(--gold-soft, #d4a84a),
    0 4px 10px rgba(42, 29, 16, 0.45),
    inset 0 1px 1px rgba(255, 255, 255, 0.4),
    inset 0 -1px 1px rgba(0, 0, 0, 0.2);
}
@keyframes token-hop {
  0% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -62%) scale(1.18); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
.token-ring {
  position: absolute;
  width: clamp(26px, 4.8vmin, 38px);
  height: clamp(26px, 4.8vmin, 38px);
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
