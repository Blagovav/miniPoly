<script setup lang="ts">
import { computed } from "vue";
import { BOARD } from "../../../shared/board";
import type { Player, RoomState } from "../../../shared/types";
import BoardTile from "./BoardTile.vue";
import { SHOP_ITEMS } from "../shop/items";
import { useGameStore } from "../stores/game";

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

/** Центр клетки в процентах от размера доски (11x11 grid: corners 1.4fr, middle 1fr). */
function tileCenter(index: number): { xPct: number; yPct: number } {
  const { row, col } = gridPos(index);
  const total = 11.8;
  const centerOf = (i: number) => {
    if (i === 0) return 0.7;
    if (i === 10) return 1.4 + 9 + 0.7;
    return 1.4 + (i - 1) + 0.5;
  };
  return { xPct: (centerOf(col) / total) * 100, yPct: (centerOf(row) / total) * 100 };
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

function tokenIcon(p: Player): string {
  if (p.token) return SHOP_ITEMS.find((i) => i.id === p.token)?.icon ?? "●";
  return p.name.slice(0, 1).toUpperCase();
}

interface PlacedPlayer {
  player: Player;
  xPct: number;
  yPct: number;
  offsetX: number;
  offsetY: number;
  isCurrent: boolean;
}

function positionOffset(idx: number, total: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0, dy: 0 };
  const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
  const r = 12;
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
}

const currentPlayerId = computed(() => props.room.players[props.room.currentTurn]?.id ?? null);

function playerVisualPos(p: Player): number {
  const animated = game.animatedPositions?.[p.id];
  return animated !== undefined ? animated : p.position;
}

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
        player, xPct, yPct,
        offsetX: dx, offsetY: dy,
        isCurrent: player.id === currentPlayerId.value,
      });
    });
  }
  return out;
});
</script>

<template>
  <div class="board">
    <div class="board__center">
      <div class="board__logo">
        <div class="board__title">MINIPOLY</div>
        <div class="board__subtitle">MONOPOLY · SPEED DIE</div>
      </div>
    </div>

    <BoardTile
      v-for="t in tiles"
      :key="t.tile.index"
      class="board__tile"
      :tile="t.tile"
      :side="t.side"
      :owned="room.properties[t.tile.index]"
      :owner="room.properties[t.tile.index] && room.players.find((p) => p.id === room.properties[t.tile.index].ownerId) || undefined"
      :style="{ gridRow: t.row + 1, gridColumn: t.col + 1 }"
    />

    <div class="tokens-layer">
      <template v-for="pt in tokens" :key="pt.player.id">
        <div
          v-if="pt.isCurrent"
          class="token-ring"
          :style="{
            left: `${pt.xPct}%`,
            top: `${pt.yPct}%`,
            '--ring-color': pt.player.color,
            transform: `translate(-50%, -50%) translate(${pt.offsetX}px, ${pt.offsetY}px)`,
          }"
        />
        <div
          :class="[
            'token',
            game.animatingPlayerId === pt.player.id && 'token--animating',
            pt.isCurrent && 'token--active',
          ]"
          :style="{
            left: `${pt.xPct}%`,
            top: `${pt.yPct}%`,
            background: pt.player.color,
            transform: `translate(-50%, -50%) translate(${pt.offsetX}px, ${pt.offsetY}px)`,
          }"
          :title="pt.player.name"
        >
          <span class="token__icon">{{ tokenIcon(pt.player) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: 1.4fr repeat(9, 1fr) 1.4fr;
  grid-template-rows: 1.4fr repeat(9, 1fr) 1.4fr;
  gap: 2px;
  aspect-ratio: 1 / 1;
  /* Учитываем Telegram safe-area и реальную высоту вьюпорта Mini App. */
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
  background: radial-gradient(
    circle at center,
    var(--board-from, rgba(22, 28, 45, 0.9)),
    var(--board-to, rgba(5, 7, 15, 0.95))
  );
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  padding: 6px;
  box-shadow:
    inset 0 0 60px var(--center-glow, rgba(168, 85, 247, 0.08)),
    0 20px 60px -20px rgba(0, 0, 0, 0.6);
  position: relative;
  transition: background 0.4s ease, box-shadow 0.4s ease;
}
.board__center {
  grid-row: 2 / 11;
  grid-column: 2 / 11;
  display: grid;
  place-items: center;
  background:
    radial-gradient(ellipse at center, var(--center-glow, rgba(168, 85, 247, 0.08)), transparent 70%),
    repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.03) 0 12px, transparent 12px 24px);
  border-radius: 10px;
  pointer-events: none;
  transition: background 0.4s ease;
}
.board__logo {
  text-align: center;
  transform: rotate(-45deg);
}
.board__title {
  font-size: clamp(14px, 4vmin, 28px);
  font-weight: 900;
  letter-spacing: 0.15em;
  background: linear-gradient(135deg, var(--gold), #fff, var(--purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.board__subtitle {
  font-size: clamp(8px, 1.6vmin, 11px);
  color: var(--text-mute);
  letter-spacing: 0.25em;
  margin-top: 4px;
}

.tokens-layer {
  position: absolute;
  inset: 6px;
  pointer-events: none;
  z-index: 5;
}
.token {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.55),
    0 0 0 3px rgba(255, 255, 255, 0.1),
    0 6px 14px rgba(0, 0, 0, 0.55),
    inset 0 2px 0 rgba(255, 255, 255, 0.45),
    inset 0 -2px 0 rgba(0, 0, 0, 0.2);
  transition: left 0.18s cubic-bezier(0.4, 0, 0.2, 1),
              top 0.18s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: left, top, transform;
}
.token__icon {
  font-size: 18px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.token--active {
  z-index: 7;
}
.token--animating {
  animation: token-hop 0.18s ease-in-out;
  z-index: 8;
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.5),
    0 0 22px currentColor,
    0 8px 18px rgba(0, 0, 0, 0.55),
    inset 0 2px 0 rgba(255, 255, 255, 0.5);
}
@keyframes token-hop {
  0% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -62%) scale(1.18); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
.token-ring {
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--ring-color);
  opacity: 0.5;
  pointer-events: none;
  z-index: 4;
  animation: ring-pulse 1.6s ease-in-out infinite;
}
@keyframes ring-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.35); opacity: 0; }
}
</style>
