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
// so the player knows they can use it later (jail key in HUD + Pay/Card
// buttons when they actually land in jail).
const isJailKeyCard = computed(() =>
  // Card IDs come straight from shared/cards.ts:
  //   Chance "Get Out of Jail Free"          → "ch-gooj"
  //   Community Chest "Get Out of Jail Free" → "cc-gooj"
  // Earlier code mistyped the chest variant as "co-gooj", so half the
  // jail cards drawn auto-closed before the user could read the
  // "we saved this card for later" copy.
  current.value?.cardId === "ch-gooj" || current.value?.cardId === "cc-gooj",
);

// Only the drawer gets the interactive "Got it" close button — everyone
// else sees the card face-up (auto-closes) so two hands don't race on it.
const drawerId = computed(() => current.value?.by ?? null);
const drawer = computed(() =>
  drawerId.value ? game.room?.players.find((p) => p.id === drawerId.value) ?? null : null,
);
const isMyCard = computed(() => !!drawerId.value && drawerId.value === game.myPlayerId);

// Show the card ONLY after the drawer's token has finished its step-by-step
// walk. Server sets lastCard the instant the tile resolves, but the client
// is still animating the hop — popping the modal mid-walk feels like the
// state skipped ahead. Watch both lastCard.ts and animatingPlayerId so we
// fire the reveal on either (a) new card arriving when no animation or
// (b) the drawer's animation ending after a buffered card.
let lastShownTs = 0;
watch(
  [() => game.room?.lastCard?.ts, () => game.animatingPlayerId],
  () => {
    const card = game.room?.lastCard;
    if (!card || !card.ts) return;
    if (card.ts === lastShownTs) return;
    // Wait — drawer's token is still hopping. We'll re-evaluate when animId flips.
    if (game.animatingPlayerId === card.by) return;
    lastShownTs = card.ts;
    current.value = card;
    visible.value = true;
    if (timeout) clearTimeout(timeout);
    // Jail-key cards get a longer dwell so the keep-message is read.
    timeout = setTimeout(() => (visible.value = false), isJailKeyCard.value ? 5000 : 3500);
  },
  { immediate: true },
);

function close() {
  visible.value = false;
  if (timeout) clearTimeout(timeout);
}
</script>

<template>
  <transition name="card-pop">
    <div v-if="visible && current" class="modal-scrim" @click="isMyCard ? close() : undefined">
      <div
        class="decree"
        :class="current.deck === 'chance' ? 'decree--chance' : 'decree--chest'"
        @click.stop
      >
        <!-- Corner flourishes -->
        <div class="flourish flourish--tl" />
        <div class="flourish flourish--tr" />
        <div class="flourish flourish--bl" />
        <div class="flourish flourish--br" />

        <div class="decree__eyebrow">
          {{ current.deck === "chance"
            ? (locale === "ru" ? "Шанс" : "Chance")
            : (locale === "ru" ? "Общественная казна" : "Community Chest") }}
          <span v-if="drawer && !isMyCard" class="decree__drawer">
            {{ locale === "ru" ? `— тянет ${drawer.name}` : `— drawn by ${drawer.name}` }}
          </span>
        </div>

        <!-- Seal -->
        <div class="decree__seal">
          {{ current.deck === "chance" ? "?" : "⎔" }}
        </div>

        <div class="decree__text">
          {{ current.text[locale as Locale] }}
        </div>

        <div v-if="isJailKeyCard" class="decree__keep">
          <span class="decree__keep-key">🗝</span>
          <span>
            {{ locale === "ru"
              ? "Сохранена в инвентаре. Используй, когда попадёшь в тюрьму."
              : "Saved to your inventory. Use it next time you're jailed." }}
          </span>
        </div>

        <button
          v-if="isMyCard"
          class="btn btn-primary decree__close"
          @click="close"
        >
          {{ locale === "ru" ? "Понятно" : "Got it" }}
        </button>
        <div v-else class="decree__waiting">
          {{ locale === "ru" ? "Закроется автоматически…" : "Closes automatically…" }}
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
  z-index: 520;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.decree {
  position: relative;
  width: min(340px, 100%);
  padding: 24px 22px 20px;
  background: var(--card-alt);
  border-radius: 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  box-shadow: 0 20px 60px rgba(26, 15, 5, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  animation: scrollUnfurl 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.decree--chance {
  border: 2px solid var(--accent);
  background:
    radial-gradient(ellipse at 50% 0%, rgba(139, 26, 26, 0.12), transparent 65%),
    var(--card-alt);
}
.decree--chest {
  border: 2px solid var(--primary);
  background:
    radial-gradient(ellipse at 50% 0%, rgba(138, 104, 208, 0.15), transparent 65%),
    var(--card-alt);
}

/* ── Corner flourishes ── */
.flourish {
  position: absolute;
  width: 14px;
  height: 14px;
  pointer-events: none;
}
.flourish--tl { top: -1px; left: -1px; border-top-style: solid; border-left-style: solid; border-top-width: 2px; border-left-width: 2px; }
.flourish--tr { top: -1px; right: -1px; border-top-style: solid; border-right-style: solid; border-top-width: 2px; border-right-width: 2px; }
.flourish--bl { bottom: -1px; left: -1px; border-bottom-style: solid; border-left-style: solid; border-bottom-width: 2px; border-left-width: 2px; }
.flourish--br { bottom: -1px; right: -1px; border-bottom-style: solid; border-right-style: solid; border-bottom-width: 2px; border-right-width: 2px; }
.decree--chance .flourish { border-color: var(--accent); }
.decree--chest .flourish { border-color: var(--primary); }

/* ── Eyebrow ── */
.decree__eyebrow {
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.25em;
  color: var(--ink-3);
  text-transform: uppercase;
}

/* ── Seal ── */
.decree__seal {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin: 4px 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 30px;
  color: #fff;
  box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.3), inset 0 -2px 3px rgba(0, 0, 0, 0.3), 0 6px 14px rgba(0, 0, 0, 0.25);
}
.decree--chance .decree__seal {
  background: radial-gradient(circle at 35% 30%, #c04040 0%, #8b1a1a 55%, #5a0e0e 100%);
}
.decree--chest .decree__seal {
  background: radial-gradient(circle at 35% 30%, #8a68d0 0%, #5a3a9a 55%, #3e2272 100%);
}

/* ── Text ── */
.decree__text {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--ink);
  line-height: 1.45;
  max-width: 100%;
}

/* ── Button ── */
.decree__keep {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(212, 168, 74, 0.12);
  border: 1px solid rgba(212, 168, 74, 0.4);
  border-radius: 8px;
  font-size: 11px;
  color: var(--ink-2);
  line-height: 1.35;
  text-align: left;
}
.decree__keep-key {
  font-size: 18px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
}
.decree__close {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  font-size: 14px;
}
.decree__drawer {
  color: var(--ink-3);
  font-size: 10px;
  letter-spacing: 0.1em;
  margin-left: 6px;
  text-transform: none;
}
.decree__waiting {
  font-size: 11px;
  color: var(--ink-3);
  font-family: var(--font-body);
  font-style: italic;
  margin-top: 6px;
  opacity: 0.8;
}

/* ── Animations ── */
@keyframes scrollUnfurl {
  0% { transform: scaleY(0.25) translateY(-30px); opacity: 0; }
  60% { transform: scaleY(1.05) translateY(4px); opacity: 1; }
  100% { transform: scaleY(1) translateY(0); opacity: 1; }
}
.card-pop-enter-active, .card-pop-leave-active { transition: opacity 0.25s ease; }
.card-pop-enter-from, .card-pop-leave-to { opacity: 0; }
</style>
