<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { capTypeFor } from "../shop/cosmetics";
import BotAvatar from "./BotAvatar.vue";

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

function chipCapSrc(token: string | undefined): string {
  return `/figma/shop/caps/${capTypeFor(token)}.webp`;
}

/** Players who are still in the running (not passed, not bankrupt). */
const activeBidders = computed(() => {
  const a = auction.value;
  if (!a) return [];
  return (game.room?.players ?? []).filter(
    (p) => !p.bankrupt && !a.passedIds.includes(p.id),
  );
});

/* The modal stays mounted for the whole auction phase, even while I'm
 * the high bidder, so a "+10 → I lead → modal closes → opponent +10 →
 * modal reopens" cycle no longer flickers. Bid buttons disable
 * themselves via canBidCustom when iAmLeading is true, so the leading
 * state still reads clearly inside the open card. We only hide on
 * explicit pass (myPassed) or when the auction itself ends server-
 * side (auction === null after the winner is announced). */
const visible = computed(() => open.value && !!tile.value && !!auction.value && !myPassed.value);

// Auction-specific countdown — server stamps `auction.deadline` when the
// auction starts and refreshes it after every bid. Local tick keeps the
// rendered value in sync without spamming WS broadcasts. Falls back to
// hidden if the server hasn't shipped a deadline yet (older builds, or
// auctions that pre-date the field). Playtester 2026-05-07 «нужно
// сделать таймер аукциона».
const nowMs = ref(Date.now());
const tickHandle = window.setInterval(() => { nowMs.value = Date.now(); }, 250);
onUnmounted(() => window.clearInterval(tickHandle));
const auctionRemainingSec = computed(() => {
  const d = auction.value?.deadline;
  if (!d) return 0;
  return Math.max(0, Math.ceil((d - nowMs.value) / 1000));
});

// Reason the auction was opened — surfaces "X отказался от покупки" or
// "X обанкротился, улицы продаются с аукциона" inside the modal so the
// other players know WHY the modal popped. Playtester 2026-05-07
// «подписать почему открылся аукцион».
const reasonLabel = computed(() => {
  const r = auction.value?.reason;
  if (!r) return null;
  const player = game.room?.players.find((p) => p.id === r.playerId);
  const name = player?.name ?? (loc.value === "ru" ? "Игрок" : "Player");
  if (r.kind === "declined") {
    return loc.value === "ru"
      ? `${name} отказался от покупки`
      : `${name} declined to buy`;
  }
  if (r.kind === "bankBankruptcy") {
    return loc.value === "ru"
      ? `${name} банкрот — улицы продаются с аукциона`
      : `${name} went bankrupt — properties at auction`;
  }
  return null;
});

const leadingBg = computed<string>(() => {
  const c = highBidder.value?.color;
  return c || "#e2776e";
});
</script>

<template>
  <transition name="auction-fade">
    <div v-if="visible && tile && auction" class="auction-scrim">
      <div class="auction-card" @click.stop>
        <!-- Header strip: timer (left) + my balance (right). Anchors the
             card so players know how long they have to bid AND what they
             can afford without scrolling down to the input. -->
        <div class="auction-header">
          <div v-if="auctionRemainingSec > 0" class="auction-timer">
            <img src="/figma/room/icon-stopwatch.webp" alt="" />
            <span>{{ auctionRemainingSec }}</span>
          </div>
          <span v-else class="auction-timer auction-timer--off"></span>
          <div v-if="me" class="auction-balance">
            <span class="auction-balance__label">
              {{ loc === "ru" ? "У меня" : "Mine" }}
            </span>
            <img src="/figma/room/icon-money.webp" alt="" />
            <b>{{ me.cash }}</b>
          </div>
        </div>

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
              <img src="/figma/room/icon-money.webp" alt="" />
              <b>{{ tilePrice }}</b>
            </span>
          </div>
          <div v-if="reasonLabel" class="auction-reason">{{ reasonLabel }}</div>
        </div>

        <!-- Bid display: empty vs leading -->
        <div v-if="auction.highBid === 0" class="bid-empty">
          {{ loc === "ru" ? "Ставок пока нет" : "No bids yet" }}
        </div>
        <div v-else class="bid-leading" :style="{ background: leadingBg }">
          <div class="bid-leading__label">
            {{ loc === "ru" ? "Ведущая ставка" : "Leading bid" }}
          </div>
          <div class="bid-leading__row">
            <span class="bid-leading__who">{{ highBidder?.name ?? "—" }}</span>
            <span class="bid-leading__amt">
              <img src="/figma/room/icon-money.webp" alt="" />
              <b>{{ auction.highBid }}</b>
            </span>
          </div>
        </div>

        <!-- Bidder chips (active players only). Pill = player's server colour;
             inner disc shows the player's actual cap figurine (same source as
             the on-board pawn) so the auction reads at a glance. -->
        <div class="bidders">
          <span
            v-for="p in activeBidders"
            :key="p.id"
            class="bidder-chip"
            :style="{ background: p.color }"
          >
            <BotAvatar
              v-if="p.isBot"
              class="bidder-chip__token bidder-chip__token--bot"
              :seed="p.name || String(p.id)"
              :size="24"
            />
            <span v-else class="bidder-chip__token">
              <img
                class="bidder-chip__cap"
                :src="chipCapSrc(p.token)"
                alt=""
                draggable="false"
              />
            </span>
            {{ p.name }}
          </span>
        </div>

        <!-- Input + place-bid -->
        <div class="bid-row">
          <div class="bid-input">
            <img src="/figma/room/icon-money.webp" alt="" class="bid-input__coin" />
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
            <img src="/figma/room/icon-money.webp" alt="" />
            <span>{{ delta }}</span>
          </button>
        </div>

        <!-- Pass — disabled while I'm the leading bidder. Passing on my
             own bid would be a no-op (server keeps my bid valid until
             I'm out-bid), and the button looking "active" while doing
             nothing confused playtester 2026-05-07 «если сделал ставку
             то спасовать не должна быть активна». -->
        <button
          class="btn-3d btn-3d--red pass-btn"
          :disabled="iAmLeading"
          @click="onPass"
        >
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
  /* Designer feedback 2026-05-02 #5.18 — auction popup docks 76px from
     bottom (figma in-game popup-info anchor) instead of centring. */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 16px;
  padding-bottom: calc(76px + var(--sab, 0px) + var(--csab, 0px));
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

/* ── Header strip (timer + balance) ── */
.auction-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #1a0f05;
}
.auction-timer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 20px;
}
.auction-timer img { width: 18px; height: 18px; object-fit: contain; }
.auction-timer--off { visibility: hidden; }
.auction-balance {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #fff;
  border-radius: 100px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
.auction-balance__label {
  font-weight: 500;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}
.auction-balance img { width: 18px; height: 18px; object-fit: contain; }

/* Reason chip — single line under the title metadata. */
.auction-reason {
  margin-top: 4px;
  font-family: 'Golos UI', 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.65);
  text-align: center;
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
  /* Background is inline-styled to highBidder.color so the strip echoes
     the leader's player colour — playtester 2026-05-07 «фон ведущей
     ставки должен подхватывать цвет игрока». #e2776e is the fallback
     for the (rare) state where the bidder colour is missing. */
  background: #e2776e;
  border-radius: 12px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 #000;
}
.pass-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: saturate(0.5);
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
  background: rgba(0, 0, 0, 0.28);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3),
              inset 0 -1px 1px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
  overflow: hidden;
}
.bidder-chip__cap {
  width: 110%;
  height: 110%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
  pointer-events: none;
  user-select: none;
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
