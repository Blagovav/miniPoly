<script setup lang="ts">
// Ported 1:1 from the GameScreen action-bar in design-ref/screens_game.vue.js.
// HUD covers: turn banner (mirrors GameScreen's PlayerPill-active state),
// current-tile card, dice-pair + phase-aware primary action, and the
// me-card stats. All handlers come in as props from RoomView — we keep
// every phase button (rolling / buyPrompt / action / triplesPick) the
// game engine emits.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RoomState, Player } from "../../../shared/types";
import { BOARD } from "../../../shared/board";
import { useGameStore } from "../stores/game";
import Dice from "./Dice.vue";
import Icon from "./Icon.vue";

const props = defineProps<{
  room: RoomState;
  me: Player | null;
  current: Player | null;
  isMyTurn: boolean;
  rolling: boolean;
  onRoll: () => void;
  onBuy: () => void;
  onSkipBuy: () => void;
  onEndTurn: () => void;
  onOpenCardHistory?: () => void;
}>();

const { t, locale } = useI18n();
const game = useGameStore();

// Hide action buttons while a token is animating across the board.
const animating = computed(() => game.animatingPlayerId !== null || props.rolling);

const currentTile = computed(() =>
  props.current ? BOARD[props.current.position] : null,
);
const currentTilePrice = computed(() => {
  const tile = currentTile.value;
  if (!tile) return 0;
  if (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility") return tile.price;
  return 0;
});

const myPropertyCount = computed(() => {
  if (!props.me) return 0;
  return Object.values(props.room.properties).filter((p) => p.ownerId === props.me!.id).length;
});

function openCurrentTile() {
  if (currentTile.value) game.selectTile(currentTile.value.index);
}
</script>

<template>
  <div class="hud">
    <!-- ── Turn banner ────────────────────────────────────── -->
    <div :class="['turn-banner', isMyTurn && 'turn-banner--mine']">
      <div class="turn-banner__dot" :style="{ background: current?.color }" />
      <div class="turn-banner__text">
        <template v-if="isMyTurn">{{ t("game.yourTurn") }}</template>
        <template v-else-if="current">{{ t("game.turnOf", { name: current.name }) }}</template>
      </div>
      <div v-if="current?.inJail" class="chip jail-chip">
        <Icon name="lock" :size="12" color="var(--accent)" />
        <span>{{ t("game.inJail") }}</span>
      </div>
      <button
        v-if="onOpenCardHistory && (room.cardHistory?.length ?? 0) > 0"
        class="history-btn"
        :title="locale === 'ru' ? 'История карт' : 'Card history'"
        @click="onOpenCardHistory"
      >
        <Icon name="scroll" :size="16" color="var(--ink-2)" />
        <span class="history-btn__badge">{{ room.cardHistory.length }}</span>
      </button>
    </div>

    <!-- ── Current-tile card (click to open full info) ───── -->
    <button
      v-if="currentTile && room.phase !== 'lobby' && room.phase !== 'ended'"
      class="tile-card card"
      @click="openCurrentTile"
    >
      <div class="tile-card__name">{{ currentTile.name[locale as "en" | "ru"] }}</div>
      <div class="tile-card__right">
        <span v-if="currentTilePrice" class="tile-card__price">◈ {{ currentTilePrice }}</span>
        <span class="tile-card__info">ⓘ</span>
      </div>
    </button>

    <!-- ── Action bar (dice + phase-aware primary action) ── -->
    <div class="action-bar">
      <div class="dice-pair">
        <Dice :dice="room.dice" :speed-die="room.speedDie" :rolling="rolling" />
      </div>
      <div class="action-slot">
        <div v-if="animating" class="hint-card hint-card--active">
          {{ locale === 'ru' ? 'Фишка двигается…' : 'Moving…' }}
        </div>
        <template v-else-if="isMyTurn && room.phase === 'rolling'">
          <button class="btn btn-primary big" @click="onRoll">
            <Icon name="dice" :size="16" color="#fff" />
            <span>{{ t("game.roll") }}</span>
          </button>
        </template>
        <template v-else-if="isMyTurn && room.phase === 'buyPrompt'">
          <button class="btn btn-emerald big" @click="onBuy">
            {{ t("game.buy", { price: currentTilePrice }) }}
          </button>
          <button class="btn btn-ghost" @click="onSkipBuy">
            {{ t("game.skip") }}
          </button>
        </template>
        <template v-else-if="isMyTurn && room.phase === 'action'">
          <button class="btn btn-primary big" @click="onEndTurn">
            <Icon name="check" :size="16" color="#fff" />
            <span>{{ t("game.endTurn") }}</span>
          </button>
        </template>
        <div v-else-if="isMyTurn && room.phase === 'triplesPick'" class="hint-card hint-card--active">
          {{ locale === 'ru' ? 'Тапни клетку — телепорт туда' : 'Tap a tile to teleport' }}
        </div>
        <div v-else class="hint-card">
          {{ t("game.closeMinimize") }}
        </div>
      </div>
    </div>

    <!-- ── Me stats (cash + properties + jail key) ──────── -->
    <div v-if="me" class="me-card card">
      <div class="me-card__row">
        <span class="me-card__label">{{ t("game.cash") }}</span>
        <span class="me-card__cash">◈ {{ me.cash }}</span>
      </div>
      <div class="me-card__row">
        <span class="me-card__label">{{ t("game.properties") }}</span>
        <span class="me-card__val">{{ myPropertyCount }}</span>
      </div>
      <div v-if="me.getOutCards > 0" class="me-card__row">
        <span class="me-card__label">
          <Icon name="key" :size="12" color="var(--ink-3)" />
          <span>{{ locale === 'ru' ? 'Ключ от темницы' : 'Jail key' }}</span>
        </span>
        <span class="me-card__val">{{ me.getOutCards }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  HUD occupies the space between board and bottom safe-area. Stays flat
  instead of becoming a sticky footer so it composes with overlays.
*/
.hud {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px 14px;
  position: relative;
  z-index: 4;
}

/* ── Turn banner ── */
.turn-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.turn-banner--mine {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), 0 2px 8px rgba(90, 58, 154, 0.18);
  animation: turn-glow 2s ease-in-out infinite;
}
@keyframes turn-glow {
  0%, 100% { box-shadow: 0 0 0 1px var(--primary), 0 2px 8px rgba(90, 58, 154, 0.18); }
  50% { box-shadow: 0 0 0 1px var(--primary), 0 2px 16px rgba(90, 58, 154, 0.35); }
}
.turn-banner__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}
.turn-banner__text {
  flex: 1;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 14px;
  color: var(--ink);
}
.jail-chip {
  background: rgba(139, 26, 26, 0.08);
  color: var(--accent);
  border-color: rgba(139, 26, 26, 0.3);
}
.history-btn {
  position: relative;
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--card-alt);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.history-btn:hover { background: #fff9e4; }
.history-btn:active { transform: scale(0.95); }
.history-btn__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold));
  color: #fff;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  line-height: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

/* ── Current-tile card ── */
.tile-card {
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  cursor: pointer;
  text-align: left;
  transition: background 120ms, border-color 120ms;
  font-family: var(--font-body);
  color: var(--ink);
}
.tile-card:active { transform: translateY(1px); }
.tile-card:hover { background: var(--card-alt); border-color: var(--line-strong); }
.tile-card__name {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
}
.tile-card__right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tile-card__price {
  color: var(--gold);
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.tile-card__info {
  font-size: 16px;
  color: var(--primary);
  line-height: 1;
}

/* ── Action bar ── */
.action-bar {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
}
.dice-pair {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.action-slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.action-slot .btn {
  width: 100%;
}
.big {
  padding: 12px 14px;
  font-size: 14px;
}
.hint-card {
  padding: 10px 14px;
  background: var(--card-alt);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  font-size: 12px;
  color: var(--ink-3);
  text-align: center;
  font-family: var(--font-body);
}
.hint-card--active {
  background: rgba(184, 137, 46, 0.08);
  border-color: rgba(184, 137, 46, 0.35);
  color: var(--ink-2);
  font-weight: 500;
  animation: hint-pulse 1.4s ease-in-out infinite;
}
@keyframes hint-pulse {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; }
}

/* ── Me-card ── */
.me-card {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.me-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.me-card__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 500;
}
.me-card__cash {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--gold);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.me-card__val {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
}
</style>
