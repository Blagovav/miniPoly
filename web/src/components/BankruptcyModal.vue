<script setup lang="ts">
/**
 * Surfaces a prominent modal when ANOTHER player goes bankrupt — replaces
 * the slate-grey system toast that playtester 2026-05-07 felt was too
 * quiet («не хватает об этом уведомления, прям отдельное окно»). Shows
 * who's out, what place they finished in, and a one-liner on what
 * happens to their properties (transfers to creditor, or goes to bank
 * auction). Skipped for the local player — their own bankruptcy already
 * routes through the end-of-game CoronationModal flow.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Player } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { capTypeFor } from "../shop/cosmetics";
import BotAvatar from "./BotAvatar.vue";

const game = useGameStore();
const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

const visible = ref(false);
const subject = ref<Player | null>(null);
const place = ref<number | null>(null);
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const snap = new Map<string, boolean>();
let seeded = false;

watch(
  () => game.room?.players,
  (players) => {
    if (!players) return;
    if (!seeded) {
      for (const p of players) snap.set(p.id, p.bankrupt);
      seeded = true;
      return;
    }
    for (const p of players) {
      const prev = snap.get(p.id);
      if (prev === false && p.bankrupt && p.id !== game.myPlayerId) {
        // Place = total players − (this one is the Nth bankruptcy in
        // chronological order). Bankruptcies are tallied AFTER the watch
        // sees the flip, so the just-bankrupted player is included in
        // the count — first to bankrupt of 5 sits at 5th place.
        const total = players.length;
        const bankruptCount = players.filter((pl) => pl.bankrupt).length;
        place.value = total - bankruptCount + 1;
        subject.value = p;
        visible.value = true;
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(() => (visible.value = false), 5000);
      }
      snap.set(p.id, p.bankrupt);
    }
  },
  { deep: true, immediate: true },
);

function close() {
  visible.value = false;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

const subjectCapSrc = computed(() =>
  subject.value ? `/figma/shop/caps/${capTypeFor(subject.value.token)}.webp` : "",
);

function placeLabel(n: number): string {
  if (isRu.value) return `${n}-е место`;
  const last = n % 10;
  const teens = n % 100;
  const suffix = teens >= 11 && teens <= 13
    ? "th"
    : last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th";
  return `${n}${suffix} place`;
}
</script>

<template>
  <transition name="bk-fade">
    <div v-if="visible && subject" class="bk-scrim" @click="close">
      <div class="bk-card" @click.stop role="dialog" aria-modal="true">
        <div class="bk-cap-wrap">
          <BotAvatar
            v-if="subject.isBot"
            class="bk-cap bk-cap--bot"
            :seed="subject.name || String(subject.id)"
            :size="64"
          />
          <span v-else class="bk-cap" :style="{ background: subject.color }">
            <img class="bk-cap__img" :src="subjectCapSrc" alt="" draggable="false" />
          </span>
        </div>
        <div class="bk-name">{{ subject.name }}</div>
        <div class="bk-title">{{ isRu ? "ОБАНКРОТИЛСЯ" : "BANKRUPT" }}</div>
        <div v-if="place" class="bk-place">{{ placeLabel(place) }}</div>
        <div class="bk-info">
          {{ isRu
            ? "Улицы переходят кредитору. Если банкрот банку — незаложенные участки уходят на аукцион, заложенные возвращаются банку."
            : "Properties transfer to the creditor. If bankrupt to the bank, unmortgaged tiles go to auction; mortgaged ones revert to the bank." }}
        </div>
        <button type="button" class="bk-ok" @click="close">
          {{ isRu ? "ПОНЯТНО" : "OK" }}
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.bk-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 530;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.bk-card {
  width: 100%;
  max-width: 320px;
  background: #faf3e2;
  border-radius: 22px;
  padding: 22px 22px 18px;
  box-shadow: 0 16px 32px rgba(26, 15, 5, 0.32);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-family: 'Unbounded', sans-serif;
  color: #000;
  text-align: center;
}
.bk-cap-wrap {
  margin-top: -2px;
  filter: grayscale(0.7);
  opacity: 0.85;
}
.bk-cap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}
.bk-cap__img {
  width: 110%;
  height: 110%;
  object-fit: contain;
}
.bk-name {
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  letter-spacing: 0.01em;
  color: #1a0f05;
}
.bk-title {
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  letter-spacing: 0.04em;
  color: #b32c2c;
  text-shadow: 0.4px 0.4px 0 rgba(0, 0, 0, 0.25);
}
.bk-place {
  font-weight: 700;
  font-size: 14px;
  color: #484337;
  margin-top: -2px;
}
.bk-info {
  font-family: 'Golos UI', 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  line-height: 18px;
  color: #484337;
  margin-top: 6px;
}
.bk-ok {
  margin-top: 8px;
  width: 100%;
  height: 44px;
  border: 2px solid #000;
  border-radius: 14px;
  background: #4ed636;
  color: #fff;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 16px;
  letter-spacing: 0.04em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.45);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 120ms ease;
}
.bk-ok:active { transform: translateY(1px); }

.bk-fade-enter-active,
.bk-fade-leave-active { transition: opacity 0.22s ease; }
.bk-fade-enter-from,
.bk-fade-leave-to { opacity: 0; }
</style>
