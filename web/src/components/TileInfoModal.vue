<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS, GROUP_SIZE } from "../../../shared/board";
import type { ColorGroup, Locale, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import TokenArt, { type TokenArtId } from "./TokenArt.vue";
import { tokenArtFor } from "../utils/palette";

const props = defineProps<{
  onBuildHouse?: (tileIndex: number) => void;
  onSellHouse?: (tileIndex: number) => void;
  onProposeTrade?: (tileIndex: number) => void;
  onMortgage?: (tileIndex: number) => void;
  onUnmortgage?: (tileIndex: number) => void;
}>();

const { locale } = useI18n();
const game = useGameStore();

const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const isRu = computed(() => loc.value === "ru");

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

const bandColor = computed<string | null>(() => {
  const t = tile.value;
  if (!t || t.kind !== "street") return null;
  return GROUP_COLORS[t.group] ?? null;
});

// Group → localised "Квартал" label shown in the badge at top of the card.
const GROUP_LABEL_RU: Record<ColorGroup, string> = {
  brown: "Коричневый квартал",
  lightBlue: "Голубой квартал",
  pink: "Розовый квартал",
  orange: "Оранжевый квартал",
  red: "Красный квартал",
  yellow: "Жёлтый квартал",
  green: "Зелёный квартал",
  darkBlue: "Синий квартал",
};
const GROUP_LABEL_EN: Record<ColorGroup, string> = {
  brown: "Brown district",
  lightBlue: "Light blue district",
  pink: "Pink district",
  orange: "Orange district",
  red: "Red district",
  yellow: "Yellow district",
  green: "Green district",
  darkBlue: "Dark blue district",
};
// Groups where the badge needs white text (dark fill). Light fills use black.
const DARK_GROUPS: ColorGroup[] = ["brown", "red", "green", "darkBlue"];

const groupLabel = computed<string | null>(() => {
  const t = tile.value;
  if (!t || t.kind !== "street") return null;
  const g = (t as StreetTile).group;
  return (isRu.value ? GROUP_LABEL_RU[g] : GROUP_LABEL_EN[g]) ?? null;
});
const groupBadgeStyle = computed(() => {
  const t = tile.value;
  if (!t || t.kind !== "street") {
    return { background: "#7dd3fc", color: "#000", textShadow: "none" };
  }
  const g = (t as StreetTile).group;
  const dark = DARK_GROUPS.includes(g);
  return {
    background: GROUP_COLORS[g] ?? "#7dd3fc",
    color: dark ? "#fff" : "#000",
    textShadow: dark ? "0.4px 0.4px 0 rgba(0,0,0,0.6)" : "none",
  };
});

interface RentRow { label: string; value: number }

const rentRows = computed<RentRow[]>(() => {
  const t = tile.value;
  if (!t) return [];
  if (t.kind === "street") {
    const s = t as StreetTile;
    return [
      { label: isRu.value ? "Базовая"   : "Base",     value: s.rent[0] },
      { label: isRu.value ? "Монополия" : "Monopoly", value: s.rent[0] * 2 },
      { label: isRu.value ? "1 дом"     : "1 house",  value: s.rent[1] },
      { label: isRu.value ? "2 дома"    : "2 houses", value: s.rent[2] },
      { label: isRu.value ? "3 дома"    : "3 houses", value: s.rent[3] },
      { label: isRu.value ? "4 дома"    : "4 houses", value: s.rent[4] },
      { label: isRu.value ? "Отель"     : "Hotel",    value: s.rent[5] },
    ];
  }
  if (t.kind === "railroad") {
    return [
      { label: isRu.value ? "1 ж/д" : "1 RR", value: 25 },
      { label: isRu.value ? "2 ж/д" : "2 RR", value: 50 },
      { label: isRu.value ? "3 ж/д" : "3 RR", value: 100 },
      { label: isRu.value ? "4 ж/д" : "4 RR", value: 200 },
    ];
  }
  return [];
});

const description = computed<string | null>(() => {
  const t = tile.value;
  if (!t) return null;
  switch (t.kind) {
    case "go":          return isRu.value ? "Проходя — получи 200" : "Collect 200 when you pass";
    case "jail":        return isRu.value ? "Тюрьма / В гостях" : "Jail / Just Visiting";
    case "goToJail":    return isRu.value ? "Отправляешься в тюрьму без сбора 200" : "Go to Jail — do not pass GO";
    case "freeParking": return isRu.value ? "Просто отдых — ничего не происходит" : "Rest — no effect";
    case "tax":         return isRu.value ? `Заплати ${t.amount}` : `Pay ${t.amount}`;
    case "chance":      return isRu.value ? "Тяни карту Шанс" : "Draw a Chance card";
    case "chest":       return isRu.value ? "Тяни карту Казны" : "Draw a Community Chest card";
    case "utility":     return isRu.value
      ? "Аренда = значение на кубиках × 4 (×10 с монополией)"
      : "Rent = dice roll × 4 (×10 with monopoly)";
    default: return null;
  }
});

function close() { game.selectTile(null); }

const isMineStreet = computed(() => {
  const t = tile.value;
  const o = owned.value;
  const me = game.me;
  return t?.kind === "street" && !!o && !!me && o.ownerId === me.id;
});

const hasMonopoly = computed(() => {
  const t = tile.value;
  if (!t || t.kind !== "street" || !game.room || !owned.value) return false;
  const group = (t as StreetTile).group;
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

const bankHasSupply = computed(() => {
  const r = game.room;
  if (!r) return true;
  const o = owned.value;
  if (!o) return true;
  return o.houses >= 4 ? r.hotelBank > 0 : r.houseBank > 0;
});

// Дом: build next house (only when fewer than 4).
const canBuildHouse = computed(() => {
  if (!isMineStreet.value || !hasMonopoly.value) return false;
  const o = owned.value;
  if (!o || o.mortgaged) return false;
  if (o.hotel || o.houses >= 4) return false;
  if (!bankHasSupply.value) return false;
  return evenBuildOk.value;
});
// Отель: upgrade 4 houses → hotel.
const canBuildHotel = computed(() => {
  if (!isMineStreet.value || !hasMonopoly.value) return false;
  const o = owned.value;
  if (!o || o.mortgaged) return false;
  if (o.hotel || o.houses < 4) return false;
  if (!bankHasSupply.value) return false;
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

function build() { if (tile.value) props.onBuildHouse?.(tile.value.index); }
function sell()  { if (tile.value) props.onSellHouse?.(tile.value.index); }

const canPropose = computed(() => {
  const o = owned.value;
  const me = game.me;
  if (!o || !me || o.ownerId === me.id) return false;
  if (o.mortgaged) return false;
  return true;
});
function openPropose() { if (tile.value) props.onProposeTrade?.(tile.value.index); }

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
  return (t as { mortgage?: number }).mortgage ?? 0;
});
const unmortgageCost = computed(() => Math.ceil(mortgageValue.value * 1.1));

function toggleMortgage() {
  if (!tile.value) return;
  if (canUnmortgage.value) props.onUnmortgage?.(tile.value.index);
  else if (canMortgage.value) props.onMortgage?.(tile.value.index);
}

const isProperty = computed(() => {
  const t = tile.value;
  return !!t && (t.kind === "street" || t.kind === "railroad" || t.kind === "utility");
});

// Build/sell hint: explains why the Дом button is inactive.
const buildHint = computed<string | null>(() => {
  if (!isMineStreet.value || !game.isMyTurn) return null;
  if (!hasMonopoly.value) {
    return isRu.value ? "Нужен весь цветовой квартал" : "You need the full colour group";
  }
  if (hasMonopoly.value && !evenBuildOk.value && !owned.value?.hotel) {
    return isRu.value ? "Сначала достройся равномерно" : "Build evenly across the group first";
  }
  if ((owned.value?.houses || owned.value?.hotel) && !evenSellOk.value) {
    return isRu.value ? "Сначала снеси с других улиц группы" : "Sell from more-developed streets first";
  }
  if (hasMonopoly.value && !bankHasSupply.value) {
    return owned.value?.houses === 4
      ? (isRu.value ? "В банке закончились отели" : "No hotels left in the bank")
      : (isRu.value ? "В банке закончились дома" : "No houses left in the bank");
  }
  return null;
});

// Label for the combined Дом button — swaps to "Продать" when the tile
// has 1-4 houses or a hotel and the even-sell rule is satisfied. This
// keeps the 3-button Figma layout useful even after building has peaked.
const houseButton = computed(() => {
  if (canBuildHouse.value) {
    return { label: isRu.value ? "Дом" : "House", cost: buildCost.value, onClick: build, enabled: true };
  }
  if (canSell.value) {
    return { label: isRu.value ? "Продать" : "Sell", cost: Math.floor(buildCost.value / 2), onClick: sell, enabled: true };
  }
  return { label: isRu.value ? "Дом" : "House", cost: buildCost.value, onClick: build, enabled: false };
});
const mortgageButton = computed(() => {
  if (canUnmortgage.value) {
    return { label: isRu.value ? "Выкуп" : "Redeem", cost: unmortgageCost.value, enabled: true };
  }
  return { label: isRu.value ? "Залог" : "Mortgage", cost: mortgageValue.value, enabled: canMortgage.value };
});

// Owner's token figure for the red "ВЛАДЕЛЕЦ" banner. Falls back to the
// knight silhouette when the player never picked a shop token.
const ownerTokenId = computed<TokenArtId>(() => tokenArtFor(owner.value?.token || "knight"));
</script>

<template>
  <transition name="info-fade">
    <div v-if="tile" class="info-scrim" @click="close">
      <div class="info-wrap" @click.stop>
        <div class="info-card">
          <!-- Decorative isometric house at top of the property card,
               matching the Figma hero art (32:3273 / 61:615). -->
          <div v-if="isProperty" class="info-hero" aria-hidden="true">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <!-- Ground shadow -->
              <ellipse cx="40" cy="68" rx="26" ry="4" fill="rgba(0,0,0,0.08)"/>
              <!-- Right wall (shaded) -->
              <path d="M40 26 L64 38 L64 60 L40 66 Z" fill="#c77a5a" stroke="#3a2418" stroke-width="1.6" stroke-linejoin="round"/>
              <!-- Left wall -->
              <path d="M40 26 L16 38 L16 60 L40 66 Z" fill="#e6a98a" stroke="#3a2418" stroke-width="1.6" stroke-linejoin="round"/>
              <!-- Roof -->
              <path d="M40 16 L68 30 L40 34 L12 30 Z" fill="#6a4030" stroke="#2a1808" stroke-width="1.6" stroke-linejoin="round"/>
              <path d="M40 16 L40 34" stroke="#2a1808" stroke-width="1.4"/>
              <!-- Windows (left) -->
              <rect x="22" y="42" width="6" height="8" fill="#fff4c2" stroke="#3a2418" stroke-width="1"/>
              <rect x="30" y="42" width="6" height="8" fill="#fff4c2" stroke="#3a2418" stroke-width="1"/>
              <!-- Door (right face) -->
              <path d="M46 48 L52 46 L52 62 L46 60 Z" fill="#3a2418"/>
              <!-- Chimney -->
              <rect x="52" y="18" width="5" height="8" fill="#c77a5a" stroke="#2a1808" stroke-width="1"/>
            </svg>
          </div>

          <!-- Header: group badge + title + cost -->
          <div class="info-head">
            <span
              v-if="groupLabel"
              class="info-group"
              :style="groupBadgeStyle"
            >{{ groupLabel }}</span>
            <div class="info-name">{{ tile.name[loc] }}</div>
            <div v-if="isProperty" class="info-cost">
              <span>{{ isRu ? "Стоимость" : "Price" }}</span>
              <img src="/figma/room/icon-money.webp" alt="" />
              <b>{{ 'price' in tile ? tile.price : 0 }}</b>
            </div>
          </div>

          <!-- Owner state -->
          <div v-if="isProperty && !owner" class="info-free">
            {{ isRu ? "Владельца нет" : "Unclaimed land" }}
          </div>
          <div v-else-if="owner" class="info-owner">
            <div class="info-owner__label">{{ isRu ? "Владелец" : "Owner" }}</div>
            <div class="info-owner__row">
              <span class="info-owner__token" :style="{ background: owner.color }">
                <TokenArt :id="ownerTokenId" :size="24" color="#fff" shadow="rgba(0,0,0,0.55)"/>
              </span>
              <span class="info-owner__name">{{ owner.name }}</span>
              <span v-if="owned?.mortgaged" class="info-owner__chip">
                {{ isRu ? "В залоге" : "Mortgaged" }}
              </span>
              <span v-else-if="owned?.hotel" class="info-owner__chip info-owner__chip--ok">
                {{ isRu ? "Отель" : "Hotel" }}
              </span>
              <span v-else-if="owned && owned.houses > 0" class="info-owner__chip info-owner__chip--ok">
                {{ owned.houses }} {{ isRu ? "дом." : "houses" }}
              </span>
            </div>
          </div>

          <!-- Flavor text for non-property tiles -->
          <div v-if="description && !isProperty" class="info-free">{{ description }}</div>

          <!-- Rent table -->
          <div v-if="rentRows.length" class="rent-table">
            <div
              v-for="(r, i) in rentRows"
              :key="r.label"
              class="rent-row"
              :class="{ 'rent-row--alt': i % 2 === 0 }"
            >
              <span class="rent-row__label">{{ r.label }}</span>
              <span class="rent-row__val">
                <img src="/figma/room/icon-money.webp" alt="" />
                <b>{{ r.value }}</b>
              </span>
            </div>
          </div>

          <!-- Bottom action buttons: Дом / Отель / Залог.
               Shown when the player owns the tile and it's a property. -->
          <div v-if="isMineProperty && game.isMyTurn" class="action-grid">
            <button
              v-if="tile.kind === 'street'"
              class="action-btn"
              :disabled="!houseButton.enabled"
              @click="houseButton.onClick"
            >
              <span class="action-btn__label">{{ houseButton.label }}</span>
              <span class="action-btn__cost">
                <img src="/figma/room/icon-money.webp" alt="" />
                <b>{{ houseButton.cost }}</b>
              </span>
            </button>
            <button
              v-if="tile.kind === 'street'"
              class="action-btn"
              :disabled="!canBuildHotel"
              @click="build"
            >
              <span class="action-btn__label">{{ isRu ? "Отель" : "Hotel" }}</span>
              <span class="action-btn__cost">
                <img src="/figma/room/icon-money.webp" alt="" />
                <b>{{ buildCost }}</b>
              </span>
            </button>
            <button
              class="action-btn"
              :disabled="!mortgageButton.enabled"
              @click="toggleMortgage"
            >
              <span class="action-btn__label">{{ mortgageButton.label }}</span>
              <span class="action-btn__cost">
                <img src="/figma/room/icon-money.webp" alt="" />
                <b>{{ mortgageButton.cost }}</b>
              </span>
            </button>
          </div>

          <!-- Hint (why Дом is disabled) -->
          <p v-if="buildHint" class="info-hint">{{ buildHint }}</p>

          <!-- Propose trade (non-owner) -->
          <button
            v-if="canPropose && game.isMyTurn"
            class="propose-btn btn-3d btn-3d--blue"
            @click="openPropose"
          >{{ isRu ? "Предложить обмен" : "Propose a trade" }}</button>
        </div>

        <!-- Floating close button -->
        <button class="info-close" @click="close" aria-label="close">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="#000"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.info-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  /* Above Chat (120) so a chat tap mid-modal doesn't cover the
     property card. RouteLoader is 90, TourOverlay is 600 — modal
     fits cleanly between Chat and Tour. */
  z-index: 130;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(16px + var(--csab, 0px));
}

.info-wrap {
  position: relative;
  width: 100%;
  max-width: 345px;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-height: calc(100vh - 32px - var(--csab, 0px));
}

.info-card {
  width: 100%;
  background: #faf3e2;
  border-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  font-family: 'Unbounded', sans-serif;
  color: #000;
}

/* ── Hero: isometric house above title (Figma popup-info art) ── */
.info-hero {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  line-height: 0;
}

/* ── Header ── */
.info-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.info-group {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
}
.info-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  word-break: break-word;
}
.info-cost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.info-cost img { width: 24px; height: 24px; object-fit: contain; }

/* ── Owner / free ── */
.info-free {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px;
  border: 1.4px dashed rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
  text-align: center;
}
/* Owner banner — Figma "popup-info" owner state (61:615): red centered pill,
   "ВЛАДЕЛЕЦ" label stacked above the token+name row. */
.info-owner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #e2776e;
  border-radius: 12px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 #000;
}
.info-owner__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #fff;
}
.info-owner__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}
.info-owner__token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3),
              inset 0 -1px 1px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}
.info-owner__token :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.info-owner__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.info-owner__chip {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 11px;
  white-space: nowrap;
  text-shadow: none;
}
.info-owner__chip--ok {
  background: #4ed636;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.5);
}

/* ── Rent table — Figma 32:3273 / 61:615: clean rows with thin
   separators on a transparent surface (lets the parchment card
   bleed through) instead of the previous boxed/alternating fill. */
.rent-table {
  border-radius: 12px;
  overflow: hidden;
}
.rent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.rent-row:last-child { border-bottom: none; }
.rent-row--alt { background: transparent; }
.rent-row__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #484337;
}
.rent-row__val {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #484337;
}
.rent-row__val img { width: 24px; height: 24px; object-fit: contain; }

/* ── Action grid (Дом / Отель / Залог) ── */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.action-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  padding: 6px 10px;
  background: #43c22d;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  color: #fff;
  cursor: pointer;
  /* Figma 32:3273 buttons carry an inset bottom shadow for the
     3D pill look. The shadow shrinks on press for haptic feedback. */
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  transition: transform 80ms, filter 120ms, box-shadow 80ms;
}
.action-btn:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}
.action-btn:disabled {
  filter: grayscale(0.6) brightness(0.92);
  cursor: not-allowed;
}
.action-btn__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
}
.action-btn__cost {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
}
.action-btn__cost img { width: 24px; height: 24px; object-fit: contain; }
.action-btn__cost b { font-weight: 900; }

.info-hint {
  margin: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.55);
  text-align: center;
}

.propose-btn {
  width: 100%;
  font-family: 'Golos Text', sans-serif;
}

/* ── Floating close button — Figma 138:16662 / 75:5658: 44px white
   circle, 4.125px black border, no offset shadow. Sits centered
   below the card with breathing room. */
.info-close {
  margin-top: 16px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: 4px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 80ms;
}
.info-close:active { transform: scale(0.94); }

/* ── Transitions ── */
.info-fade-enter-active, .info-fade-leave-active { transition: opacity 0.2s ease; }
.info-fade-enter-from, .info-fade-leave-to { opacity: 0; }
.info-fade-enter-active .info-wrap,
.info-fade-leave-active .info-wrap {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.info-fade-enter-from .info-wrap,
.info-fade-leave-to .info-wrap { transform: scale(0.96); }
</style>
