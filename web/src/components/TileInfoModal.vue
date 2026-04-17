<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS, GROUP_SIZE } from "../../../shared/board";
import type { Locale, StreetTile } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";
import { useGameStore } from "../stores/game";

const props = defineProps<{
  onBuildHouse?: (tileIndex: number) => void;
  onSellHouse?: (tileIndex: number) => void;
  onProposeTrade?: (tileIndex: number, cash: number) => void;
}>();

const { locale } = useI18n();
const game = useGameStore();

const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const tile = computed(() => {
  const idx = game.selectedTileIndex;
  return idx !== null ? BOARD[idx] : null;
});
const owned = computed(() => {
  const idx = game.selectedTileIndex;
  return idx !== null ? game.room?.properties[idx] : null;
});
const owner = computed(() => {
  const o = owned.value;
  return o ? game.room?.players.find((p) => p.id === o.ownerId) ?? null : null;
});

const ownerIcon = computed(() => {
  const p = owner.value;
  if (!p) return "●";
  return SHOP_ITEMS.find((i) => i.id === p.token)?.icon ?? "●";
});

const bandColor = computed(() => {
  const t = tile.value;
  if (!t || t.kind !== "street") return null;
  return GROUP_COLORS[t.group];
});

interface RentRow { label: string; value: string }

const rentRows = computed<RentRow[]>(() => {
  const t = tile.value;
  if (!t) return [];
  if (t.kind === "street") {
    const s = t as StreetTile;
    return [
      { label: loc.value === "ru" ? "Базовая" : "Base",       value: `$${s.rent[0]}` },
      { label: loc.value === "ru" ? "Монополия"  : "Monopoly", value: `$${s.rent[0] * 2}` },
      { label: loc.value === "ru" ? "1 дом"  : "1 house",     value: `$${s.rent[1]}` },
      { label: loc.value === "ru" ? "2 дома"  : "2 houses",   value: `$${s.rent[2]}` },
      { label: loc.value === "ru" ? "3 дома"  : "3 houses",   value: `$${s.rent[3]}` },
      { label: loc.value === "ru" ? "4 дома"  : "4 houses",   value: `$${s.rent[4]}` },
      { label: loc.value === "ru" ? "Отель"   : "Hotel",      value: `$${s.rent[5]}` },
    ];
  }
  if (t.kind === "railroad") {
    return [
      { label: loc.value === "ru" ? "1 ж/д" : "1 RR", value: "$25" },
      { label: loc.value === "ru" ? "2 ж/д" : "2 RR", value: "$50" },
      { label: loc.value === "ru" ? "3 ж/д" : "3 RR", value: "$100" },
      { label: loc.value === "ru" ? "4 ж/д" : "4 RR", value: "$200" },
    ];
  }
  if (t.kind === "utility") {
    return [
      { label: loc.value === "ru" ? "1 инфра" : "1 util", value: loc.value === "ru" ? "×4 кубиков" : "×4 dice" },
      { label: loc.value === "ru" ? "2 инфры" : "2 utils", value: loc.value === "ru" ? "×10 кубиков" : "×10 dice" },
    ];
  }
  return [];
});

const description = computed<string | null>(() => {
  const t = tile.value;
  if (!t) return null;
  switch (t.kind) {
    case "go":
      return loc.value === "ru" ? "Проходя — получи $200" : "Collect $200 when you pass";
    case "jail":
      return loc.value === "ru" ? "Тюрьма / В гостях" : "Jail / Just Visiting";
    case "goToJail":
      return loc.value === "ru" ? "Отправляешься в тюрьму без сбора $200" : "Go to Jail — do not pass GO";
    case "freeParking":
      return loc.value === "ru" ? "Просто отдых — ничего не происходит" : "Rest — no effect";
    case "tax":
      return loc.value === "ru" ? `Заплати $${t.amount}` : `Pay $${t.amount}`;
    case "chance":
      return loc.value === "ru" ? "Тяни карту Шанс — может быть что угодно" : "Draw a Chance card — could be anything";
    case "chest":
      return loc.value === "ru" ? "Тяни карту Казны — обычно выигрыш/штраф" : "Draw a Community Chest card";
    default:
      return null;
  }
});

const iconText = computed(() => {
  const t = tile.value;
  if (!t) return "";
  switch (t.kind) {
    case "go": return "▶";
    case "jail": return "🔒";
    case "goToJail": return "👮";
    case "freeParking": return "🅿️";
    case "chance": return "❓";
    case "chest": return "🎁";
    case "tax": return "💸";
    case "railroad": return "🚂";
    case "utility": return t.index === 12 ? "💡" : "💧";
    case "street": return "🏠";
    default: return "";
  }
});

function close() { game.selectTile(null); }

const isMineStreet = computed(() => {
  const t = tile.value;
  const o = owned.value;
  const me = game.me;
  return t?.kind === "street" && o && me && o.ownerId === me.id;
});

const hasMonopoly = computed(() => {
  const t = tile.value;
  if (!t || t.kind !== "street" || !game.room || !owned.value) return false;
  const group = t.group;
  const groupTiles = BOARD.filter((x) => x.kind === "street" && (x as StreetTile).group === group);
  if (groupTiles.length !== (GROUP_SIZE[group] ?? 0)) return false;
  return groupTiles.every((gt) => game.room?.properties[gt.index]?.ownerId === owned.value?.ownerId);
});

const canBuild = computed(() => {
  if (!isMineStreet.value || !hasMonopoly.value) return false;
  const o = owned.value;
  if (!o || o.mortgaged) return false;
  return !o.hotel;
});

const canSell = computed(() => {
  const o = owned.value;
  return !!isMineStreet.value && !!o && (o.houses > 0 || o.hotel);
});

const buildCost = computed(() => {
  const t = tile.value;
  return t?.kind === "street" ? (t as StreetTile).houseCost : 0;
});

function build() {
  if (tile.value) props.onBuildHouse?.(tile.value.index);
}
function sell() {
  if (tile.value) props.onSellHouse?.(tile.value.index);
}

// Трейд — можно предложить, если это чья-то чужая собственность (без построек).
const canPropose = computed(() => {
  const o = owned.value;
  const me = game.me;
  if (!o || !me || o.ownerId === me.id) return false;
  if (o.houses > 0 || o.hotel) return false;
  return true;
});
const proposeOpen = ref(false);
const proposeCash = ref(0);
function openPropose() {
  const t = tile.value;
  if (t && (t.kind === "street" || t.kind === "railroad" || t.kind === "utility")) {
    proposeCash.value = t.price;
  }
  proposeOpen.value = true;
}
function sendPropose() {
  if (!tile.value || !proposeCash.value || proposeCash.value <= 0) return;
  props.onProposeTrade?.(tile.value.index, proposeCash.value);
  proposeOpen.value = false;
  game.selectTile(null);
}
</script>

<template>
  <transition name="fade">
    <div v-if="tile" class="overlay" @click="close">
      <div class="info-card" @click.stop>
        <div v-if="bandColor" class="info-card__band" :style="{ background: bandColor }" />

        <div class="info-card__head">
          <div class="info-card__icon">{{ iconText }}</div>
          <div class="info-card__title">{{ tile.name[loc] }}</div>
          <button class="info-card__close" @click="close">✕</button>
        </div>

        <div v-if="tile.kind === 'street' || tile.kind === 'railroad' || tile.kind === 'utility'" class="info-card__price">
          <span class="label">{{ loc === "ru" ? "Цена" : "Price" }}</span>
          <span class="val money">${{ tile.price }}</span>
        </div>

        <div v-if="rentRows.length" class="rent-table">
          <div v-for="r in rentRows" :key="r.label" class="rent-row">
            <span class="rent-row__label">{{ r.label }}</span>
            <span class="rent-row__val money">{{ r.value }}</span>
          </div>
        </div>

        <div v-if="tile.kind === 'street'" class="info-extra">
          <div class="info-extra__row">
            <span class="label">{{ loc === "ru" ? "Дом/отель" : "House/hotel" }}</span>
            <span class="val">${{ tile.houseCost }}</span>
          </div>
          <div class="info-extra__row">
            <span class="label">{{ loc === "ru" ? "Залог" : "Mortgage" }}</span>
            <span class="val">${{ tile.mortgage }}</span>
          </div>
        </div>

        <div v-if="tile.kind === 'railroad' || tile.kind === 'utility'" class="info-extra">
          <div class="info-extra__row">
            <span class="label">{{ loc === "ru" ? "Залог" : "Mortgage" }}</span>
            <span class="val">${{ tile.mortgage }}</span>
          </div>
        </div>

        <div v-if="description" class="info-desc">{{ description }}</div>

        <div v-if="owner" class="owner-panel" :style="{ borderColor: owner.color }">
          <div class="owner-panel__head">
            {{ loc === "ru" ? "Владелец" : "Owner" }}
          </div>
          <div class="owner-panel__row">
            <span class="owner-panel__token" :style="{ background: owner.color }">
              {{ ownerIcon }}
            </span>
            <span class="owner-panel__name">{{ owner.name }}</span>
            <span v-if="owned?.mortgaged" class="chip mortgage-chip">{{ loc === "ru" ? "В залоге" : "Mortgaged" }}</span>
          </div>
          <div v-if="owned && (owned.houses || owned.hotel)" class="owner-panel__buildings">
            <span v-if="owned.hotel">🏨 {{ loc === "ru" ? "Отель" : "Hotel" }}</span>
            <span v-else-if="owned.houses > 0">
              <span v-for="n in owned.houses" :key="n">🏠</span>
            </span>
          </div>
        </div>
        <div v-else-if="tile.kind === 'street' || tile.kind === 'railroad' || tile.kind === 'utility'" class="free-chip">
          {{ loc === "ru" ? "Свободно" : "Unowned" }}
        </div>

        <!-- Build / sell actions -->
        <div v-if="isMineStreet" class="build-actions">
          <button
            class="btn btn--neon"
            :disabled="!canBuild"
            @click="build"
          >
            {{ owned?.houses === 4 ? "🏨 Построить отель" : "🏠 Построить дом" }}
            <span class="build-actions__cost">${{ buildCost }}</span>
          </button>
          <button
            class="btn btn--ghost"
            :disabled="!canSell"
            @click="sell"
          >
            💰 Продать за ${{ Math.floor(buildCost / 2) }}
          </button>
          <p v-if="!hasMonopoly" class="build-actions__hint">
            Нужна вся цветовая группа, чтобы строить
          </p>
        </div>

        <!-- Предложить выкуп у чужого владельца -->
        <div v-if="canPropose" class="build-actions">
          <div v-if="!proposeOpen">
            <button class="btn btn--primary" @click="openPropose">
              💱 Предложить выкуп
            </button>
          </div>
          <div v-else class="propose-form">
            <label class="propose-form__label">
              Сколько предлагаешь?
              <input
                v-model.number="proposeCash"
                type="number"
                min="1"
                :max="game.me?.cash ?? 0"
                class="propose-form__input"
              />
            </label>
            <div class="propose-form__row">
              <button class="btn btn--ghost" @click="proposeOpen = false">Отмена</button>
              <button class="btn btn--neon" :disabled="!proposeCash || proposeCash <= 0" @click="sendPropose">
                Отправить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(10px);
  z-index: 110;
  display: grid;
  place-items: center;
  padding: 20px;
}
.info-card {
  width: min(360px, 100%);
  background: var(--surface-strong);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.8);
  animation: info-pop 0.25s cubic-bezier(0.3, 1.2, 0.4, 1);
}
.info-card__band {
  height: 10px;
  width: 100%;
}
.info-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
}
.info-card__icon {
  font-size: 26px;
  line-height: 1;
}
.info-card__title {
  flex: 1;
  font-weight: 800;
  font-size: 17px;
  line-height: 1.2;
}
.info-card__close {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--text-mute);
  font-size: 16px;
}
.info-card__close:hover { color: var(--text); background: rgba(255, 255, 255, 0.05); }

.info-card__price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.info-card__price .val { font-size: 17px; }

.rent-table {
  display: flex;
  flex-direction: column;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.rent-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 13px;
}
.rent-row__label { color: var(--text-dim); }

.info-extra {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-extra__row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.label { color: var(--text-dim); }
.val { font-weight: 600; }

.info-desc {
  padding: 12px 16px;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.4;
  border-bottom: 1px solid var(--border);
}

.owner-panel {
  margin: 12px 16px 14px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
}
.owner-panel__head {
  font-size: 11px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}
.owner-panel__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.owner-panel__token {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
}
.owner-panel__name {
  font-weight: 700;
  flex: 1;
}
.mortgage-chip {
  background: rgba(239, 68, 68, 0.15);
  color: var(--red);
  border-color: rgba(239, 68, 68, 0.35);
}
.owner-panel__buildings {
  margin-top: 6px;
  font-size: 14px;
}

.free-chip {
  margin: 12px 16px 14px;
  padding: 10px 12px;
  text-align: center;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 12px;
  color: var(--neon);
  font-weight: 600;
}

.build-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 16px 14px;
}
.build-actions .btn {
  padding: 12px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.build-actions__cost {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
.build-actions__hint {
  font-size: 11px;
  color: var(--text-mute);
  text-align: center;
  margin: 2px 0 0;
}
.propose-form { display: flex; flex-direction: column; gap: 8px; }
.propose-form__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
}
.propose-form__input {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  outline: none;
}
.propose-form__input:focus { border-color: var(--purple); }
.propose-form__row { display: flex; gap: 6px; }
.propose-form__row .btn { flex: 1; padding: 10px; }

@keyframes info-pop {
  0% { transform: translateY(30px) scale(0.9); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
