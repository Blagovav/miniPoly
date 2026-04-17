<script setup lang="ts">
import { computed, ref } from "vue";
import type { Player, RoomState } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";

const props = defineProps<{
  room: RoomState;
  myPlayerId: string | null;
}>();

const emit = defineEmits<{
  (e: "openProfile", player: Player): void;
}>();

const currentId = computed(() => props.room.players[props.room.currentTurn]?.id ?? null);

// Все КРОМЕ меня (чтобы не дублировать свою карточку — она уже в HUD).
const opponents = computed(() =>
  props.room.players.filter((p) => p.id !== props.myPlayerId),
);

function propCount(p: Player): number {
  return Object.values(props.room.properties).filter((x) => x.ownerId === p.id).length;
}

function tokenIcon(p: Player): string {
  if (p.token) return SHOP_ITEMS.find((i) => i.id === p.token)?.icon ?? "●";
  return p.name.slice(0, 1).toUpperCase();
}
</script>

<template>
  <div v-if="opponents.length > 0" class="opponents">
    <div
      v-for="p in opponents"
      :key="p.id"
      :class="[
        'opp',
        p.bankrupt && 'opp--bankrupt',
        !p.connected && 'opp--offline',
        p.id === currentId && 'opp--current',
      ]"
      :style="{ '--clr': p.color }"
      @click="emit('openProfile', p)"
    >
      <div class="opp__token" :style="{ background: p.color }">
        {{ tokenIcon(p) }}
      </div>
      <div class="opp__body">
        <div class="opp__name">
          {{ p.name }}
          <span v-if="!p.connected" class="opp__offline-dot" title="offline" />
        </div>
        <div class="opp__stats">
          <span class="opp__cash">${{ p.cash }}</span>
          <span class="opp__props">🏠 {{ propCount(p) }}</span>
        </div>
      </div>
      <div v-if="p.id === currentId" class="opp__turn" />
    </div>
  </div>
</template>

<style scoped>
.opponents {
  display: flex;
  gap: 8px;
  padding: 10px 14px 2px;
  overflow-x: auto;
  scrollbar-width: thin;
  scroll-snap-type: x mandatory;
}
.opponents::-webkit-scrollbar { height: 4px; }

.opp {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-width: 150px;
  scroll-snap-align: start;
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;
  backdrop-filter: blur(10px);
}
.opp:hover { border-color: var(--clr); transform: translateY(-1px); }
.opp:active { transform: scale(0.97); }

.opp--current {
  border-color: var(--clr);
  box-shadow: 0 0 0 1px var(--clr), 0 0 24px -6px var(--clr);
}
.opp--offline { opacity: 0.55; }
.opp--bankrupt {
  opacity: 0.35;
  filter: grayscale(0.8);
}

.opp__token {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 4px 10px -4px var(--clr),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.opp__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.opp__name {
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}
.opp__offline-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--red);
  display: inline-block;
}
.opp__stats {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 1px;
}
.opp__cash { color: var(--gold); font-weight: 700; font-variant-numeric: tabular-nums; }

.opp__turn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--clr);
  box-shadow: 0 0 8px var(--clr);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
}
</style>
