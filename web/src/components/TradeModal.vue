<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, Player, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";

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
  // Preselect a target player when opened from the profile modal.
  initialTargetId?: string | null;
  // Preselect a tile on "their" side when opened from TileInfoModal.
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

// Re-seed the form every time the modal opens.
watch(() => props.open, (o) => {
  if (o) resetForm();
});

const me = computed(() => game.me);

// Eligible recipients: everyone else alive, not me, not bankrupt.
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
  if (!game.room) return "var(--ink-3)";
  const idx = game.room.players.findIndex((pp) => pp.id === p.id);
  return idx >= 0 ? ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length] : "var(--ink-3)";
}

interface HoldingRow {
  index: number;
  name: string;
  band: string;
  houses: number;
  hotel: boolean;
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
      houses: prop.houses,
      hotel: prop.hotel,
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
const myJailMax = computed(() => me.value?.getOutCards ?? 0);
const theirJailMax = computed(() => target.value?.getOutCards ?? 0);

function clampInt(v: number | string, min: number, max: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : Math.floor(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// Keep inputs in bounds reactively (paste / arrow spam).
watch(giveCash, (v) => { giveCash.value = clampInt(v, 0, myCashMax.value); });
watch(takeCash, (v) => { takeCash.value = clampInt(v, 0, theirCashMax.value); });
watch(giveJail, (v) => { giveJail.value = clampInt(v, 0, myJailMax.value); });
watch(takeJail, (v) => { takeJail.value = clampInt(v, 0, theirJailMax.value); });

// Switching target wipes their side selections (tile sets are per-player).
watch(targetId, () => {
  takeTiles.value = new Set();
  takeCash.value = 0;
  takeJail.value = 0;
});

const hasOffer = computed(() =>
  giveTiles.value.size + takeTiles.value.size + giveCash.value + takeCash.value + giveJail.value + takeJail.value > 0,
);

const canSubmit = computed(() => !!target.value && hasOffer.value && game.isMyTurn);

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
      title: "Предложение обмена",
      subtitle: "В свой ход — отправь гонца",
      pick: "Кому предложить",
      noCandidates: "Нет игроков для обмена",
      mine: "Я отдаю",
      theirs: "Я получаю",
      cash: "Монет",
      jail: "Карточек «Выйти из тюрьмы»",
      empty: "— нет улиц —",
      selectTarget: "Сначала выбери игрока",
      send: "Отправить",
      cancel: "Отмена",
      notYourTurn: "Обмен — только в свой ход",
      mortgaged: "в залоге",
      tileLabel: (n: string) => n,
    }
  : {
      title: "Propose a trade",
      subtitle: "On your turn — send a messenger",
      pick: "Propose to",
      noCandidates: "No players to trade with",
      mine: "I give",
      theirs: "I receive",
      cash: "Coin",
      jail: "Jail cards",
      empty: "— no streets —",
      selectTarget: "Pick a player first",
      send: "Send",
      cancel: "Cancel",
      notYourTurn: "Trade only on your turn",
      mortgaged: "mortgaged",
      tileLabel: (n: string) => n,
    });
</script>

<template>
  <transition name="fade">
    <div v-if="open" class="modal-scrim" @click="onClose">
      <div class="modal-card" @click.stop>
        <div class="grab-handle" />

        <div class="head">
          <div>
            <div class="head__eyebrow">{{ L.subtitle }}</div>
            <div class="head__title">{{ L.title }}</div>
          </div>
          <button class="icon-btn head__close" :aria-label="'close'" @click="onClose">
            <Icon name="x" :size="16" color="var(--ink-2)" />
          </button>
        </div>

        <div v-if="!game.isMyTurn" class="hint hint--warn">{{ L.notYourTurn }}</div>

        <!-- Target picker -->
        <div class="section">
          <div class="section__label">{{ L.pick }}</div>
          <div v-if="candidates.length === 0" class="empty">{{ L.noCandidates }}</div>
          <div v-else class="target-grid">
            <button
              v-for="p in candidates"
              :key="p.id"
              type="button"
              class="target"
              :class="{ 'target--active': targetId === p.id }"
              @click="targetId = p.id"
            >
              <Sigil :name="p.name" :color="playerColor(p)" :size="28" />
              <div class="target__body">
                <div class="target__name">{{ p.name }}</div>
                <div class="target__cash">◈ {{ p.cash }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Two-column bargain -->
        <div class="columns">
          <!-- My side -->
          <div class="col">
            <div class="col__head col__head--mine">{{ L.mine }}</div>

            <div v-if="myHoldings.length === 0" class="empty small">{{ L.empty }}</div>
            <div v-else class="chips">
              <button
                v-for="h in myHoldings"
                :key="h.index"
                type="button"
                class="chip"
                :class="{ 'chip--active': giveTiles.has(h.index), 'chip--locked': h.mortgaged }"
                :disabled="h.mortgaged"
                @click="toggleGive(h.index, h.mortgaged)"
              >
                <span class="chip__band" :style="{ background: h.band }" />
                <span class="chip__name">{{ h.name }}</span>
                <span class="chip__extras">
                  <span v-if="h.hotel" class="chip__glyph">♖</span>
                  <span v-else-if="h.houses > 0" class="chip__glyph">{{ '⌂'.repeat(h.houses) }}</span>
                  <Icon v-if="h.mortgaged" name="lock" :size="10" color="var(--accent)" />
                </span>
              </button>
            </div>

            <label class="num-field">
              <span class="num-field__label">{{ L.cash }}</span>
              <div class="num-field__wrap">
                <span class="num-field__glyph">◈</span>
                <input
                  v-model.number="giveCash"
                  type="number"
                  min="0"
                  :max="myCashMax"
                  class="num-field__input"
                />
              </div>
              <span class="num-field__max">/ {{ myCashMax }}</span>
            </label>

            <label v-if="myJailMax > 0" class="num-field">
              <span class="num-field__label">{{ L.jail }}</span>
              <div class="num-field__wrap">
                <span class="num-field__glyph">⛓</span>
                <input
                  v-model.number="giveJail"
                  type="number"
                  min="0"
                  :max="myJailMax"
                  class="num-field__input"
                />
              </div>
              <span class="num-field__max">/ {{ myJailMax }}</span>
            </label>
          </div>

          <!-- Their side -->
          <div class="col">
            <div class="col__head col__head--theirs">{{ L.theirs }}</div>

            <div v-if="!target" class="empty small">{{ L.selectTarget }}</div>
            <template v-else>
              <div v-if="theirHoldings.length === 0" class="empty small">{{ L.empty }}</div>
              <div v-else class="chips">
                <button
                  v-for="h in theirHoldings"
                  :key="h.index"
                  type="button"
                  class="chip"
                  :class="{ 'chip--active': takeTiles.has(h.index), 'chip--locked': h.mortgaged }"
                  :disabled="h.mortgaged"
                  @click="toggleTake(h.index, h.mortgaged)"
                >
                  <span class="chip__band" :style="{ background: h.band }" />
                  <span class="chip__name">{{ h.name }}</span>
                  <span class="chip__extras">
                    <span v-if="h.hotel" class="chip__glyph">♖</span>
                    <span v-else-if="h.houses > 0" class="chip__glyph">{{ '⌂'.repeat(h.houses) }}</span>
                    <Icon v-if="h.mortgaged" name="lock" :size="10" color="var(--accent)" />
                  </span>
                </button>
              </div>

              <label class="num-field">
                <span class="num-field__label">{{ L.cash }}</span>
                <div class="num-field__wrap">
                  <span class="num-field__glyph">◈</span>
                  <input
                    v-model.number="takeCash"
                    type="number"
                    min="0"
                    :max="theirCashMax"
                    class="num-field__input"
                  />
                </div>
                <span class="num-field__max">/ {{ theirCashMax }}</span>
              </label>

              <label v-if="theirJailMax > 0" class="num-field">
                <span class="num-field__label">{{ L.jail }}</span>
                <div class="num-field__wrap">
                  <span class="num-field__glyph">⛓</span>
                  <input
                    v-model.number="takeJail"
                    type="number"
                    min="0"
                    :max="theirJailMax"
                    class="num-field__input"
                  />
                </div>
                <span class="num-field__max">/ {{ theirJailMax }}</span>
              </label>
            </template>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-ghost" @click="onClose">{{ L.cancel }}</button>
          <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">
            <Icon name="send" :size="14" color="#fff" />
            {{ L.send }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-scrim {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 510;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.modal-card {
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  overflow-y: auto;
  background: var(--card-alt);
  border-top: 3px solid var(--primary);
  border-radius: 16px 16px 0 0;
  padding: 14px 16px calc(20px + var(--tg-safe-area-inset-bottom, 0px));
  animation: sheet-unfurl 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom;
  box-shadow: 0 -8px 24px rgba(42, 29, 16, 0.25);
  position: relative;
}
.grab-handle {
  width: 40px;
  height: 4px;
  background: var(--line-strong);
  border-radius: 2px;
  margin: -4px auto 10px;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 12px;
}
.head__eyebrow {
  font-size: 10px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.15em;
}
.head__title {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--ink);
  margin-top: 2px;
}
.head__close {
  width: 32px; height: 32px;
}

.section { margin-bottom: 12px; }
.section__label {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.target-grid {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.target {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
}
.target--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(90, 58, 154, 0.15);
}
.target__body {
  text-align: left;
}
.target__name {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink);
}
.target__cash {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--gold);
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.col {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.col__head {
  font-family: var(--font-title);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--divider);
}
.col__head--mine { color: var(--emerald); }
.col__head--theirs { color: var(--primary); }

.chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}
.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--card-alt);
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
  text-align: left;
}
.chip--active {
  border-color: var(--gold);
  background: rgba(212, 168, 74, 0.1);
}
.chip--locked {
  opacity: 0.5;
  cursor: not-allowed;
}
.chip__band {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  flex-shrink: 0;
}
.chip__name {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip__extras {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--ink-2);
}
.chip__glyph { letter-spacing: 0.05em; }

.num-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.num-field__label {
  flex: 1;
  min-width: 0;
}
.num-field__wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--card-alt);
  border: 1px solid var(--line);
  border-radius: 6px;
  flex-shrink: 0;
  max-width: 84px;
}
.num-field__wrap:focus-within {
  border-color: var(--primary);
}
.num-field__glyph {
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 12px;
}
.num-field__input {
  background: transparent;
  border: none;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  outline: none;
  padding: 0;
  width: 48px;
  text-align: right;
}
.num-field__max {
  font-family: var(--font-mono);
  color: var(--ink-3);
  font-size: 10px;
  flex-shrink: 0;
}

.empty {
  color: var(--ink-3);
  font-style: italic;
  text-align: center;
  font-size: 12px;
  padding: 8px 0;
}
.empty.small { padding: 4px 0; font-size: 11px; }

.hint {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 10px;
  text-align: center;
}
.hint--warn {
  background: rgba(139, 26, 26, 0.08);
  border: 1px solid rgba(139, 26, 26, 0.3);
  color: var(--accent);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.actions .btn {
  flex: 1;
  padding: 12px;
  justify-content: center;
}

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
