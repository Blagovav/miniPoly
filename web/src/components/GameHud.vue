<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RoomState, Player } from "../../../shared/types";
import { BOARD } from "../../../shared/board";
import { useGameStore } from "../stores/game";
import Dice from "./Dice.vue";

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
}>();

const { t, locale } = useI18n();
const game = useGameStore();

// Пока фишка едет по доске — прячем action-кнопки.
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

function openCurrentTile() {
  if (currentTile.value) game.selectTile(currentTile.value.index);
}
</script>

<template>
  <div class="hud">
    <!-- Turn banner -->
    <div :class="['turn-banner', isMyTurn && 'turn-banner--mine']">
      <div class="turn-banner__dot" :style="{ background: current?.color }" />
      <div class="turn-banner__text">
        <template v-if="isMyTurn">🎯 {{ t("game.yourTurn") }}</template>
        <template v-else-if="current">{{ t("game.turnOf", { name: current.name }) }}</template>
      </div>
      <div v-if="current?.inJail" class="chip jail-chip">🔒 {{ t("game.inJail") }}</div>
    </div>

    <!-- Dice -->
    <div class="dice-wrap">
      <Dice :dice="room.dice" :speed-die="room.speedDie" :rolling="rolling" />
    </div>

    <!-- Current tile card — clickable, opens full info -->
    <button
      v-if="currentTile && room.phase !== 'lobby' && room.phase !== 'ended'"
      class="tile-card card"
      @click="openCurrentTile"
    >
      <div class="tile-card__name">{{ currentTile.name[locale as "en" | "ru"] }}</div>
      <div class="tile-card__right">
        <span v-if="currentTilePrice" class="tile-card__price">💰 {{ currentTilePrice }}</span>
        <span class="tile-card__info">ⓘ</span>
      </div>
    </button>

    <!-- Actions -->
    <div class="actions">
      <div v-if="animating" class="hint-card hint-card--active">
        🎲 Фишка двигается…
      </div>
      <template v-else-if="isMyTurn && room.phase === 'rolling'">
        <button class="btn btn--primary big" @click="onRoll">
          🎲 {{ t("game.roll") }}
        </button>
      </template>
      <template v-else-if="isMyTurn && room.phase === 'buyPrompt'">
        <button class="btn btn--neon big" @click="onBuy">
          {{ t("game.buy", { price: currentTilePrice }) }}
        </button>
        <button class="btn btn--ghost" @click="onSkipBuy">
          {{ t("game.skip") }}
        </button>
      </template>
      <template v-else-if="isMyTurn && room.phase === 'action'">
        <button class="btn btn--primary big" @click="onEndTurn">
          ✓ {{ t("game.endTurn") }}
        </button>
      </template>
      <div v-else class="hint-card">
        {{ t("game.closeMinimize") }}
      </div>
    </div>

    <!-- Me stats -->
    <div v-if="me" class="me-card card">
      <div class="me-card__row">
        <span class="me-card__label">{{ t("game.cash") }}</span>
        <span class="money me-card__cash">${{ me.cash }}</span>
      </div>
      <div class="me-card__row">
        <span class="me-card__label">{{ t("game.properties") }}</span>
        <span>{{ Object.values(room.properties).filter((p) => p.ownerId === me.id).length }}</span>
      </div>
      <div v-if="me.getOutCards > 0" class="me-card__row">
        <span class="me-card__label">🆓 Jail Free</span>
        <span class="me-card__cash">{{ me.getOutCards }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px 14px;
}
.turn-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  backdrop-filter: blur(16px);
}
.turn-banner--mine {
  border-color: var(--neon);
  box-shadow: 0 0 0 1px var(--neon), 0 0 30px -8px rgba(34, 197, 94, 0.5);
  animation: pulse-glow 2s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 1px var(--neon), 0 0 20px -8px rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 0 1px var(--neon), 0 0 40px -4px rgba(34, 197, 94, 0.7); }
}
.turn-banner__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 10px currentColor;
}
.turn-banner__text {
  flex: 1;
  font-weight: 700;
  font-size: 14px;
}
.jail-chip {
  background: rgba(239, 68, 68, 0.15);
  color: var(--red);
  border-color: rgba(239, 68, 68, 0.3);
}

.dice-wrap {
  display: flex;
  justify-content: center;
  padding: 6px 0;
  min-height: 60px;
}

.tile-card {
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, transform 0.1s ease;
}
.tile-card:active { transform: scale(0.98); }
.tile-card:hover { border-color: var(--purple); }
.tile-card__name {
  font-weight: 600;
}
.tile-card__right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tile-card__price {
  color: var(--gold);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tile-card__info {
  font-size: 18px;
  color: var(--purple);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.big {
  padding: 14px;
  font-size: 15px;
}
.hint-card {
  padding: 10px 14px;
  background: rgba(168, 85, 247, 0.08);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}
.hint-card--active {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.4);
  color: var(--gold);
  font-weight: 600;
  animation: hint-pulse 1.2s ease-in-out infinite;
}
@keyframes hint-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

.me-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.me-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.me-card__label {
  color: var(--text-dim);
}
.me-card__cash {
  font-size: 16px;
}
</style>
