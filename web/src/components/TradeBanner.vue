<script setup lang="ts">
import { computed } from "vue";
import { BOARD } from "../../../shared/board";
import { useI18n } from "vue-i18n";
import type { Locale } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

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

const fromIndex = computed(() => {
  const t = offerForMe.value;
  if (!t || !game.room) return -1;
  return game.room.players.findIndex((p) => p.id === t.fromId);
});

const fromColor = computed(() => {
  const idx = fromIndex.value;
  return idx >= 0 ? ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length] : ORDERED_PLAYER_COLORS[0];
});

function tileName(idx: number): string {
  return BOARD[idx]?.name[loc.value] ?? "?";
}

// "They give me" = offer.giveTiles/giveCash/giveJailCards
// "I give them" = offer.takeTiles/takeCash/takeJailCards
const theyGiveTiles = computed(() => offerForMe.value?.giveTiles.map(tileName) ?? []);
const iGiveTiles = computed(() => offerForMe.value?.takeTiles.map(tileName) ?? []);
const theyGiveCash = computed(() => offerForMe.value?.giveCash ?? 0);
const iGiveCash = computed(() => offerForMe.value?.takeCash ?? 0);
const theyGiveJail = computed(() => offerForMe.value?.giveJailCards ?? 0);
const iGiveJail = computed(() => offerForMe.value?.takeJailCards ?? 0);

const L = computed(() => isRu.value
  ? {
      eyebrow: "Гонец",
      title: "Предложение обмена",
      youGet: "Тебе",
      youGive: "Ты отдаёшь",
      cash: "монет",
      jail: "карт «Выйти из тюрьмы»",
      nothing: "—",
      decline: "Отказать",
      accept: "Принять",
    }
  : {
      eyebrow: "Messenger",
      title: "Trade offer",
      youGet: "You get",
      youGive: "You give",
      cash: "coin",
      jail: "jail cards",
      nothing: "—",
      decline: "Decline",
      accept: "Accept",
    });

void props;
</script>

<template>
  <transition name="slide">
    <div v-if="offerForMe" class="trade-banner">
      <div class="trade-banner__head">
        <div class="trade-banner__eyebrow">{{ L.eyebrow }}</div>
        <div class="trade-banner__title">{{ L.title }}</div>
      </div>

      <div class="trade-banner__who">
        <Sigil :name="fromPlayer?.name ?? '?'" :color="fromColor" :size="32" />
        <div class="trade-banner__from">{{ fromPlayer?.name }}</div>
      </div>

      <div class="trade-banner__deal">
        <div class="side side--get">
          <div class="side__label">{{ L.youGet }}</div>
          <ul class="side__list">
            <li v-for="n in theyGiveTiles" :key="n">{{ n }}</li>
            <li v-if="theyGiveCash > 0" class="side__coin">◈ {{ theyGiveCash }} {{ L.cash }}</li>
            <li v-if="theyGiveJail > 0">⛓ {{ theyGiveJail }} {{ L.jail }}</li>
            <li v-if="theyGiveTiles.length === 0 && theyGiveCash === 0 && theyGiveJail === 0" class="side__none">
              {{ L.nothing }}
            </li>
          </ul>
        </div>
        <div class="side-sep">⇄</div>
        <div class="side side--give">
          <div class="side__label">{{ L.youGive }}</div>
          <ul class="side__list">
            <li v-for="n in iGiveTiles" :key="n">{{ n }}</li>
            <li v-if="iGiveCash > 0" class="side__coin">◈ {{ iGiveCash }} {{ L.cash }}</li>
            <li v-if="iGiveJail > 0">⛓ {{ iGiveJail }} {{ L.jail }}</li>
            <li v-if="iGiveTiles.length === 0 && iGiveCash === 0 && iGiveJail === 0" class="side__none">
              {{ L.nothing }}
            </li>
          </ul>
        </div>
      </div>

      <div class="trade-banner__actions">
        <button class="btn btn-ghost" @click="onRespond(false)">
          <Icon name="x" :size="14" color="var(--ink-2)"/>
          {{ L.decline }}
        </button>
        <button class="btn btn-emerald" @click="onRespond(true)">
          <Icon name="check" :size="14" color="#fff"/>
          {{ L.accept }}
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.trade-banner {
  position: fixed;
  top: calc(70px + var(--tg-safe-area-inset-top, 0px));
  left: 14px;
  right: 14px;
  max-width: 460px;
  margin: 0 auto;
  /* Above Chat (120) so an incoming trade banner stays visible
     while the chat panel is open. */
  z-index: 125;
  background: var(--card-alt);
  border: 2px solid var(--gold);
  border-radius: var(--r-md);
  padding: 14px 16px;
  box-shadow:
    0 12px 32px rgba(42, 29, 16, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: trade-glow 2.4s ease-in-out infinite;
}

.trade-banner__head {
  text-align: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--divider);
}
.trade-banner__eyebrow {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-3);
  text-transform: uppercase;
}
.trade-banner__title {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--ink);
  margin-top: 2px;
}

.trade-banner__who {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.trade-banner__from {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
}

.trade-banner__deal {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: stretch;
  margin-bottom: 12px;
}
.side {
  background: var(--bg);
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  min-width: 0;
}
.side--get { border-color: rgba(45, 122, 79, 0.4); }
.side--give { border-color: rgba(139, 26, 26, 0.3); }
.side__label {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.side__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--ink);
}
.side__coin {
  font-family: var(--font-mono);
  color: var(--gold);
  font-weight: 600;
}
.side__none {
  color: var(--ink-3);
  font-style: italic;
}
.side-sep {
  align-self: center;
  color: var(--ink-3);
  font-size: 18px;
}

.trade-banner__actions {
  display: flex;
  gap: 8px;
}
.trade-banner__actions .btn {
  flex: 1;
  padding: 10px;
  font-size: 13px;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.22s ease;
}
.slide-enter-from, .slide-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}

@keyframes trade-glow {
  0%, 100% {
    box-shadow:
      0 12px 32px rgba(42, 29, 16, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 0 0 rgba(184, 137, 46, 0);
  }
  50% {
    box-shadow:
      0 16px 40px rgba(42, 29, 16, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 0 3px rgba(212, 168, 74, 0.25);
  }
}
</style>
