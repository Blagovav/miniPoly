<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, Player, StreetTile } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";
import { useGameStore } from "../stores/game";

const props = defineProps<{
  player: Player | null;
  onClose: () => void;
  onOfferTrade?: (playerId: string) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const game = useGameStore();

const icon = computed(() => {
  const p = props.player;
  if (!p) return "";
  return SHOP_ITEMS.find((i) => i.id === p.token)?.icon ?? p.name[0];
});

const ownedList = computed(() => {
  if (!props.player || !game.room) return [];
  const id = props.player.id;
  return Object.values(game.room.properties)
    .filter((x) => x.ownerId === id)
    .map((prop) => ({
      tile: BOARD[prop.tileIndex],
      houses: prop.houses,
      hotel: prop.hotel,
      mortgaged: prop.mortgaged,
    }))
    .sort((a, b) => a.tile.index - b.tile.index);
});

const totalWorth = computed(() => {
  if (!props.player || !game.room) return 0;
  let sum = props.player.cash;
  for (const prop of Object.values(game.room.properties)) {
    if (prop.ownerId !== props.player.id) continue;
    const tile = BOARD[prop.tileIndex];
    if (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility") {
      sum += prop.mortgaged ? Math.floor(tile.price / 2) : tile.price;
    }
    if (tile.kind === "street") {
      sum += prop.houses * (tile as StreetTile).houseCost;
      if (prop.hotel) sum += (tile as StreetTile).houseCost;
    }
  }
  return sum;
});

function bandColor(tileIndex: number): string {
  const t = BOARD[tileIndex];
  if (t.kind !== "street") return "#64748b";
  return GROUP_COLORS[t.group];
}
</script>

<template>
  <transition name="fade">
    <div v-if="player" class="overlay" @click="onClose">
      <div class="profile" @click.stop>
        <button class="profile__close" @click="onClose">✕</button>

        <div class="profile__head" :style="{ background: `linear-gradient(135deg, ${player.color}, #0a0e1a)` }">
          <div class="profile__token" :style="{ background: player.color }">{{ icon }}</div>
          <div class="profile__name">{{ player.name }}</div>
          <div class="profile__sub">
            <span v-if="player.bankrupt" class="chip bankrupt-chip">Банкрот</span>
            <span v-else-if="!player.connected" class="chip offline-chip">offline</span>
            <span v-else class="chip online-chip">online</span>
          </div>
        </div>

        <div class="profile__stats">
          <div class="stat">
            <span class="stat__label">Наличные</span>
            <span class="stat__val money">${{ player.cash }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Состояние</span>
            <span class="stat__val money">${{ totalWorth }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Собственность</span>
            <span class="stat__val">{{ ownedList.length }}</span>
          </div>
        </div>

        <div class="profile__section">
          <div class="profile__section-title">Собственность</div>
          <div v-if="ownedList.length === 0" class="profile__empty">— ничего не куплено —</div>
          <div v-else class="profile__list">
            <div v-for="item in ownedList" :key="item.tile.index" class="prop-row">
              <div class="prop-row__band" :style="{ background: bandColor(item.tile.index) }" />
              <div class="prop-row__name">{{ item.tile.name[loc] }}</div>
              <div class="prop-row__houses">
                <span v-if="item.hotel">🏨</span>
                <span v-else-if="item.houses > 0">
                  <span v-for="n in item.houses" :key="n">🏠</span>
                </span>
                <span v-if="item.mortgaged" class="mortgaged">🔒</span>
              </div>
            </div>
          </div>
        </div>

        <button
          v-if="onOfferTrade && !player.bankrupt"
          class="btn btn--primary profile__trade"
          @click="onOfferTrade(player.id)"
        >
          💱 Предложить сделку
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  z-index: 115;
  display: grid; place-items: center;
  padding: 16px;
}
.profile {
  width: min(400px, 100%);
  max-height: 90dvh;
  overflow-y: auto;
  background: var(--surface-strong);
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  position: relative;
  animation: pop 0.25s cubic-bezier(0.3, 1.2, 0.4, 1);
}
.profile__close {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px; border-radius: 8px;
  color: #fff;
  font-size: 16px;
  z-index: 2;
  background: rgba(0, 0, 0, 0.35);
}

.profile__head {
  padding: 20px 20px 16px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.profile__token {
  width: 72px; height: 72px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 36px; color: #fff;
  box-shadow:
    0 0 0 3px rgba(0, 0, 0, 0.35),
    0 12px 28px -8px currentColor,
    inset 0 2px 0 rgba(255, 255, 255, 0.4);
}
.profile__name { font-size: 20px; font-weight: 800; }
.profile__sub { display: flex; gap: 6px; }
.online-chip { background: rgba(34, 197, 94, 0.2); color: var(--neon); border-color: rgba(34, 197, 94, 0.4); }
.offline-chip { color: var(--red); border-color: rgba(239, 68, 68, 0.35); }
.bankrupt-chip { background: rgba(239, 68, 68, 0.2); color: var(--red); border-color: rgba(239, 68, 68, 0.4); }

.profile__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat__label {
  font-size: 10px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.stat__val {
  font-weight: 800;
  font-size: 16px;
}

.profile__section { padding: 14px 16px; }
.profile__section-title {
  font-size: 11px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
.profile__empty { color: var(--text-mute); font-size: 13px; text-align: center; padding: 12px 0; }
.profile__list { display: flex; flex-direction: column; gap: 4px; }
.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
  font-size: 13px;
}
.prop-row__band {
  width: 3px; height: 20px; border-radius: 2px;
  box-shadow: 0 0 8px currentColor;
}
.prop-row__name { flex: 1; font-weight: 600; }
.prop-row__houses { font-size: 11px; display: flex; gap: 2px; }
.mortgaged { opacity: 0.7; }

.profile__trade { margin: 8px 16px 16px; padding: 12px; width: calc(100% - 32px); }

@keyframes pop {
  0% { transform: scale(0.9) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
