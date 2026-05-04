<script setup lang="ts">
// Overlay shown during the "roll for order" phase. Lists every player with
// their latest pre-roll (or "…" if still pending) and highlights the current
// roller. The actual "Roll dice" button lives in the primary action bar —
// this panel is status-only, no taps.
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Player, PreRollBracket, RoomState } from "../../../shared/types";
import Dice from "./Dice.vue";
import { capTypeFor } from "../shop/cosmetics";

const props = defineProps<{
  room: RoomState;
  myPlayerId: string | null;
  dice: [number, number] | null;
  rolling: boolean;
}>();

const { locale } = useI18n();

function colorFor(p: Player): string {
  return p.color || "#484337";
}

// Display-only snapshot of the pre-roll state. We intentionally lag behind
// `props.room` during tumble (props.rolling === true) so the result text
// ("8 · re-roll", "#1", etc.) doesn't flash in the list before the dice
// finish spinning. Synced whenever rolling flips back to false.
interface Snapshot {
  rolls: Record<string, number>;
  brackets: PreRollBracket[];
  order: string[];
}
function snapshot(r: RoomState): Snapshot {
  return {
    rolls: { ...(r.preRollRolls ?? {}) },
    brackets: (r.preRollBrackets ?? []).map((b) => ({
      playerIds: [...b.playerIds],
      rolls: { ...b.rolls },
      pending: [...b.pending],
      isReRoll: b.isReRoll,
    })),
    order: [...(r.preRollOrder ?? [])],
  };
}
const displayed = ref<Snapshot>(snapshot(props.room));
watch(
  () => props.rolling,
  (isRolling) => { if (!isRolling) displayed.value = snapshot(props.room); },
);
watch(
  () => props.room,
  (r) => { if (!props.rolling) displayed.value = snapshot(r); },
  { deep: true },
);

function rollFor(pid: string): number | null {
  const v = displayed.value.rolls[pid];
  return typeof v === "number" ? v : null;
}

const seatByPid = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {};
  displayed.value.order.forEach((id, i) => { map[id] = i + 1; });
  return map;
});

const tiedIds = computed<Set<string>>(() => {
  const set = new Set<string>();
  for (const b of displayed.value.brackets) {
    // Only mark players as re-rolling when their bracket was spawned by a tie.
    // The initial bracket has everyone in it but that's not a tie yet.
    if (b.isReRoll && b.playerIds.length > 1) {
      for (const id of b.playerIds) set.add(id);
    }
  }
  return set;
});

// Current roller is the head of the active (displayed) bracket's pending
// queue — derived from the lagged snapshot so "rolling…" stays on whoever's
// dice are actually spinning, not the next player queued up server-side.
const currentRollerId = computed<string | null>(() => {
  const b = displayed.value.brackets[0];
  return b?.pending[0] ?? null;
});

const title = computed(() =>
  locale.value === "ru" ? "Бросаем на порядок хода" : "Rolling for turn order",
);

const subtitle = computed(() => {
  const roller = props.room.players.find((p) => p.id === currentRollerId.value);
  if (!roller) return "";
  const me = roller.id === props.myPlayerId;
  if (locale.value === "ru") {
    return me ? "Твой бросок!" : `Кидает: ${roller.name}`;
  }
  return me ? "Your roll!" : `Rolling: ${roller.name}`;
});
</script>

<template>
  <div class="preroll">
    <div class="preroll__card">
      <h2 class="preroll__title">{{ title }}</h2>
      <div class="preroll__subtitle">{{ subtitle }}</div>
      <div class="preroll__dice">
        <Dice :dice="dice" :rolling="rolling" />
      </div>
      <ul class="preroll__list">
        <li
          v-for="p in room.players"
          :key="p.id"
          class="preroll__row"
          :class="{
            'preroll__row--current': p.id === currentRollerId,
            'preroll__row--done': p.id in seatByPid,
            'preroll__row--tied': tiedIds.has(p.id),
          }"
        >
          <span class="preroll__token" :style="{ background: colorFor(p) }">
            <img
              class="preroll__cap"
              :src="`/figma/shop/caps/${capTypeFor(p.token)}.webp`"
              :alt="p.name"
              draggable="false"
            />
          </span>
          <span class="preroll__name">{{ p.name }}</span>
          <span v-if="seatByPid[p.id]" class="preroll__seat">#{{ seatByPid[p.id] }}</span>
          <span v-else-if="p.id === currentRollerId" class="preroll__pending">
            {{ locale === 'ru' ? 'бросает…' : 'rolling…' }}
          </span>
          <span v-else-if="tiedIds.has(p.id) && rollFor(p.id) !== null" class="preroll__roll preroll__roll--tie">
            {{ rollFor(p.id) }} · {{ locale === 'ru' ? 'перебрасывает' : 're-roll' }}
          </span>
          <span v-else-if="rollFor(p.id) !== null" class="preroll__roll">
            {{ rollFor(p.id) }}
          </span>
          <span v-else class="preroll__wait">—</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.preroll {
  position: absolute;
  inset: 0;
  /* Below the topbar (z:5) and primary action bar (z:5) so neither the room
     code nor the ROLL DICE button gets eaten by the backdrop. Above the board
     stage (z:1) + HUD (z:3) so the board disappears under it. */
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  /* Hide the board underneath with the exact same dual-layer bg as
     <body>.room-figma-root — a 45% green overlay on top of the pattern,
     then multiply-blended against the solid green. Matching the body layer
     means the overlay stitches seamlessly with the safe-area strips instead
     of leaving a flat green slab where the preroll covers the middle. */
  background-color: #9fe101;
  background-image:
    linear-gradient(rgba(159, 225, 1, 0.7), rgba(159, 225, 1, 0.7)),
    url('/figma/room/bg-pattern.webp');
  background-size: auto, cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;
  background-blend-mode: normal, multiply;
}
.preroll__card {
  pointer-events: auto;
  width: min(360px, 100%);
  background: #fff;
  border: 2px solid #000;
  border-radius: 22px;
  padding: 18px 16px 14px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
  font-family: 'Unbounded', 'Golos Text', sans-serif;
}
.preroll__title {
  margin: 0 0 4px;
  font-weight: 900;
  font-size: 18px;
  line-height: 22px;
  color: #000;
  text-align: center;
  letter-spacing: 0.01em;
}
.preroll__subtitle {
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  line-height: 16px;
  color: #4a4a4a;
  margin-bottom: 10px;
}
.preroll__dice {
  display: flex;
  justify-content: center;
  margin: 2px 0 12px;
}
.preroll__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preroll__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.preroll__row--current {
  background: #fff9d6;
  border-color: #e84b3e;
  transform: translateX(2px);
}
.preroll__row--done {
  background: #e6ffe1;
}
.preroll__row--tied {
  background: #fde9e6;
}
/* Player chip — coloured disc with the equipped cap figurine inside.
   Same identity language as the leaderboard / turn-slider so the same
   silhouette identifies the player across every surface. */
.preroll__token {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1.5px solid rgba(0, 0, 0, 0.18);
}
.preroll__cap {
  width: 110%;
  height: 110%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.preroll__name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preroll__seat {
  font-weight: 900;
  font-size: 16px;
  line-height: 18px;
  color: #1f8a3e;
  flex-shrink: 0;
}
.preroll__roll {
  font-weight: 900;
  font-size: 16px;
  line-height: 18px;
  color: #000;
  flex-shrink: 0;
}
.preroll__roll--tie {
  font-size: 11px;
  color: #b73427;
  font-weight: 700;
}
.preroll__pending {
  font-weight: 700;
  font-size: 12px;
  color: #b73427;
  flex-shrink: 0;
}
.preroll__wait {
  font-weight: 700;
  color: #9a9a9a;
  flex-shrink: 0;
}
</style>
