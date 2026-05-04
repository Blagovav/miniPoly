<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, Player, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { capTypeFor } from "../shop/cosmetics";
import Icon from "./Icon.vue";

export interface TradePayload {
  toId: string;
  giveTiles: number[];
  giveCash: number;
  giveJailCards: number;
  takeTiles: number[];
  takeCash: number;
  takeJailCards: number;
}

const props = defineProps<{
  open: boolean;
  initialTargetId?: string | null;
  initialTakeTile?: number | null;
  onClose: () => void;
  onSubmit: (payload: TradePayload) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const isRu = computed(() => locale.value === "ru");
const game = useGameStore();

const targetId = ref<string | null>(null);
const giveTiles = ref<Set<number>>(new Set());
const takeTiles = ref<Set<number>>(new Set());
const giveCash = ref(0);
const takeCash = ref(0);
const giveJail = ref(0);
const takeJail = ref(0);

function resetForm() {
  targetId.value = props.initialTargetId ?? null;
  giveTiles.value = new Set();
  takeTiles.value = new Set();
  giveCash.value = 0;
  takeCash.value = 0;
  giveJail.value = 0;
  takeJail.value = 0;
  if (props.initialTakeTile != null) {
    const owned = game.room?.properties[props.initialTakeTile];
    if (owned) {
      targetId.value = owned.ownerId;
      takeTiles.value = new Set([props.initialTakeTile]);
    }
  }
}

watch(() => props.open, (o) => {
  if (o) resetForm();
});

const me = computed(() => game.me);

const candidates = computed<Player[]>(() => {
  if (!game.room || !me.value) return [];
  return game.room.players.filter((p) => p.id !== me.value!.id && !p.bankrupt);
});

const target = computed<Player | null>(() => {
  const id = targetId.value;
  if (!id || !game.room) return null;
  return game.room.players.find((p) => p.id === id) ?? null;
});

function playerColor(p: Player): string {
  return p.color || "var(--ink-3)";
}
function playerCapSrc(p: Player): string {
  return `/figma/shop/caps/${capTypeFor(p.token)}.webp`;
}

interface HoldingRow {
  index: number;
  name: string;
  band: string;
  mortgaged: boolean;
  price: number;
}

function holdingsOf(playerId: string): HoldingRow[] {
  if (!game.room) return [];
  const rows: HoldingRow[] = [];
  for (const prop of Object.values(game.room.properties)) {
    if (prop.ownerId !== playerId) continue;
    const t = BOARD[prop.tileIndex];
    if (t.kind !== "street" && t.kind !== "railroad" && t.kind !== "utility") continue;
    rows.push({
      index: prop.tileIndex,
      name: t.name[loc.value],
      band: t.kind === "street" ? GROUP_COLORS[(t as StreetTile).group] : "var(--ink-3)",
      mortgaged: prop.mortgaged,
      price: (t as { price?: number }).price ?? 0,
    });
  }
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

const myHoldings = computed(() => (me.value ? holdingsOf(me.value.id) : []));
const theirHoldings = computed(() => (target.value ? holdingsOf(target.value.id) : []));

function toggleGive(idx: number, mortgaged: boolean) {
  if (mortgaged) return;
  const s = new Set(giveTiles.value);
  if (s.has(idx)) s.delete(idx);
  else s.add(idx);
  giveTiles.value = s;
}
function toggleTake(idx: number, mortgaged: boolean) {
  if (mortgaged) return;
  const s = new Set(takeTiles.value);
  if (s.has(idx)) s.delete(idx);
  else s.add(idx);
  takeTiles.value = s;
}

const myCashMax = computed(() => me.value?.cash ?? 0);
const theirCashMax = computed(() => target.value?.cash ?? 0);
const myJailMax = computed(() => me.value?.getOutCards.length ?? 0);
const theirJailMax = computed(() => target.value?.getOutCards.length ?? 0);

function clampInt(v: number | string, min: number, max: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : Math.floor(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

watch(giveCash, (v) => { giveCash.value = clampInt(v, 0, myCashMax.value); });
watch(takeCash, (v) => { takeCash.value = clampInt(v, 0, theirCashMax.value); });
watch(giveJail, (v) => { giveJail.value = clampInt(v, 0, myJailMax.value); });
watch(takeJail, (v) => { takeJail.value = clampInt(v, 0, theirJailMax.value); });

watch(targetId, () => {
  takeTiles.value = new Set();
  takeCash.value = 0;
  takeJail.value = 0;
});

const hasOffer = computed(() =>
  giveTiles.value.size + takeTiles.value.size + giveCash.value + takeCash.value + giveJail.value + takeJail.value > 0,
);

const canSubmit = computed(() => !!target.value && hasOffer.value && game.isMyTurn);

// Tooltip-ish label so the user understands why the CTA is greyed out.
// Designer-feedback report flagged that "обмен не работает" was actually
// the disabled CTA being silent — now we surface the reason visibly.
const blockedReason = computed(() => {
  if (game.isMyTurn === false) return isRu.value ? "Обмен только в свой ход" : "Trade only on your turn";
  if (!target.value) return isRu.value ? "Выбери адресата" : "Pick a recipient";
  if (!hasOffer.value) return isRu.value ? "Добавь хотя бы одну позицию" : "Add at least one item";
  return "";
});

function submit() {
  if (!canSubmit.value || !target.value) return;
  props.onSubmit({
    toId: target.value.id,
    giveTiles: Array.from(giveTiles.value),
    giveCash: giveCash.value,
    giveJailCards: giveJail.value,
    takeTiles: Array.from(takeTiles.value),
    takeCash: takeCash.value,
    takeJailCards: takeJail.value,
  });
}

const L = computed(() => isRu.value
  ? {
      eyebrow: "Отправка гонца",
      title: "Предложение обмена",
      addressee: "Адресат",
      noCandidates: "Нет игроков для обмена",
      mine: "Я отдаю",
      theirs: "Я получаю",
      selectTarget: "Выбери игрока",
      empty: "Нет улиц",
      confirm: "ПОДТВЕРДИТЬ",
    }
  : {
      eyebrow: "Send messenger",
      title: "Trade offer",
      addressee: "To",
      noCandidates: "No players to trade with",
      mine: "I give",
      theirs: "I receive",
      selectTarget: "Pick a player",
      empty: "No streets",
      confirm: "CONFIRM",
    });
</script>

<template>
  <transition name="trade-fade">
    <div v-if="open" class="trade-scrim" role="dialog" aria-modal="true" @click.self="onClose">
      <div class="trade-stack">
        <div class="trade-card">
          <div class="trade-head">
            <span class="trade-eyebrow">{{ L.eyebrow }}</span>
            <h2 class="trade-title">{{ L.title }}</h2>
          </div>

          <div class="trade-addressee">
            <div class="trade-addressee__label">{{ L.addressee }}</div>
            <div v-if="candidates.length === 0" class="trade-empty">{{ L.noCandidates }}</div>
            <div v-else class="trade-addressee__row">
              <button
                v-for="p in candidates"
                :key="p.id"
                type="button"
                class="trade-pill"
                :class="{ 'trade-pill--active': targetId === p.id }"
                :style="{ background: playerColor(p) }"
                @click="targetId = p.id"
              >
                <span class="trade-pill__sigil">
                  <img :src="playerCapSrc(p)" alt="" draggable="false"/>
                </span>
                <span class="trade-pill__body">
                  <span class="trade-pill__name">{{ p.name }}</span>
                  <span class="trade-pill__cash">
                    <img class="trade-pill__cash-icon" src="/figma/room/icon-money.webp" alt="" aria-hidden="true"/>
                    {{ p.cash }}
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div class="trade-cols">
            <div class="trade-col">
              <div class="trade-col__label">{{ L.mine }}</div>

              <div v-if="myHoldings.length === 0" class="trade-col__empty">{{ L.empty }}</div>
              <div v-else class="trade-col__list">
                <button
                  v-for="h in myHoldings"
                  :key="h.index"
                  type="button"
                  class="trade-row"
                  :class="{ 'trade-row--active': giveTiles.has(h.index), 'trade-row--locked': h.mortgaged }"
                  :disabled="h.mortgaged"
                  @click="toggleGive(h.index, h.mortgaged)"
                >
                  <span class="trade-row__dot" :style="{ background: h.band }" />
                  <span class="trade-row__name">{{ h.name }}</span>
                </button>
              </div>

              <div class="trade-input">
                <img class="trade-input__icon" src="/figma/room/icon-money.webp" alt="" aria-hidden="true"/>
                <input
                  v-model.number="giveCash"
                  type="number"
                  min="0"
                  :max="myCashMax"
                  inputmode="numeric"
                  class="trade-input__field"
                />
                <span class="trade-input__max">/{{ myCashMax }}</span>
              </div>

              <div v-if="myJailMax > 0" class="trade-input">
                <img class="trade-input__icon" src="/figma/room/tile-jail.webp" alt="" aria-hidden="true"/>
                <input
                  v-model.number="giveJail"
                  type="number"
                  min="0"
                  :max="myJailMax"
                  inputmode="numeric"
                  class="trade-input__field"
                />
                <span class="trade-input__max">/{{ myJailMax }}</span>
              </div>
            </div>

            <div class="trade-col">
              <div class="trade-col__label">{{ L.theirs }}</div>

              <div v-if="!target" class="trade-col__empty">{{ L.selectTarget }}</div>
              <template v-else>
                <div v-if="theirHoldings.length === 0" class="trade-col__empty">{{ L.empty }}</div>
                <div v-else class="trade-col__list">
                  <button
                    v-for="h in theirHoldings"
                    :key="h.index"
                    type="button"
                    class="trade-row"
                    :class="{ 'trade-row--active': takeTiles.has(h.index), 'trade-row--locked': h.mortgaged }"
                    :disabled="h.mortgaged"
                    @click="toggleTake(h.index, h.mortgaged)"
                  >
                    <span class="trade-row__dot" :style="{ background: h.band }" />
                    <span class="trade-row__name">{{ h.name }}</span>
                  </button>
                </div>

                <div class="trade-input">
                  <img class="trade-input__icon" src="/figma/room/icon-money.webp" alt="" aria-hidden="true"/>
                  <input
                    v-model.number="takeCash"
                    type="number"
                    min="0"
                    :max="theirCashMax"
                    inputmode="numeric"
                    class="trade-input__field"
                  />
                  <span class="trade-input__max">/{{ theirCashMax }}</span>
                </div>

                <div v-if="theirJailMax > 0" class="trade-input">
                  <img class="trade-input__icon" src="/figma/room/tile-jail.webp" alt="" aria-hidden="true"/>
                  <input
                    v-model.number="takeJail"
                    type="number"
                    min="0"
                    :max="theirJailMax"
                    inputmode="numeric"
                    class="trade-input__field"
                  />
                  <span class="trade-input__max">/{{ theirJailMax }}</span>
                </div>
              </template>
            </div>
          </div>

          <div v-if="blockedReason" class="trade-warn">{{ blockedReason }}</div>

          <button
            class="trade-cta"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ L.confirm }}
          </button>
        </div>

        <button class="trade-close" @click="onClose" aria-label="close">
          <Icon name="x" :size="20" color="#000"/>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.trade-scrim {
  position: fixed;
  inset: 0;
  z-index: 510;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: calc(16px + var(--sat, 0px)) 24px calc(16px + var(--sab, 0px) + var(--csab, 0px));
}

.trade-fade-enter-active,
.trade-fade-leave-active { transition: opacity 0.2s ease; }
.trade-fade-enter-from,
.trade-fade-leave-to { opacity: 0; }

.trade-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  width: 100%;
  max-width: 345px;
  margin: 0 auto;
  /* Stack itself fills the available height; the inner card grows up to
     this much, and only the holdings columns scroll internally so the
     header (eyebrow + title + addressee) stays visible. */
  max-height: calc(100vh - 80px);
  min-height: 0;
}

.trade-card {
  background: var(--card-alt);
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Card fills the stack height; flex children with min-height: 0 inside
     trade-cols give the property lists their own scroll context. */
  flex: 1 1 auto;
  min-height: 0;
}

.trade-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.trade-eyebrow {
  display: inline-flex;
  padding: 4px 12px;
  background: #484337;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
}
.trade-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
}

/* Trade-warn now lives just above the CTA so the user sees the reason the
   button is disabled (not-your-turn / no-recipient / empty offer). Replaces
   the silent grey button that read as "обмен не работает" in playtest. */
.trade-warn {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 12px;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 14px;
  color: #8b1a1a;
}

.trade-addressee {
  flex-shrink: 0;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.trade-addressee__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.trade-addressee__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.trade-pill {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 8px 8px;
  border: 2px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  box-shadow: inset 0 -3px 0 0 rgba(0, 0, 0, 0.2);
  transition: transform 80ms ease, border-color 120ms ease;
}
.trade-pill--active { border-color: #000; }
.trade-pill:active { transform: translateY(1px); }
.trade-pill__sigil {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.28);
  overflow: hidden;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3),
              inset 0 -1px 1px rgba(0, 0, 0, 0.25);
}
.trade-pill__sigil img {
  width: 110%;
  height: 110%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
  pointer-events: none;
  user-select: none;
}
.trade-pill__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  min-width: 0;
  text-align: left;
}
.trade-pill__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trade-pill__cash {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.5);
}
.trade-pill__cash-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.trade-empty {
  padding: 8px 0;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
}

/* Two-column bargain. Each column is its own flex container; the inner
   property list scrolls so the cash/jail inputs and the column title
   never escape the viewport. */
.trade-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  flex: 1 1 auto;
  min-height: 180px;
}
.trade-col {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}
.trade-col__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  padding: 0 4px;
  flex-shrink: 0;
}
.trade-col__empty {
  padding: 6px 4px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
  flex-shrink: 0;
}
.trade-col__list {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scrollbar-width: thin;
}
.trade-col__list::-webkit-scrollbar { width: 3px; }
.trade-col__list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 2px;
}

.trade-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  flex-shrink: 0;
  transition: background 120ms ease, border-color 120ms ease;
}
.trade-row:hover { background: rgba(0, 0, 0, 0.04); }
.trade-row--active {
  background: rgba(67, 194, 45, 0.18);
  border-color: rgba(67, 194, 45, 0.6);
}
.trade-row--locked { opacity: 0.45; cursor: not-allowed; }
.trade-row__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.trade-row__name {
  flex: 1 1 0;
  min-width: 0;
  font-family: 'Golos UI', 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #484337;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trade-input {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.trade-input__icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  object-fit: contain;
  pointer-events: none;
}
.trade-input__field {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  text-align: right;
  outline: none;
  -moz-appearance: textfield;
}
.trade-input__field::-webkit-outer-spin-button,
.trade-input__field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.trade-input__field:focus { border-color: rgba(0, 0, 0, 0.4); }
.trade-input__field::placeholder { opacity: 0.4; }
.trade-input__max {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 14px;
  color: #000;
  flex-shrink: 0;
}

/* Per Figma 75:5309 the CTA is fixed 297px wide, centred. */
.trade-cta {
  align-self: center;
  width: 297px;
  max-width: 100%;
  height: 56px;
  padding: 0 18px;
  border: 2px solid #000;
  border-radius: 18px;
  background: #43c22d;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease, filter 120ms ease;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 24px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.01em;
  flex-shrink: 0;
}
.trade-cta:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.trade-cta:disabled {
  filter: grayscale(0.5) brightness(0.8);
  cursor: not-allowed;
}

.trade-close {
  width: 44px;
  height: 44px;
  align-self: center;
  background: #fff;
  border: 4.125px solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s ease;
  padding: 0;
  margin-top: 4px;
  flex-shrink: 0;
}
.trade-close:active { transform: scale(0.94); }
</style>
