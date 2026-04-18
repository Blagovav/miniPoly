<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import Icon from "./Icon.vue";

const props = defineProps<{
  onBid: (amount: number) => void;
  onPass: () => void;
}>();

const { locale } = useI18n();
const game = useGameStore();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));

const open = computed(() => game.room?.phase === "auction" && !!game.room?.auction);
const auction = computed(() => game.room?.auction ?? null);
const tile = computed(() => auction.value ? BOARD[auction.value.tileIndex] : null);
const tilePrice = computed(() => {
  const t = tile.value;
  if (!t) return 0;
  if (t.kind === "street" || t.kind === "railroad" || t.kind === "utility") return t.price;
  return 0;
});
const bandColor = computed(() => {
  const t = tile.value;
  if (!t || t.kind !== "street") return null;
  return GROUP_COLORS[(t as StreetTile).group];
});

const me = computed(() => game.me);
const myPassed = computed(() => {
  const a = auction.value; const m = me.value;
  return !!a && !!m && a.passedIds.includes(m.id);
});
const iAmLeading = computed(() => {
  const a = auction.value; const m = me.value;
  return !!a && !!m && a.highBidderId === m.id;
});
const highBidder = computed(() => {
  const a = auction.value;
  if (!a?.highBidderId) return null;
  return game.room?.players.find((p) => p.id === a.highBidderId) ?? null;
});

const bidInput = ref(0);
watch(auction, (a) => {
  if (!a) return;
  // Подсказываем минимальную валидную ставку
  const base = tilePrice.value || 10;
  bidInput.value = a.highBid > 0 ? a.highBid + 10 : Math.max(10, Math.floor(base / 2));
});

function bidBy(delta: number) {
  const a = auction.value;
  if (!a) return;
  const next = (a.highBid || 0) + delta;
  props.onBid(next);
}
function bidCustom() {
  if (bidInput.value > 0) props.onBid(Math.floor(bidInput.value));
}

const minValidBid = computed(() => (auction.value?.highBid ?? 0) + 1);
const canAffordInput = computed(() => !me.value || bidInput.value <= me.value.cash);
const canBidCustom = computed(() => {
  return !myPassed.value
    && !iAmLeading.value
    && bidInput.value >= minValidBid.value
    && canAffordInput.value;
});

function playerStatus(playerId: string): "leader" | "passed" | "active" | "bankrupt" {
  const a = auction.value; const p = game.room?.players.find((pl) => pl.id === playerId);
  if (!p || p.bankrupt) return "bankrupt";
  if (a?.highBidderId === playerId) return "leader";
  if (a?.passedIds.includes(playerId)) return "passed";
  return "active";
}

const tileKindLabel = computed(() => {
  const t = tile.value;
  if (!t) return "";
  if (t.kind === "street") return loc.value === "ru" ? "Улица" : "Street";
  if (t.kind === "railroad") return loc.value === "ru" ? "Путь" : "Railroad";
  if (t.kind === "utility") return loc.value === "ru" ? "Инфра" : "Utility";
  return "";
});
</script>

<template>
  <transition name="fade">
    <div v-if="open && tile && auction" class="modal-scrim" @click.self>
      <div class="modal-card auction-card" @click.stop :style="bandColor ? { borderTopColor: bandColor } : undefined">
        <div class="grab-bar" />

        <!-- Header -->
        <div class="auction-head">
          <div class="auction-head__eyebrow">
            <span class="hammer">🔨</span>
            {{ loc === "ru" ? "Аукцион" : "Auction" }}
          </div>
          <div class="auction-head__title">{{ tile.name[loc] }}</div>
          <div class="auction-head__sub">
            <span class="kind-pill" :style="bandColor ? { background: bandColor } : undefined">
              {{ tileKindLabel }}
            </span>
            <span class="auction-head__price">
              {{ loc === "ru" ? "Базовая" : "Base" }}
              <b>◈ {{ tilePrice }}</b>
            </span>
          </div>
        </div>

        <!-- Bid display -->
        <div class="bid-display" :class="{ 'bid-display--active': auction.highBid > 0 }">
          <div class="bid-display__label">
            {{ auction.highBid > 0
              ? (loc === "ru" ? "Ведущая ставка" : "Leading bid")
              : (loc === "ru" ? "Ставок пока нет" : "No bids yet") }}
          </div>
          <div v-if="auction.highBid > 0" class="bid-display__val">
            <span class="bid-display__amount">◈ {{ auction.highBid }}</span>
            <span class="bid-display__by">· {{ highBidder?.name ?? "—" }}</span>
          </div>
        </div>

        <!-- Players -->
        <div class="players">
          <div
            v-for="p in game.room?.players ?? []"
            :key="p.id"
            class="player-chip"
            :class="[`player-chip--${playerStatus(p.id)}`]"
          >
            <span class="player-chip__dot" :style="{ background: p.color }" />
            <span class="player-chip__name">{{ p.name }}</span>
            <span class="player-chip__status">
              <template v-if="playerStatus(p.id) === 'leader'">♕</template>
              <template v-else-if="playerStatus(p.id) === 'passed'">✕</template>
              <template v-else-if="playerStatus(p.id) === 'bankrupt'">†</template>
            </span>
          </div>
        </div>

        <div v-if="myPassed" class="status-box">
          {{ loc === "ru" ? "Ты спасовал — ждём остальных" : "You passed — waiting for others" }}
        </div>
        <div v-else-if="iAmLeading" class="status-box status-box--win">
          <Icon name="check" :size="14" color="var(--emerald)" />
          {{ loc === "ru" ? "Ты лидируешь! Ждём остальных" : "You're winning! Waiting for others" }}
        </div>
        <template v-else>
          <!-- Quick bids -->
          <div class="quick-bids">
            <button class="btn btn-ghost quick-bid" :disabled="!me || (auction.highBid + 10) > (me.cash ?? 0)" @click="bidBy(10)">
              + ◈ 10
            </button>
            <button class="btn btn-ghost quick-bid" :disabled="!me || (auction.highBid + 25) > (me.cash ?? 0)" @click="bidBy(25)">
              + ◈ 25
            </button>
            <button class="btn btn-ghost quick-bid" :disabled="!me || (auction.highBid + 100) > (me.cash ?? 0)" @click="bidBy(100)">
              + ◈ 100
            </button>
          </div>
          <!-- Custom bid row -->
          <div class="custom-bid">
            <div class="custom-bid__field">
              <span class="custom-bid__prefix">◈</span>
              <input
                v-model.number="bidInput"
                type="number"
                :min="minValidBid"
                :max="me?.cash ?? 0"
                class="custom-bid__input"
              />
            </div>
            <button class="btn btn-primary" :disabled="!canBidCustom" @click="bidCustom">
              {{ loc === "ru" ? "Ставить" : "Place bid" }}
            </button>
          </div>
          <!-- Pass -->
          <button class="btn btn-wax pass-btn" @click="onPass">
            <Icon name="x" :size="14" color="#fff" />
            {{ loc === "ru" ? "Спасовать" : "Pass" }}
          </button>
        </template>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Scrim / card base (medieval parchment) ── */
.modal-scrim {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}
.modal-card {
  width: 100%;
  max-width: 420px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--card-alt);
  border-top: 3px solid var(--primary);
  border-radius: 16px 16px 0 0;
  padding: 14px 16px calc(20px + var(--tg-safe-area-inset-bottom, 0px));
  animation: sheet-unfurl 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom;
  box-shadow: 0 -8px 24px rgba(42, 29, 16, 0.25);
}
.grab-bar {
  width: 40px;
  height: 4px;
  background: var(--line-strong);
  border-radius: 2px;
  margin: -2px auto 10px;
}

/* ── Header ── */
.auction-head {
  text-align: center;
  margin-bottom: 12px;
}
.auction-head__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-title);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
}
.hammer {
  display: inline-block;
  font-size: 16px;
  animation: hammer-swing 2s ease-in-out infinite;
  transform-origin: 50% 80%;
}
@keyframes hammer-swing {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}
.auction-head__title {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--ink);
  margin-top: 4px;
  line-height: 1.2;
}
.auction-head__sub {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--ink-3);
}
.kind-pill {
  display: inline-block;
  padding: 2px 10px;
  background: var(--ink-3);
  color: #fff;
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-radius: 3px;
}
.auction-head__price {
  display: inline-flex;
  gap: 6px;
  font-size: 12px;
}
.auction-head__price b {
  font-family: var(--font-mono);
  color: var(--ink);
  font-weight: 600;
}

/* ── Bid display ── */
.bid-display {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--card);
  border: 1px solid var(--line);
  margin-bottom: 12px;
  text-align: center;
}
.bid-display--active {
  background: linear-gradient(145deg, rgba(184, 137, 46, 0.12), rgba(212, 168, 74, 0.06));
  border-color: var(--gold);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.bid-display__label {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-3);
  text-transform: uppercase;
}
.bid-display__val {
  margin-top: 4px;
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.bid-display__amount {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.bid-display__by {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink-2);
}

/* ── Player chips ── */
.players {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-bottom: 12px;
}
.player-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--card);
  border: 1px solid var(--line);
  font-size: 12px;
  color: var(--ink-2);
  font-family: var(--font-body);
}
.player-chip--leader {
  background: linear-gradient(180deg, var(--gold-soft), var(--gold));
  color: #2a1d10;
  border-color: var(--gold);
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(139, 105, 20, 0.25);
}
.player-chip--passed {
  opacity: 0.45;
  text-decoration: line-through;
}
.player-chip--bankrupt {
  opacity: 0.3;
}
.player-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3);
}
.player-chip__status {
  font-family: var(--font-display);
  font-size: 13px;
  line-height: 1;
}

/* ── Quick bids ── */
.quick-bids {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}
.quick-bid {
  padding: 10px 0;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--gold);
  border-color: var(--gold);
  background: rgba(184, 137, 46, 0.05);
}
.quick-bid:hover:not(:disabled) {
  background: rgba(184, 137, 46, 0.12);
}

/* ── Custom bid row ── */
.custom-bid {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.custom-bid__field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.custom-bid__prefix {
  font-family: var(--font-mono);
  color: var(--gold);
  font-size: 14px;
  font-weight: 700;
}
.custom-bid__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  text-align: right;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.custom-bid .btn {
  padding: 10px 14px;
  font-size: 13px;
  white-space: nowrap;
}

/* ── Pass ── */
.pass-btn {
  width: 100%;
  padding: 11px;
  font-size: 13px;
}

/* ── Status box ── */
.status-box {
  padding: 12px;
  margin-top: 6px;
  border-radius: 10px;
  background: var(--card);
  color: var(--ink-2);
  font-size: 13px;
  text-align: center;
  border: 1px dashed var(--line-strong);
  font-family: var(--font-display);
}
.status-box--win {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(45, 122, 79, 0.1);
  color: var(--emerald);
  border: 1px solid var(--emerald);
  font-weight: 600;
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
