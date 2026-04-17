<script setup lang="ts">
import { computed } from "vue";
import type { Player, RoomState } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

const game = useGameStore();

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
  props.room.players
    .map((p, idx) => ({ player: p, idx }))
    .filter(({ player }) => player.id !== props.myPlayerId),
);

function propCount(p: Player): number {
  return Object.values(props.room.properties).filter((x) => x.ownerId === p.id).length;
}

function colorForIndex(idx: number): string {
  return ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length];
}
</script>

<template>
  <div v-if="opponents.length > 0" class="opponents rail">
    <div
      v-for="{ player: p, idx } in opponents"
      :key="p.id"
      class="ppill opp"
      :class="{
        'opp--bankrupt': p.bankrupt,
        'opp--offline': !p.connected,
        'opp--current': p.id === currentId,
      }"
      @click="emit('openProfile', p)"
    >
      <Sigil
        :name="p.name"
        :color="colorForIndex(idx)"
        :size="26"
      />
      <div class="opp__body">
        <div class="nm opp__name">
          <Icon
            v-if="game.isFriend(p.tgUserId)"
            name="shield"
            :size="11"
            color="var(--emerald)"
          />
          <span class="opp__name-text">{{ p.name }}</span>
          <span
            v-if="!p.connected"
            class="opp__offline-dot"
            title="offline"
          />
        </div>
        <div class="opp__stats">
          <span class="cash">&#9670; {{ p.cash }}</span>
          <span class="opp__props">
            <Icon name="home" :size="10" color="var(--ink-3)"/>
            {{ propCount(p) }}
          </span>
        </div>
      </div>
      <div v-if="p.id === currentId" class="opp__turn" />
    </div>
  </div>
</template>

<style scoped>
.opponents {
  padding: 10px 14px 4px;
  scroll-snap-type: x mandatory;
}

.opp {
  flex: 0 0 auto;
  min-width: 150px;
  cursor: pointer;
  scroll-snap-align: start;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.opp:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}
.opp:active { transform: scale(0.98); }

.opp--current {
  border-color: var(--primary);
  box-shadow: 0 0 0 1.5px var(--primary);
}

.opp--offline { opacity: 0.55; }
.opp--bankrupt {
  opacity: 0.38;
  filter: grayscale(0.7);
}

.opp__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.opp__name {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 120px;
}
.opp__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opp__offline-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
  flex-shrink: 0;
}

.opp__stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-3);
  line-height: 1.1;
}
.opp__stats .cash {
  color: var(--gold);
  font-weight: 500;
}
.opp__props {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--ink-3);
}

.opp__turn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 6px var(--primary-soft);
  animation: dot-pulse 1.4s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.4); }
}
</style>
