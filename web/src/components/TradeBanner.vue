<script setup lang="ts">
import { computed } from "vue";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import { useI18n } from "vue-i18n";
import type { Locale, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import Icon from "./Icon.vue";
import { capTypeFor } from "../shop/cosmetics";

const props = defineProps<{
  onRespond: (accept: boolean) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const isRu = computed(() => locale.value === "ru");
const game = useGameStore();

// Only render for the recipient.
const offerForMe = computed(() => {
  const t = game.room?.pendingTrade;
  if (!t || !game.me) return null;
  return t.toId === game.me.id ? t : null;
});

const fromPlayer = computed(() => {
  const t = offerForMe.value;
  if (!t || !game.room) return null;
  return game.room.players.find((p) => p.id === t.fromId) ?? null;
});

const fromColor = computed(() => fromPlayer.value?.color ?? "#484337");
const fromCapSrc = computed(() => `/figma/shop/caps/${capTypeFor(fromPlayer.value?.token)}.webp`);

interface TileRow {
  idx: number;
  name: string;
  band: string;
}
function tileRow(idx: number): TileRow {
  const t = BOARD[idx];
  let band = "rgba(0,0,0,0.4)";
  if (t?.kind === "street") band = GROUP_COLORS[(t as StreetTile).group] ?? band;
  else if (t?.kind === "railroad") band = "#000";
  else if (t?.kind === "utility") band = "#9ca3af";
  return {
    idx,
    name: t?.name[loc.value] ?? "?",
    band,
  };
}

// "They give me" = offer.giveTiles/giveCash/giveJailCards
// "I give them" = offer.takeTiles/takeCash/takeJailCards
const theyGiveTiles = computed(() => offerForMe.value?.giveTiles.map(tileRow) ?? []);
const iGiveTiles = computed(() => offerForMe.value?.takeTiles.map(tileRow) ?? []);
const theyGiveCash = computed(() => offerForMe.value?.giveCash ?? 0);
const iGiveCash = computed(() => offerForMe.value?.takeCash ?? 0);
const theyGiveJail = computed(() => offerForMe.value?.giveJailCards ?? 0);
const iGiveJail = computed(() => offerForMe.value?.takeJailCards ?? 0);

const theyGiveEmpty = computed(() =>
  theyGiveTiles.value.length === 0 && theyGiveCash.value === 0 && theyGiveJail.value === 0,
);
const iGiveEmpty = computed(() =>
  iGiveTiles.value.length === 0 && iGiveCash.value === 0 && iGiveJail.value === 0,
);

const L = computed(() => isRu.value
  ? {
      eyebrow: "ГОНЕЦ",
      title: "Предложение обмена",
      youGet: "ТЕБЕ",
      youGive: "ТЫ ОТДАЁШЬ",
      coins: "монет",
      jail: "карт «Выйти из тюрьмы»",
      nothing: "—",
      decline: "Отказать",
      accept: "Принять",
    }
  : {
      eyebrow: "MESSENGER",
      title: "Trade offer",
      youGet: "YOU GET",
      youGive: "YOU GIVE",
      coins: "coin",
      jail: "jail cards",
      nothing: "—",
      decline: "Decline",
      accept: "Accept",
    });

void props;
</script>

<template>
  <transition name="slide">
    <div v-if="offerForMe" class="trade-banner" role="dialog" aria-live="polite">
      <!-- Header: eyebrow + title centred, divider underneath -->
      <header class="trade-banner__head">
        <div class="trade-banner__eyebrow">{{ L.eyebrow }}</div>
        <h2 class="trade-banner__title">{{ L.title }}</h2>
      </header>

      <!-- Sender row: cap avatar + name -->
      <div class="trade-banner__from">
        <span class="trade-banner__cap" :style="{ background: fromColor }">
          <img :src="fromCapSrc" alt="" draggable="false"/>
        </span>
        <span class="trade-banner__from-name">{{ fromPlayer?.name }}</span>
      </div>

      <!-- Deal: two pills with a ⇄ swap badge between them -->
      <div class="trade-banner__deal">
        <section class="trade-side">
          <div class="trade-side__label">{{ L.youGet }}</div>
          <ul v-if="!theyGiveEmpty" class="trade-side__list">
            <li v-for="row in theyGiveTiles" :key="`g-${row.idx}`" class="trade-side__row">
              <span class="trade-side__dot" :style="{ background: row.band }" aria-hidden="true"/>
              <span class="trade-side__name">{{ row.name }}</span>
            </li>
            <li v-if="theyGiveCash > 0" class="trade-side__row trade-side__row--coin">
              <img class="trade-side__coin-icon" src="/figma/room/icon-money.webp" alt="" aria-hidden="true"/>
              <span class="trade-side__name">{{ theyGiveCash }} {{ L.coins }}</span>
            </li>
            <li v-if="theyGiveJail > 0" class="trade-side__row">
              <img class="trade-side__coin-icon" src="/figma/room/tile-jail.webp" alt="" aria-hidden="true"/>
              <span class="trade-side__name">×{{ theyGiveJail }}</span>
            </li>
          </ul>
          <div v-else class="trade-side__nothing">{{ L.nothing }}</div>
        </section>

        <span class="trade-banner__swap" aria-hidden="true">⇄</span>

        <section class="trade-side">
          <div class="trade-side__label">{{ L.youGive }}</div>
          <ul v-if="!iGiveEmpty" class="trade-side__list">
            <li v-for="row in iGiveTiles" :key="`t-${row.idx}`" class="trade-side__row">
              <span class="trade-side__dot" :style="{ background: row.band }" aria-hidden="true"/>
              <span class="trade-side__name">{{ row.name }}</span>
            </li>
            <li v-if="iGiveCash > 0" class="trade-side__row trade-side__row--coin">
              <img class="trade-side__coin-icon" src="/figma/room/icon-money.webp" alt="" aria-hidden="true"/>
              <span class="trade-side__name">{{ iGiveCash }} {{ L.coins }}</span>
            </li>
            <li v-if="iGiveJail > 0" class="trade-side__row">
              <img class="trade-side__coin-icon" src="/figma/room/tile-jail.webp" alt="" aria-hidden="true"/>
              <span class="trade-side__name">×{{ iGiveJail }}</span>
            </li>
          </ul>
          <div v-else class="trade-side__nothing">{{ L.nothing }}</div>
        </section>
      </div>

      <!-- Actions: white Decline + green Accept -->
      <div class="trade-banner__actions">
        <button class="trade-btn trade-btn--decline" type="button" @click="onRespond(false)">
          <Icon name="x" :size="14" color="#000"/>
          <span>{{ L.decline }}</span>
        </button>
        <button class="trade-btn trade-btn--accept" type="button" @click="onRespond(true)">
          <Icon name="check" :size="14" color="#fff"/>
          <span>{{ L.accept }}</span>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Anchored under the topbar; cyan border + cream card per Figma. The
   border colour matches the chest-modal/exotic accent so high-priority
   modals share a visual language. */
.trade-banner {
  position: fixed;
  top: calc(70px + var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px));
  left: 12px;
  right: 12px;
  max-width: 460px;
  margin: 0 auto;
  /* Above Chat (120) so an incoming trade banner stays visible while
     the chat panel is open. */
  z-index: 125;
  background: #faf3e2;
  border: 3px solid #2dd4ff;
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  font-family: 'Golos Text', sans-serif;
  color: #000;
}

/* ── Header ── */
.trade-banner__head {
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}
.trade-banner__eyebrow {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 10px;
  line-height: 12px;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}
.trade-banner__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 22px;
  color: #000;
}

/* ── Sender ── */
.trade-banner__from {
  display: flex;
  align-items: center;
  gap: 10px;
}
.trade-banner__cap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3),
              inset 0 -1px 1px rgba(0, 0, 0, 0.25);
}
.trade-banner__cap img {
  width: 112%;
  height: 112%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
  pointer-events: none;
  user-select: none;
}
.trade-banner__from-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #000;
}

/* ── Deal pills ── */
.trade-banner__deal {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: stretch;
}
.trade-side {
  background: #fff;
  border: 1.5px dashed rgba(0, 0, 0, 0.18);
  border-radius: 14px;
  padding: 10px 12px;
  min-height: 70px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.trade-side__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  letter-spacing: 0.06em;
  color: rgba(0, 0, 0, 0.55);
}
.trade-side__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Cap the list so a trade with many tiles doesn't blow the banner past
     the viewport. ~5 rows fit before the scrollbar takes over. */
  max-height: 180px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.trade-side__list::-webkit-scrollbar { width: 3px; }
.trade-side__list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 100px;
}
.trade-side__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #000;
}
.trade-side__row--coin .trade-side__name {
  color: #2dd4ff;
}
.trade-side__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.18),
              0 0 0 1px rgba(0, 0, 0, 0.08);
}
.trade-side__coin-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}
.trade-side__name {
  flex: 1 1 0;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trade-side__nothing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.4);
}
.trade-banner__swap {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.55);
  font-size: 16px;
  font-weight: 700;
}

/* ── Actions ── */
.trade-banner__actions {
  display: flex;
  gap: 8px;
}
.trade-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 14px;
  line-height: 16px;
  cursor: pointer;
  transition: transform 120ms ease, filter 120ms ease;
}
.trade-btn:active { transform: scale(0.97); }
.trade-btn--decline {
  background: #fff;
  color: #000;
  border: 1.5px solid rgba(0, 0, 0, 0.16);
}
.trade-btn--accept {
  background: #1f7a3a;
  color: #fff;
  border: none;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.2);
}

/* ── Slide entry ── */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.22s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}
</style>
