<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import type { DrawnCard, Locale } from "../../../shared/types";

const { locale } = useI18n();
const game = useGameStore();

const visible = ref(false);
const current = ref<DrawnCard | null>(null);
let timeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => game.room?.lastCard?.ts,
  (ts) => {
    if (!ts || !game.room?.lastCard) return;
    current.value = game.room.lastCard;
    visible.value = true;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => (visible.value = false), 3500);
  },
);

function close() {
  visible.value = false;
  if (timeout) clearTimeout(timeout);
}
</script>

<template>
  <transition name="card-pop">
    <div v-if="visible && current" class="modal-scrim" @click="close">
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
            ? (locale === "ru" ? "Указ" : "Royal Decree")
            : (locale === "ru" ? "Сундук казны" : "Town Chest") }}
        </div>

        <!-- Seal -->
        <div class="decree__seal">
          {{ current.deck === "chance" ? "?" : "⎔" }}
        </div>

        <div class="decree__text">
          {{ current.text[locale as Locale] }}
        </div>

        <button class="btn btn-primary decree__close" @click="close">
          {{ locale === "ru" ? "Принять волю" : "As the crown wills" }}
        </button>
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
  border: 2px solid var(--gold);
  background:
    radial-gradient(ellipse at 50% 0%, rgba(212, 168, 74, 0.15), transparent 65%),
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
.decree--chance .flourish { border-color: var(--gold); }
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
  background: radial-gradient(circle at 35% 30%, #d4a84a 0%, #b8892e 55%, #8b6914 100%);
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
.decree__close {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
  font-size: 14px;
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
