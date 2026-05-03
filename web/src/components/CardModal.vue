<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import type { DrawnCard, Locale } from "../../../shared/types";

const { locale } = useI18n();
const game = useGameStore();

const visible = ref(false);
const current = ref<DrawnCard | null>(null);
let timeout: ReturnType<typeof setTimeout> | null = null;

// Get-Out-of-Jail-Free cards stay in inventory — surface that explicitly
// so the player knows they can use it later.
const isJailKeyCard = computed(() =>
  current.value?.cardId === "ch-gooj" || current.value?.cardId === "cc-gooj",
);

const drawerId = computed(() => current.value?.by ?? null);
const drawer = computed(() =>
  drawerId.value ? game.room?.players.find((p) => p.id === drawerId.value) ?? null : null,
);
const isMyCard = computed(() => !!drawerId.value && drawerId.value === game.myPlayerId);

const isChance = computed(() => current.value?.deck === "chance");

// Show the card ONLY after the drawer's token has finished its step-by-step
// walk. Server sets lastCard the instant the tile resolves, but the client
// is still animating the hop — popping the modal mid-walk feels like the
// state skipped ahead.
let lastShownTs = 0;
watch(
  [() => game.room?.lastCard?.ts, () => game.animatingPlayerId],
  () => {
    const card = game.room?.lastCard;
    if (!card || !card.ts) return;
    if (card.ts === lastShownTs) return;
    if (game.animatingPlayerId === card.by) return;
    lastShownTs = card.ts;
    current.value = card;
    visible.value = true;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => (visible.value = false), isJailKeyCard.value ? 5000 : 3500);
  },
  { immediate: true },
);

function close() {
  visible.value = false;
  if (timeout) clearTimeout(timeout);
}

const L = computed(() => locale.value === "ru"
  ? {
      chance: "Шанс",
      chest: "Общественная казна",
      drawnBy: (n: string) => `тянет ${n}`,
      yourCard: "ваша карта",
      youAre: "ВЫ —",
      keep: "Сохранена в инвентаре. Используй, когда попадёшь в тюрьму.",
      auto: "Закроется автоматически",
      gotIt: "Понятно",
      closeAria: "Закрыть",
    }
  : {
      chance: "Chance",
      chest: "Community Chest",
      drawnBy: (n: string) => `drawn by ${n}`,
      yourCard: "your card",
      youAre: "YOU —",
      keep: "Saved to your inventory. Use it next time you're jailed.",
      auto: "Closes automatically",
      gotIt: "Got it",
      closeAria: "Close",
    });
</script>

<template>
  <transition name="card-pop">
    <div
      v-if="visible && current"
      class="card-scrim"
      @click="isMyCard ? close() : undefined"
    >
      <div class="card-stack" @click.stop>
        <div class="card-pop">
          <!-- Eyebrow badge: "Шанс — тянет Никита" / "Общественная казна — ваша карта" -->
          <div
            class="card-pop__badge"
            :class="isChance ? 'card-pop__badge--chance' : 'card-pop__badge--chest'"
          >
            {{ isChance ? L.chance : L.chest }}<span
              v-if="isMyCard"
            > — {{ L.yourCard }}</span><span
              v-else-if="drawer"
            > — {{ L.drawnBy(drawer.name) }}</span>
          </div>

          <!-- Seal: keeps the chance/chest emblem as the figma "img-building"
               slot, but rendered as a soft-coloured circle so we don't need
               to ship a per-deck image asset. Drawer's name caption sits
               below it so passive viewers (and the drawer themselves) can
               see at a glance who the card actually applies to —
               playtester feedback 2026-05-03 ("не понятно что это ты
               победил"). -->
          <div class="card-pop__seal-wrap">
            <div
              class="card-pop__seal"
              :class="isChance ? 'card-pop__seal--chance' : 'card-pop__seal--chest'"
              aria-hidden="true"
            >{{ isChance ? "?" : "⎔" }}</div>
            <div v-if="drawer" class="card-pop__drawer-name">
              <span v-if="isMyCard" class="card-pop__drawer-you">{{ L.youAre }}</span>
              <span>{{ drawer.name }}</span>
            </div>
          </div>

          <!-- Body text — what the card actually says -->
          <p class="card-pop__text">
            {{ current.text[locale as Locale] }}
          </p>

          <!-- Jail-key keepsake hint -->
          <div v-if="isJailKeyCard" class="card-pop__keep">
            <span class="card-pop__keep-icon" aria-hidden="true">🗝</span>
            <span>{{ L.keep }}</span>
          </div>

          <!-- Drawer gets a tap-to-dismiss; everyone else sees the auto-close
               hint so two hands don't race on the same modal. -->
          <button
            v-if="isMyCard"
            type="button"
            class="card-pop__cta"
            @click="close"
          >{{ L.gotIt }}</button>
          <p v-else class="card-pop__hint">{{ L.auto }}</p>
        </div>

        <button
          type="button"
          class="card-pop__close"
          :aria-label="L.closeAria"
          @click="close"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="#000"
              stroke-width="2.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.card-scrim {
  position: fixed;
  inset: 0;
  z-index: 520;
  background: rgba(0, 0, 0, 0.4);
  /* Designer feedback 2026-05-02 #5.18 — chance/chest reveals dock at
     76px from bottom so the board stays visible. */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 24px;
  padding-bottom: calc(76px + var(--sab, 0px) + var(--csab, 0px));
}

.card-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 345px;
}

/* ── Card body — Figma 73:2925 popup-info: parchment fill, rounded 18,
   padding 24, vertically stacked content with 16px gap. */
.card-pop {
  width: 100%;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  color: #000;
}

/* ── Eyebrow badge — coloured pill at the top, matches the
   "Шанс — тянет Никита" pill in the figma. */
.card-pop__badge {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-pop__badge--chance { background: #e2776e; }
.card-pop__badge--chest  { background: #688ee2; }

/* ── Seal: 80×80 emblem circle. Stand-in for the figma "img-building"
   slot — chance gets a deep red gradient, chest a violet one. */
.card-pop__seal {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 36px;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.3),
              inset 0 -2px 3px rgba(0, 0, 0, 0.3),
              0 6px 14px rgba(0, 0, 0, 0.18);
}
.card-pop__seal--chance {
  background: radial-gradient(circle at 35% 30%, #e84b3e 0%, #b8281b 60%, #781712 100%);
}
.card-pop__seal--chest {
  background: radial-gradient(circle at 35% 30%, #688ee2 0%, #3a5db5 60%, #1f3a83 100%);
}
.card-pop__seal-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.card-pop__drawer-name {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-pop__drawer-you {
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: #43c22d;
  text-transform: uppercase;
}

/* ── Body text */
.card-pop__text {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
}

/* ── Jail-key keepsake row — softer parchment chip with key icon */
.card-pop__keep {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.7);
  text-align: left;
}
.card-pop__keep-icon {
  font-size: 18px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
}

/* ── Auto-close hint (passive viewers) */
.card-pop__hint {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: rgba(0, 0, 0, 0.4);
}

/* ── Got-it CTA (drawer only) — green pill matching the figma
   "btn-cta" (filled green, inset bottom shadow for the 3D feel). */
.card-pop__cta {
  width: 100%;
  height: 48px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  background: #43c22d;
  color: #fff;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  cursor: pointer;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  transition: transform 80ms ease, box-shadow 80ms ease;
}
.card-pop__cta:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}

/* ── Standalone close FAB below the card — Figma 138:16662: 44×44
   white circle, 4px black border, no offset shadow. */
.card-pop__close {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 4px solid #000;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 80ms ease;
}
.card-pop__close:active { transform: scale(0.94); }

/* ── Transitions */
.card-pop-enter-active,
.card-pop-leave-active { transition: opacity 0.22s ease; }
.card-pop-enter-from,
.card-pop-leave-to { opacity: 0; }
.card-pop-enter-active .card-stack,
.card-pop-leave-active .card-stack {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-pop-enter-from .card-stack,
.card-pop-leave-to .card-stack { transform: scale(0.94); }
</style>
