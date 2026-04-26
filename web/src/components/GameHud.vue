<script setup lang="ts">
// Ported 1:1 from the GameScreen action-bar in design-ref/screens_game.vue.js.
// HUD covers: turn banner (mirrors GameScreen's PlayerPill-active state),
// current-tile card, dice-pair + phase-aware primary action, and the
// me-card stats. All handlers come in as props from RoomView — we keep
// every phase button (rolling / buyPrompt / action) the game engine emits.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RoomState, Player } from "../../../shared/types";
import { BOARD } from "../../../shared/board";
import { useGameStore } from "../stores/game";
import Dice from "./Dice.vue";
import Icon from "./Icon.vue";

// Matches api/src/config.ts turnTimeoutSec default. If the current player
// is offline, the server auto-advances after this many seconds; we mirror
// the countdown so everyone sees the game won't freeze.
const TURN_TIMEOUT_SEC = 180;

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
  onPayJail?: () => void;
  onUseJailCard?: () => void;
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

// AFK countdown: track locally when currentTurn changes so we can show
// "auto-play in Ns" on every client when the active player is offline.
const now = ref(Date.now());
const turnStartedAt = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | null = null;
watch(
  () => props.room.currentTurn,
  () => { turnStartedAt.value = Date.now(); },
);
onMounted(() => {
  tickHandle = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => {
  if (tickHandle) clearInterval(tickHandle);
});
const afkRemainingSec = computed(() => {
  const elapsed = (now.value - turnStartedAt.value) / 1000;
  return Math.max(0, Math.ceil(TURN_TIMEOUT_SEC - elapsed));
});
const showAfkChip = computed(() =>
  !!props.current && !props.current.connected && afkRemainingSec.value > 0,
);

// ── Juice: wallet-hit cash animation ───────────────────────
// Показываемый баланс отстаёт от реального на ~1с: сначала вылетает
// красное "-100" (или зелёное "+200"), потом цифра тикает до нового значения.
// Так игрок видит сам удар, а не телепорт из 1500 в 1400.
interface CashFlight { id: number; amount: number; ts: number }
const displayCash = ref<number>(props.me?.cash ?? 0);
const cashFlights = ref<CashFlight[]>([]);
const cashPulse = ref<"up" | "down" | null>(null);
let flightSeq = 0;
let cashTween: ReturnType<typeof setInterval> | null = null;
let cashPulseTo: ReturnType<typeof setTimeout> | null = null;

function pushCashFlight(delta: number) {
  const id = ++flightSeq;
  cashFlights.value.push({ id, amount: delta, ts: Date.now() });
  setTimeout(() => {
    cashFlights.value = cashFlights.value.filter((f) => f.id !== id);
  }, 1300);
}

function tweenDisplayCash(from: number, to: number) {
  if (cashTween) { clearInterval(cashTween); cashTween = null; }
  const startAt = Date.now() + 260; // let the delta chip pop first
  const duration = 700;
  cashTween = setInterval(() => {
    const elapsed = Date.now() - startAt;
    if (elapsed < 0) return;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    displayCash.value = Math.round(from + (to - from) * eased);
    if (t >= 1) {
      displayCash.value = to;
      if (cashTween) { clearInterval(cashTween); cashTween = null; }
    }
  }, 40);
}

watch(
  () => props.me?.cash,
  (target, prev) => {
    if (target === undefined || target === null) return;
    if (prev === undefined || prev === null) {
      // First snapshot / rejoin — just sync without a flight.
      displayCash.value = target;
      return;
    }
    if (target === prev) return;
    const delta = target - prev;
    pushCashFlight(delta);
    tweenDisplayCash(displayCash.value, target);
    cashPulse.value = delta > 0 ? "up" : "down";
    if (cashPulseTo) clearTimeout(cashPulseTo);
    cashPulseTo = setTimeout(() => { cashPulse.value = null; }, 900);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (cashTween) clearInterval(cashTween);
  if (cashPulseTo) clearTimeout(cashPulseTo);
});
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
      <div v-if="showAfkChip" class="chip afk-chip">
        <span class="afk-chip__dot" />
        <span>{{
          locale === 'ru'
            ? `Авто-ход через ${afkRemainingSec}с`
            : `Auto-play in ${afkRemainingSec}s`
        }}</span>
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
        <Dice :dice="room.dice" :rolling="rolling" />
      </div>
      <div class="action-slot">
        <div v-if="animating" class="hint-card hint-card--active">
          {{ locale === 'ru' ? 'Фишка двигается…' : 'Moving…' }}
        </div>
        <template v-else-if="isMyTurn && room.phase === 'rolling'">
          <!-- Jail options: pay $50 OR use Get-Out card OR roll for doubles -->
          <template v-if="me?.inJail">
            <button
              v-if="onPayJail && me.cash >= 50"
              class="btn btn-emerald"
              @click="onPayJail"
            >
              {{ locale === 'ru' ? 'Заплатить $50' : 'Pay $50' }}
            </button>
            <button
              v-if="onUseJailCard && me.getOutCards.length > 0"
              class="btn btn-ghost"
              @click="onUseJailCard"
            >
              <Icon name="key" :size="14" color="var(--gold)" />
              {{ locale === 'ru' ? 'Карта' : 'Card' }}
            </button>
          </template>
          <button class="btn-3d btn-3d--blue" @click="onRoll">
            {{ t("game.roll") }}
          </button>
        </template>
        <template v-else-if="isMyTurn && room.phase === 'buyPrompt'">
          <button class="btn-3d btn-3d--gold" @click="onSkipBuy">
            {{ t("game.skip") }}
          </button>
          <button class="btn-3d btn-3d--green" @click="onBuy">
            {{ t("game.buy", { price: currentTilePrice }) }}
          </button>
        </template>
        <template v-else-if="isMyTurn && room.phase === 'action'">
          <button class="btn-3d btn-3d--purple" @click="onEndTurn">
            {{ t("game.endTurn") }}
          </button>
        </template>
        <div v-else class="hint-card">
          {{ t("game.closeMinimize") }}
        </div>
      </div>
    </div>

    <!-- ── Me stats (cash + properties + jail key) ──────── -->
    <div v-if="me" class="me-card card">
      <div class="me-card__row">
        <span class="me-card__label">{{ t("game.cash") }}</span>
        <span class="me-card__cash-wrap">
          <span
            :class="[
              'me-card__cash',
              cashPulse === 'up' && 'me-card__cash--up',
              cashPulse === 'down' && 'me-card__cash--down',
            ]"
          >◈ {{ displayCash }}</span>
          <span class="me-card__flights" aria-hidden="true">
            <span
              v-for="f in cashFlights"
              :key="f.id"
              :class="['cash-flight', f.amount < 0 ? 'cash-flight--down' : 'cash-flight--up']"
            >{{ f.amount > 0 ? '+' : '' }}{{ f.amount }}</span>
          </span>
        </span>
      </div>
      <div class="me-card__row">
        <span class="me-card__label">{{ t("game.properties") }}</span>
        <span class="me-card__val">{{ myPropertyCount }}</span>
      </div>
      <div v-if="me.getOutCards.length > 0" class="me-card__row">
        <span class="me-card__label">
          {{ locale === 'ru' ? 'Карта Выхода' : 'Get-Out card' }}
        </span>
        <span
          class="jail-key-chip"
          :title="locale === 'ru' ? 'Используй в тюрьме чтобы выйти бесплатно' : 'Use it in jail to skip the $50 fine'"
        >
          <Icon name="key" :size="12" color="#2a1d10" />
          <span>×&nbsp;{{ me.getOutCards.length }}</span>
        </span>
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
.afk-chip {
  background: rgba(212, 137, 46, 0.12);
  color: #8b6914;
  border-color: rgba(212, 137, 46, 0.4);
  font-variant-numeric: tabular-nums;
  animation: afk-breath 1.2s ease-in-out infinite;
}
.afk-chip__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  animation: afk-pulse 1.2s ease-in-out infinite;
}
@keyframes afk-breath {
  0%, 100% { filter: brightness(1); }
  50%      { filter: brightness(1.1); }
}
@keyframes afk-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.25); }
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
.action-slot .btn,
.action-slot .btn-3d {
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
.me-card__cash-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 1.4em;
}
.me-card__cash {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--gold);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  transition: color 0.18s, transform 0.18s;
  display: inline-block;
}
.me-card__cash--up {
  color: #1e8e3e;
  transform: scale(1.08);
}
.me-card__cash--down {
  color: #c73030;
  transform: scale(1.08);
}
/* Carrier sits to the left of the balance so flights animate over it. */
.me-card__flights {
  position: absolute;
  right: 100%;
  top: 50%;
  height: 0;
  margin-right: 8px;
  pointer-events: none;
  white-space: nowrap;
}
.cash-flight {
  position: absolute;
  right: 0;
  top: 0;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  pointer-events: none;
}
.cash-flight--up {
  color: #1e8e3e;
  animation: cash-flight-up 1.2s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}
.cash-flight--down {
  color: #c73030;
  animation: cash-flight-down 1.2s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}
@keyframes cash-flight-up {
  0%   { transform: translateY(6px) scale(0.7); opacity: 0; }
  15%  { transform: translateY(-2px) scale(1.35); opacity: 1; }
  55%  { transform: translateY(-12px) scale(1); opacity: 1; }
  100% { transform: translateY(-32px) scale(0.9); opacity: 0; }
}
@keyframes cash-flight-down {
  0%   { transform: translateY(-6px) scale(0.7); opacity: 0; }
  15%  { transform: translateY(2px) scale(1.35); opacity: 1; }
  55%  { transform: translateY(12px) scale(1); opacity: 1; }
  100% { transform: translateY(32px) scale(0.85); opacity: 0; }
}

.me-card__val {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
}

/* Get-Out-of-Jail-Free chip — gold pill so the player notices they own one. */
.jail-key-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  background: linear-gradient(180deg, var(--gold-soft) 0%, var(--gold) 100%);
  color: #2a1d10;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 2px rgba(0, 0, 0, 0.12);
  cursor: help;
}
</style>
