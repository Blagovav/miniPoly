<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import TokenArt, { type TokenArtId } from "./TokenArt.vue";
import { tokenArtFor } from "../utils/palette";

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

const tileKindLabel = computed(() => {
  const t = tile.value;
  if (!t) return "";
  if (t.kind === "street") return loc.value === "ru" ? "Улица" : "Street";
  if (t.kind === "railroad") return loc.value === "ru" ? "Путь" : "Railroad";
  if (t.kind === "utility") return loc.value === "ru" ? "Инфра" : "Utility";
  return "";
});

// Figma bidder-chip palette, keyed by seat index. Same family the leader-
// board uses so every player is visually anchored to one colour across
// the room UI (blue seat-1, coral seat-2, purple seat-3, brown seat-4+).
const BIDDER_COLORS = ["#688ee2", "#e2776e", "#9251d5", "#8b5a2b"];
function chipColor(playerId: string): string {
  const idx = game.room?.players.findIndex((p) => p.id === playerId) ?? -1;
  if (idx < 0) return BIDDER_COLORS[0];
  return BIDDER_COLORS[idx % BIDDER_COLORS.length];
}
function chipTokenId(playerId: string): TokenArtId {
  const p = game.room?.players.find((x) => x.id === playerId);
  return tokenArtFor(p?.token || "knight");
}

/** Players who are still in the running (not passed, not bankrupt). */
const activeBidders = computed(() => {
  const a = auction.value;
  if (!a) return [];
  return (game.room?.players ?? []).filter(
    (p) => !p.bankrupt && !a.passedIds.includes(p.id),
  );
});

const hasDecision = computed(() => !myPassed.value && !iAmLeading.value);
const visible = computed(() => open.value && !!tile.value && !!auction.value && hasDecision.value);
</script>

<template>
  <transition name="auction-fade">
    <div v-if="visible && tile && auction" class="auction-scrim">
      <div class="auction-card" @click.stop>
        <!-- Title block -->
        <div class="auction-title">
          <div class="auction-title__name">{{ tile.name[loc] }}</div>
          <div class="auction-title__meta">
            <span
              class="auction-badge"
              :style="bandColor ? { background: bandColor } : undefined"
            >{{ tileKindLabel }}</span>
            <span class="auction-meta-label">{{ loc === "ru" ? "Базовая" : "Base" }}</span>
            <span class="auction-meta-coin">
              <img src="/figma/room/icon-money.png" alt="" />
              <b>{{ tilePrice }}</b>
            </span>
          </div>
        </div>

        <!-- Bid display: empty vs leading -->
        <div v-if="auction.highBid === 0" class="bid-empty">
          {{ loc === "ru" ? "Ставок пока нет" : "No bids yet" }}
        </div>
        <div v-else class="bid-leading">
          <div class="bid-leading__label">
            {{ loc === "ru" ? "Ведущая ставка" : "Leading bid" }}
          </div>
          <div class="bid-leading__row">
            <span class="bid-leading__who">{{ highBidder?.name ?? "—" }}</span>
            <span class="bid-leading__amt">
              <img src="/figma/room/icon-money.png" alt="" />
              <b>{{ auction.highBid }}</b>
            </span>
          </div>
        </div>

        <!-- Bidder chips (active players only) — Figma pill uses player
             token silhouette inside a colour-matched circle. -->
        <div class="bidders">
          <span
            v-for="p in activeBidders"
            :key="p.id"
            class="bidder-chip"
            :style="{ background: chipColor(p.id) }"
          >
            <span class="bidder-chip__token" :style="{ background: p.color }">
              <TokenArt
                :id="chipTokenId(p.id)"
                :size="24"
                color="#fff"
                shadow="rgba(0,0,0,0.55)"
              />
            </span>
            {{ p.name }}
          </span>
        </div>

        <!-- Input + place-bid -->
        <div class="bid-row">
          <div class="bid-input">
            <img src="/figma/room/icon-money.png" alt="" class="bid-input__coin" />
            <input
              v-model.number="bidInput"
              type="number"
              inputmode="numeric"
              :min="minValidBid"
              :max="me?.cash ?? 0"
            />
          </div>
          <button
            class="btn-3d btn-3d--green bid-submit"
            :disabled="!canBidCustom"
            @click="bidCustom"
          >
            {{ loc === "ru" ? "Ставить" : "Place bid" }}
          </button>
        </div>

        <!-- Quick bids -->
        <div class="quick-bids">
          <button
            v-for="delta in [10, 25, 100]"
            :key="delta"
            class="btn-3d btn-3d--green quick-bid"
            :disabled="!me || (auction.highBid + delta) > (me.cash ?? 0)"
            @click="bidBy(delta)"
          >
            <span>+</span>
            <img src="/figma/room/icon-money.png" alt="" />
            <span>{{ delta }}</span>
          </button>
        </div>

        <!-- Pass -->
        <button class="btn-3d btn-3d--red pass-btn" @click="onPass">
          {{ loc === "ru" ? "Спасовать" : "Pass" }}
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Scrim: sheet-ish overlay; dims the board, no backdrop click
   (current auction flow auto-hides when the player has no decision). */
.auction-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(16px + var(--csab, 0px));
}

.auction-card {
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 32px - var(--csab, 0px));
  overflow-y: auto;
  font-family: 'Unbounded', sans-serif;
  color: #000;
}

/* ── Title block ── */
.auction-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.auction-title__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  word-break: break-word;
}
.auction-title__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.auction-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #7dd3fc;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.auction-meta-label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.auction-meta-coin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.auction-meta-coin img { width: 24px; height: 24px; object-fit: contain; }

/* ── Bid display (empty state) ── */
.bid-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70px;
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

/* ── Bid display (leading state) ── */
.bid-leading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #e2776e;
  border-radius: 12px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 #000;
}
.bid-leading__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.bid-leading__row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
}
.bid-leading__amt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.bid-leading__amt img { width: 24px; height: 24px; object-fit: contain; }

/* ── Bidder chips ── */
.bidders {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.bidder-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px 4px 8px;
  border-radius: 999px;
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  text-shadow: 0.2px 0.2px 0 #000;
}
.bidder-chip__token {
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
.bidder-chip__token :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

/* ── Bid row ── */
.bid-row {
  display: flex;
  gap: 8px;
}
.bid-input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  min-width: 0;
}
.bid-input__coin { width: 24px; height: 24px; object-fit: contain; flex-shrink: 0; }
.bid-input input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #000;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bid-input input::-webkit-outer-spin-button,
.bid-input input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.bid-input input[type="number"] { -moz-appearance: textfield; }

.bid-submit {
  flex: 1;
  height: auto;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: 12px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 18px;
  text-transform: uppercase;
  border: 1px solid rgba(0, 0, 0, 0.2);
  box-shadow: none;
}

/* ── Quick bids ── */
.quick-bids {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.quick-bid {
  height: auto;
  min-height: 40px;
  padding: 8px 10px;
  gap: 2px;
  border-radius: 12px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 18px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  box-shadow: none;
  text-transform: none;
  letter-spacing: 0;
}
.quick-bid img { width: 24px; height: 24px; object-fit: contain; }

/* ── Pass button (Figma #f34822, 56px, 2px black border) ── */
.pass-btn {
  width: 100%;
  height: 56px;
  border: 2px solid #000;
  border-radius: 18px;
  background: #f34822;
  color: #fff;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 24px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.2);
}

.btn-3d--red { background: #f34822; }

/* ── Transitions ── */
.auction-fade-enter-active, .auction-fade-leave-active { transition: opacity 0.2s ease; }
.auction-fade-enter-from, .auction-fade-leave-to { opacity: 0; }
.auction-fade-enter-active .auction-card,
.auction-fade-leave-active .auction-card {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.auction-fade-enter-from .auction-card,
.auction-fade-leave-to .auction-card { transform: scale(0.96); }
</style>
