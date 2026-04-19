<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS, GROUP_SIZE } from "../../../shared/board";
import type { Locale, StreetTile } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";
import { useGameStore } from "../stores/game";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";

const props = defineProps<{
  onBuildHouse?: (tileIndex: number) => void;
  onSellHouse?: (tileIndex: number) => void;
  onProposeTrade?: (tileIndex: number, cash: number) => void;
  onMortgage?: (tileIndex: number) => void;
  onUnmortgage?: (tileIndex: number) => void;
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

/** Stable medieval hue tied to the owner's seat index in the room. */
const ownerColor = computed(() => {
  const o = owner.value;
  if (!o || !game.room) return "var(--ink-3)";
  const idx = game.room.players.findIndex((pp) => pp.id === o.id);
  if (idx < 0) return o.color || "var(--ink-3)";
  return ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length];
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
      { label: loc.value === "ru" ? "Базовая" : "Base",       value: `◈ ${s.rent[0]}` },
      { label: loc.value === "ru" ? "Монополия"  : "Monopoly", value: `◈ ${s.rent[0] * 2}` },
      { label: loc.value === "ru" ? "1 дом"  : "1 house",     value: `◈ ${s.rent[1]}` },
      { label: loc.value === "ru" ? "2 дома"  : "2 houses",   value: `◈ ${s.rent[2]}` },
      { label: loc.value === "ru" ? "3 дома"  : "3 houses",   value: `◈ ${s.rent[3]}` },
      { label: loc.value === "ru" ? "4 дома"  : "4 houses",   value: `◈ ${s.rent[4]}` },
      { label: loc.value === "ru" ? "Отель"   : "Hotel",      value: `◈ ${s.rent[5]}` },
    ];
  }
  if (t.kind === "railroad") {
    return [
      { label: loc.value === "ru" ? "1 ж/д" : "1 RR", value: "◈ 25" },
      { label: loc.value === "ru" ? "2 ж/д" : "2 RR", value: "◈ 50" },
      { label: loc.value === "ru" ? "3 ж/д" : "3 RR", value: "◈ 100" },
      { label: loc.value === "ru" ? "4 ж/д" : "4 RR", value: "◈ 200" },
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
      return loc.value === "ru" ? "Проходя — получи ◈ 200" : "Collect ◈ 200 when you pass";
    case "jail":
      return loc.value === "ru" ? "Тюрьма / В гостях" : "Jail / Just Visiting";
    case "goToJail":
      return loc.value === "ru" ? "Отправляешься в тюрьму без сбора ◈ 200" : "Go to Jail — do not pass GO";
    case "freeParking":
      return loc.value === "ru" ? "Просто отдых — ничего не происходит" : "Rest — no effect";
    case "tax":
      return loc.value === "ru" ? `Заплати ◈ ${t.amount}` : `Pay ◈ ${t.amount}`;
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
    case "jail": return "⛓";
    case "goToJail": return "⚔";
    case "freeParking": return "♜";
    case "chance": return "?";
    case "chest": return "⎔";
    case "tax": return "◈";
    case "railroad": return "♞";
    case "utility": return t.index === 12 ? "✦" : "≈";
    case "street": return "⌂";
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

function groupLevel(tileIndex: number): number {
  const o = game.room?.properties[tileIndex];
  if (!o) return 0;
  return o.hotel ? 5 : o.houses;
}
const groupOthersLevels = computed<number[]>(() => {
  const t = tile.value;
  if (!t || t.kind !== "street") return [];
  const g = (t as StreetTile).group;
  return BOARD
    .filter((x) => x.kind === "street" && (x as StreetTile).group === g && x.index !== t.index)
    .map((x) => groupLevel(x.index));
});
const evenBuildOk = computed(() => {
  const o = owned.value;
  if (!o) return false;
  const mine = o.hotel ? 5 : o.houses;
  const minOther = groupOthersLevels.value.length ? Math.min(...groupOthersLevels.value) : mine;
  return mine <= minOther;
});
const evenSellOk = computed(() => {
  const o = owned.value;
  if (!o) return false;
  const mine = o.hotel ? 5 : o.houses;
  const maxOther = groupOthersLevels.value.length ? Math.max(...groupOthersLevels.value) : 0;
  return mine >= maxOther;
});

const canBuild = computed(() => {
  if (!isMineStreet.value || !hasMonopoly.value) return false;
  const o = owned.value;
  if (!o || o.mortgaged) return false;
  if (o.hotel) return false;
  return evenBuildOk.value;
});

const canSell = computed(() => {
  const o = owned.value;
  if (!isMineStreet.value || !o) return false;
  if (o.houses <= 0 && !o.hotel) return false;
  return evenSellOk.value;
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

// Залог / выкуп — только для владельца, и только если это собственность без построек.
const isMineProperty = computed(() => {
  const t = tile.value;
  const o = owned.value;
  const me = game.me;
  if (!t || !o || !me) return false;
  if (o.ownerId !== me.id) return false;
  return t.kind === "street" || t.kind === "railroad" || t.kind === "utility";
});
const canMortgage = computed(() => {
  const o = owned.value;
  if (!isMineProperty.value || !o) return false;
  if (o.mortgaged) return false;
  return o.houses === 0 && !o.hotel;
});
const canUnmortgage = computed(() => {
  const o = owned.value;
  return !!isMineProperty.value && !!o && o.mortgaged;
});
const mortgageValue = computed(() => {
  const t = tile.value;
  if (!t || (t.kind !== "street" && t.kind !== "railroad" && t.kind !== "utility")) return 0;
  return (t as any).mortgage as number;
});
const unmortgageCost = computed(() => Math.ceil(mortgageValue.value * 1.1));

function mortgage() {
  if (tile.value) props.onMortgage?.(tile.value.index);
}
function unmortgage() {
  if (tile.value) props.onUnmortgage?.(tile.value.index);
}

const isRu = computed(() => loc.value === "ru");
</script>

<template>
  <transition name="fade">
    <div v-if="tile" class="modal-scrim" @click="close">
      <div
        class="modal-card"
        :style="bandColor ? { borderTopColor: bandColor } : undefined"
        @click.stop
      >
        <div class="grab-handle" />

        <!-- Header: icon + name + close -->
        <div class="head">
          <div
            class="head__icon"
            :style="bandColor ? { background: bandColor, color: '#fff' } : undefined"
          >
            {{ iconText }}
          </div>
          <div class="head__body">
            <div v-if="tile.kind === 'street'" class="head__kicker">
              {{ (tile as StreetTile).group.toUpperCase() }}
              {{ isRu ? "КВАРТАЛ" : "QUARTER" }}
            </div>
            <div v-else class="head__kicker">
              {{ isRu ? "ГРАМОТА" : "DEED" }}
            </div>
            <div class="head__title">{{ tile.name[loc] }}</div>
          </div>
          <button class="icon-btn head__close" @click="close" aria-label="close">
            <Icon name="x" :size="16" color="var(--ink-2)" />
          </button>
        </div>

        <!-- Price row -->
        <div
          v-if="tile.kind === 'street' || tile.kind === 'railroad' || tile.kind === 'utility'"
          class="price-row row between"
        >
          <span class="price-row__label">{{ isRu ? "Цена" : "Price" }}</span>
          <span class="price-row__val">◈ {{ tile.price }}</span>
        </div>

        <!-- Rent table -->
        <div v-if="rentRows.length" class="rent">
          <div class="rent__head">{{ isRu ? "Аренда" : "Rent schedule" }}</div>
          <div class="rent__table">
            <div
              v-for="(r, i) in rentRows"
              :key="r.label"
              class="rent__row"
              :class="{ 'rent__row--last': i === rentRows.length - 1 }"
            >
              <span class="rent__label">{{ r.label }}</span>
              <span class="rent__val">{{ r.value }}</span>
            </div>
          </div>
        </div>

        <!-- Extra stats: house / mortgage -->
        <div v-if="tile.kind === 'street'" class="stat-grid">
          <div class="stat-box">
            <div class="stat-box__label">{{ isRu ? "Дом" : "House" }}</div>
            <div class="stat-box__val">◈ {{ (tile as StreetTile).houseCost }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-box__label">{{ isRu ? "Отель" : "Hotel" }}</div>
            <div class="stat-box__val">◈ {{ (tile as StreetTile).houseCost }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-box__label">{{ isRu ? "Залог" : "Mortgage" }}</div>
            <div class="stat-box__val">◈ {{ (tile as StreetTile).mortgage }}</div>
          </div>
        </div>
        <div v-else-if="tile.kind === 'railroad' || tile.kind === 'utility'" class="stat-grid">
          <div class="stat-box">
            <div class="stat-box__label">{{ isRu ? "Залог" : "Mortgage" }}</div>
            <div class="stat-box__val">◈ {{ (tile as any).mortgage }}</div>
          </div>
        </div>

        <!-- Flavor description for non-property tiles -->
        <div v-if="description" class="desc">{{ description }}</div>

        <!-- Owner panel -->
        <div v-if="owner" class="owner">
          <div class="owner__head">{{ isRu ? "Владелец" : "Owner" }}</div>
          <div class="owner__row">
            <Sigil :name="owner.name" :color="ownerColor" :size="32" />
            <span class="owner__name">{{ owner.name }}</span>
            <span v-if="owned?.mortgaged" class="chip owner__mortgage">
              <Icon name="lock" :size="11" color="var(--accent)" />
              {{ isRu ? "В залоге" : "Mortgaged" }}
            </span>
          </div>
          <div v-if="owned && (owned.houses || owned.hotel)" class="owner__buildings">
            <span v-if="owned.hotel" class="owner__castle">
              ♖ {{ isRu ? "Отель" : "Hotel" }}
            </span>
            <span v-else-if="owned.houses > 0" class="owner__houses">
              <span v-for="n in owned.houses" :key="n">⌂</span>
            </span>
          </div>
        </div>
        <div
          v-else-if="tile.kind === 'street' || tile.kind === 'railroad' || tile.kind === 'utility'"
          class="free"
        >
          <Icon name="scroll" :size="14" color="var(--emerald)" />
          {{ isRu ? "Свободно — земля без владельца" : "Unclaimed land" }}
        </div>

        <!-- Build / sell actions -->
        <div v-if="isMineStreet && game.isMyTurn" class="actions">
          <button
            class="btn btn-primary build-btn"
            :disabled="!canBuild"
            @click="build"
          >
            <Icon :name="owned?.houses === 4 ? 'castle' : 'home'" :size="16" color="#fff" />
            <span class="build-btn__text">
              {{ owned?.houses === 4
                ? (isRu ? "Построить отель" : "Build a hotel")
                : (isRu ? "Построить дом" : "Build a house") }}
            </span>
            <span class="build-btn__cost">◈ {{ buildCost }}</span>
          </button>
          <button
            class="btn btn-ghost sell-btn"
            :disabled="!canSell"
            @click="sell"
          >
            <Icon name="coin" :size="15" color="var(--gold)" />
            <span class="build-btn__text">
              {{ isRu ? "Продать" : "Sell" }}
            </span>
            <span class="build-btn__cost">◈ {{ Math.floor(buildCost / 2) }}</span>
          </button>
          <p v-if="!hasMonopoly" class="hint">
            {{ isRu
              ? "Нужна вся цветовая группа, чтобы строить"
              : "You need the full colour group to build" }}
          </p>
          <p v-else-if="hasMonopoly && !evenBuildOk && !owned?.hotel" class="hint">
            {{ isRu
              ? "Сначала достройся на других улицах группы (равномерная стройка)"
              : "Build evenly across the group first" }}
          </p>
          <p v-else-if="(owned?.houses || owned?.hotel) && !evenSellOk" class="hint">
            {{ isRu
              ? "Сначала снеси с более застроенных улиц группы"
              : "Sell from the more-developed streets first" }}
          </p>
        </div>

        <!-- Mortgage / unmortgage (owner only, during own turn) -->
        <div v-if="isMineProperty && game.isMyTurn && (canMortgage || canUnmortgage)" class="actions">
          <button
            v-if="canMortgage"
            class="btn btn-wax"
            @click="mortgage"
          >
            <Icon name="lock" :size="15" color="#fff" />
            <span class="build-btn__text">{{ isRu ? "Заложить" : "Mortgage" }}</span>
            <span class="build-btn__cost">+ ◈ {{ mortgageValue }}</span>
          </button>
          <button
            v-if="canUnmortgage"
            class="btn btn-emerald"
            @click="unmortgage"
          >
            <Icon name="unlock" :size="15" color="#fff" />
            <span class="build-btn__text">{{ isRu ? "Выкупить из залога" : "Redeem" }}</span>
            <span class="build-btn__cost">− ◈ {{ unmortgageCost }}</span>
          </button>
        </div>

        <!-- Propose trade to the current owner -->
        <div v-if="canPropose && game.isMyTurn" class="actions">
          <div v-if="!proposeOpen">
            <button class="btn btn-primary propose-btn" @click="openPropose">
              <Icon name="trade" :size="16" color="#fff" />
              {{ isRu ? "Предложить выкуп" : "Propose a deal" }}
            </button>
          </div>
          <div v-else class="propose-form">
            <label class="propose-form__label">
              {{ isRu ? "Сколько предлагаешь?" : "Your offer" }}
              <div class="propose-form__input-wrap">
                <span class="propose-form__glyph">◈</span>
                <input
                  v-model.number="proposeCash"
                  type="number"
                  min="1"
                  :max="game.me?.cash ?? 0"
                  class="propose-form__input"
                />
              </div>
            </label>
            <div class="propose-form__row">
              <button class="btn btn-ghost" @click="proposeOpen = false">
                {{ isRu ? "Отмена" : "Cancel" }}
              </button>
              <button
                class="btn btn-primary"
                :disabled="!proposeCash || proposeCash <= 0"
                @click="sendPropose"
              >
                <Icon name="send" :size="14" color="#fff" />
                {{ isRu ? "Отправить" : "Send" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Scrim: absolute over the full viewport, sheet docked to bottom ── */
.modal-scrim {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 110;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 85dvh;
  overflow-y: auto;
  background: var(--card-alt);
  border-top: 3px solid var(--primary);
  border-radius: 16px 16px 0 0;
  padding: 14px 16px calc(20px + var(--csab, 0px));
  animation: sheet-unfurl 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom;
  position: relative;
  box-shadow: 0 -8px 24px rgba(42, 29, 16, 0.25);
}

.grab-handle {
  width: 40px;
  height: 4px;
  background: var(--line-strong);
  border-radius: 2px;
  margin: -4px auto 12px;
}

/* ── Header ── */
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 12px;
}
.head__icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.head__body {
  flex: 1;
  min-width: 0;
}
.head__kicker {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--ink-3);
  text-transform: uppercase;
  font-family: var(--font-title);
  line-height: 1;
}
.head__title {
  font-family: var(--font-display);
  font-size: 19px;
  color: var(--ink);
  line-height: 1.15;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.head__close {
  width: 32px;
  height: 32px;
}

/* ── Price row ── */
.price-row {
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 12px;
}
.price-row__label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.price-row__val {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--gold);
}

/* ── Rent table ── */
.rent {
  margin-bottom: 12px;
}
.rent__head {
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.rent__table {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.rent__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider);
  font-size: 13px;
}
.rent__row--last {
  border-bottom: none;
}
.rent__label {
  color: var(--ink-2);
}
.rent__val {
  font-family: var(--font-mono);
  color: var(--ink);
  font-weight: 600;
}

/* ── Stat grid (house / mortgage / etc) ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.stat-box {
  text-align: center;
  padding: 8px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.stat-box__label {
  font-size: 10px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.stat-box__val {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--ink);
  margin-top: 2px;
  font-weight: 600;
}

/* ── Flavor description ── */
.desc {
  padding: 12px 14px;
  background: var(--card);
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 12px;
  font-family: var(--font-display);
  font-style: italic;
}

/* ── Owner panel ── */
.owner {
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 12px;
}
.owner__head {
  font-size: 10px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 8px;
}
.owner__row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.owner__name {
  flex: 1;
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.owner__mortgage {
  background: rgba(139, 26, 26, 0.08);
  border-color: rgba(139, 26, 26, 0.3);
  color: var(--accent);
  font-weight: 600;
}
.owner__buildings {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink-2);
  display: flex;
  gap: 6px;
  align-items: center;
}
.owner__castle {
  color: var(--gold);
  font-weight: 600;
  letter-spacing: 0.05em;
}
.owner__houses {
  letter-spacing: 0.15em;
  color: var(--emerald);
  font-size: 16px;
}

/* ── Free chip ── */
.free {
  padding: 10px 12px;
  background: rgba(45, 122, 79, 0.08);
  border: 1px solid rgba(45, 122, 79, 0.3);
  border-radius: 8px;
  color: var(--emerald);
  font-size: 12px;
  font-family: var(--font-display);
  letter-spacing: 0.03em;
  text-align: center;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* ── Action blocks ── */
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.actions .btn {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  justify-content: space-between;
}
.actions .btn > :first-child {
  flex-shrink: 0;
}
.build-btn__text {
  flex: 1;
  text-align: left;
  margin-left: 4px;
}
.build-btn__cost {
  font-family: var(--font-mono);
  font-weight: 600;
  opacity: 0.92;
}
.sell-btn .build-btn__cost {
  color: var(--gold);
}
.propose-btn {
  justify-content: center;
  gap: 8px;
}

.hint {
  font-size: 11px;
  color: var(--ink-3);
  text-align: center;
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-style: italic;
  line-height: 1.3;
}

/* ── Propose form ── */
.propose-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.propose-form__label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.propose-form__input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.propose-form__input-wrap:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(90, 58, 154, 0.1);
}
.propose-form__glyph {
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
}
.propose-form__input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  outline: none;
  padding: 0;
  text-transform: none;
  letter-spacing: 0;
}
.propose-form__row {
  display: flex;
  gap: 8px;
}
.propose-form__row .btn {
  flex: 1;
  padding: 12px;
  justify-content: center;
}

/* ── Animations ── */
@keyframes sheet-unfurl {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active .modal-card,
.fade-leave-active .modal-card {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-leave-to .modal-card { transform: translateY(20%); }
</style>
