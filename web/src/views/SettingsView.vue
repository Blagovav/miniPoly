<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { useSettings } from "../composables/useSettings";
import { setLocale } from "../i18n";

const { locale } = useI18n();
const router = useRouter();
const { haptic } = useTelegram();
const settings = useSettings();

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Настройки",
      sound: "Звук",
      vibration: "Вибрация",
      motion: "Тряска для броска",
      language: "Язык игры",
      langTitle: "Язык игры",
      langRu: "Русский",
      langEn: "English",
      backAria: "Закрыть",
      motionTitle: "Включить тряску?",
      motionBody: "Сейчас iOS попросит доступ к датчикам движения. Это нужно только чтобы кубики бросались встряхиванием телефона — мы не отправляем данные о движении на сервер и не можем по ним определить ваше местоположение.",
      motionEnable: "Включить",
      motionCancel: "Отмена",
    }
  : {
      title: "Settings",
      sound: "Sound",
      vibration: "Vibration",
      motion: "Shake to roll",
      language: "Language",
      langTitle: "Language",
      langRu: "Русский",
      langEn: "English",
      backAria: "Close",
      motionTitle: "Enable shake-to-roll?",
      motionBody: "iOS will ask for access to motion sensors. We only use this to roll the dice when you shake your phone — motion data never leaves the device and can't be used to track your location.",
      motionEnable: "Enable",
      motionCancel: "Cancel",
    });

const langLabel = computed(() => locale.value === "ru" ? L.value.langRu : L.value.langEn);

const langOpen = ref(false);

function close() {
  haptic("light");
  router.back();
}

function toggle(key: "sound" | "vibration") {
  haptic("light");
  settings.value[key] = !settings.value[key];
}

/* Motion is a special case: enabling triggers the iOS DeviceMotion
 * permission prompt, which scares people if it shows up uninvited.
 * Show an explanation sheet first so the prompt arrives in a context
 * the user has already opted into. Disabling can flip immediately —
 * we don't need consent to stop listening. */
const motionConfirmOpen = ref(false);
function toggleMotion() {
  haptic("light");
  if (settings.value.motion) {
    settings.value.motion = false;
    return;
  }
  motionConfirmOpen.value = true;
}
function confirmMotionEnable() {
  haptic("medium");
  motionConfirmOpen.value = false;
  // Flip the setting — RoomView's watcher picks this up and calls
  // shake.start(), which is what surfaces the iOS permission prompt.
  // If the user denies the prompt we leave the toggle on; useShake
  // resolves false but the listener never attaches, so the toggle
  // stays cosmetic until they re-grant via OS settings.
  settings.value.motion = true;
}
function cancelMotionEnable() {
  haptic("light");
  motionConfirmOpen.value = false;
}

function openLang() {
  haptic("light");
  langOpen.value = true;
}
function closeLang() {
  langOpen.value = false;
}
function pickLang(l: "ru" | "en") {
  haptic("medium");
  setLocale(l);
  langOpen.value = false;
}

onMounted(() => {
  document.documentElement.classList.add("settings-figma-root");
  document.body.classList.add("settings-figma-root");
});
onUnmounted(() => {
  document.documentElement.classList.remove("settings-figma-root");
  document.body.classList.remove("settings-figma-root");
});
</script>

<template>
  <div class="app settings-v2">
    <div class="settings-v2__navbar">
      <h1 class="settings-v2__title">{{ L.title }}</h1>
      <button
        class="settings-v2__close"
        :aria-label="L.backAria"
        @click="close"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="#000"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <div class="settings-v2__options">
      <button
        type="button"
        class="settings-v2__row"
        @click="toggle('sound')"
      >
        <span class="settings-v2__row-label">
          <img class="settings-v2__icon" src="/figma/settings/sound.webp" alt="" />
          <span>{{ L.sound }}</span>
        </span>
        <span
          class="settings-v2__toggle"
          :class="{ 'settings-v2__toggle--on': settings.sound }"
          aria-hidden="true"
        >
          <span class="settings-v2__knob" />
        </span>
      </button>

      <button
        type="button"
        class="settings-v2__row"
        @click="toggle('vibration')"
      >
        <span class="settings-v2__row-label">
          <img class="settings-v2__icon" src="/figma/settings/vibration.webp" alt="" />
          <span>{{ L.vibration }}</span>
        </span>
        <span
          class="settings-v2__toggle"
          :class="{ 'settings-v2__toggle--on': settings.vibration }"
          aria-hidden="true"
        >
          <span class="settings-v2__knob" />
        </span>
      </button>

      <button
        type="button"
        class="settings-v2__row"
        @click="toggleMotion"
      >
        <span class="settings-v2__row-label">
          <img class="settings-v2__icon" src="/figma/settings/motion.webp" alt="" />
          <span>{{ L.motion }}</span>
        </span>
        <span
          class="settings-v2__toggle"
          :class="{ 'settings-v2__toggle--on': settings.motion }"
          aria-hidden="true"
        >
          <span class="settings-v2__knob" />
        </span>
      </button>

      <button
        type="button"
        class="settings-v2__row"
        @click="openLang"
      >
        <span class="settings-v2__row-label">
          <img class="settings-v2__icon" src="/figma/settings/language.webp" alt="" />
          <span>{{ L.language }}</span>
        </span>
        <span class="settings-v2__row-value">
          <span>{{ langLabel }}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              stroke="#000"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
        </span>
      </button>
    </div>

    <!-- ── Motion-permission explainer. Surfaces BEFORE the iOS
         DeviceMotion prompt so the user knows what's about to happen
         and why it's safe — playtester 2026-05-04 reported the bare
         OS prompt felt intrusive. Tapping Enable flips the setting,
         which makes RoomView call shake.start() → triggers the OS
         dialog from a user-gesture context. -->
    <transition name="lang-fade">
      <div
        v-if="motionConfirmOpen"
        class="lang-backdrop"
        @click.self="cancelMotionEnable"
      >
        <div class="lang-card lang-card--explain">
          <h2 class="lang-card__title">{{ L.motionTitle }}</h2>
          <p class="lang-card__body">{{ L.motionBody }}</p>
          <div class="lang-card__actions">
            <button
              type="button"
              class="lang-action lang-action--ghost"
              @click="cancelMotionEnable"
            >{{ L.motionCancel }}</button>
            <button
              type="button"
              class="lang-action lang-action--primary"
              @click="confirmMotionEnable"
            >{{ L.motionEnable }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ── Language picker (Figma 138:16665). Bottom-anchored parchment
         card with radio rows + a separate close-back FAB below. -->
    <transition name="lang-fade">
      <div
        v-if="langOpen"
        class="lang-backdrop"
        @click.self="closeLang"
      >
        <div class="lang-card">
          <h2 class="lang-card__title">{{ L.langTitle }}</h2>
          <div class="lang-card__list">
            <button
              type="button"
              class="lang-row"
              :class="{ 'lang-row--active': locale === 'ru' }"
              @click="pickLang('ru')"
            >
              <span class="lang-row__label">{{ L.langRu }}</span>
              <span class="lang-radio" :class="{ 'lang-radio--on': locale === 'ru' }">
                <span class="lang-radio__dot" />
              </span>
            </button>
            <button
              type="button"
              class="lang-row"
              :class="{ 'lang-row--active': locale === 'en' }"
              @click="pickLang('en')"
            >
              <span class="lang-row__label">{{ L.langEn }}</span>
              <span class="lang-radio" :class="{ 'lang-radio--on': locale === 'en' }">
                <span class="lang-radio__dot" />
              </span>
            </button>
          </div>
        </div>
        <button
          type="button"
          class="lang-close"
          :aria-label="L.backAria"
          @click="closeLang"
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
    </transition>
  </div>
</template>

<style scoped>
.settings-v2 {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: transparent;
  color: #fff;
  overflow: hidden;
  font-family: 'Golos Text', sans-serif;
}

/* ── Navbar (Figma 133:16214). Title left-aligned, close button on the
   right at navbar y=6 (same anchor the rooms back button uses). */
.settings-v2__navbar {
  position: relative;
  flex-shrink: 0;
  padding: 16px 24px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
}
.settings-v2__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 24px;
  line-height: 30px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}
.settings-v2__close {
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 120ms ease;
}
.settings-v2__close:active { transform: scale(0.92); }

/* ── Options stack (Figma 136:16253). Each row is a parchment pill with
   icon + label on the left and either a toggle or a value+chevron on
   the right. Rows are <button> so the whole row is the tap target. */
.settings-v2__options {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.settings-v2__row {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  padding: 8px 12px;
  background: #faf3e2;
  border: none;
  border-radius: 18px;
  cursor: pointer;
  color: #000;
  text-align: left;
  transition: transform 120ms ease;
}
.settings-v2__row:active { transform: scale(0.99); }
.settings-v2__row-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.settings-v2__icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  pointer-events: none;
  flex-shrink: 0;
}
.settings-v2__row-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}

/* ── Toggle (Figma 136:16258). 48×26 track with a 22px knob; ON state
   slides the knob right and flips the track to the green action color. */
.settings-v2__toggle {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 26px;
  border-radius: 100px;
  background: rgba(0, 0, 0, 0.2);
  transition: background-color 180ms ease;
}
.settings-v2__toggle--on { background: #43c22d; }
.settings-v2__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 180ms cubic-bezier(0.3, 1.2, 0.4, 1);
}
.settings-v2__toggle--on .settings-v2__knob { transform: translateX(22px); }

/* ── Language picker modal (Figma 138:16665). Bottom-anchored parchment
   card with white radio rows; standalone close FAB sits below it. The
   backdrop intercepts taps to dismiss. */
.lang-backdrop {
  position: fixed;
  inset: 0;
  z-index: 320;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding: 0 24px calc(24px + var(--tg-safe-area-inset-bottom, 0px));
}
.lang-card {
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}
.lang-card__title {
  margin: 0;
  width: 100%;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #000;
}
.lang-card__list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lang-row {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  height: 48px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 18px;
  cursor: pointer;
  color: #000;
  transition: background-color 120ms ease;
}
.lang-row__label {
  flex: 1;
  min-width: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.lang-radio {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lang-radio::before {
  content: "";
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 0, 0, 0.4);
  background: transparent;
  transition: border-color 160ms ease;
}
.lang-radio--on::before { border-color: #43c22d; }
.lang-radio__dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #43c22d;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 160ms ease, transform 160ms ease;
}
.lang-radio--on .lang-radio__dot { opacity: 1; transform: scale(1); }

/* Variant of the bottom sheet used for the motion-permission explainer:
   smaller body copy + two-up action buttons instead of a radio list. */
.lang-card--explain { gap: 16px; }
.lang-card__body {
  margin: 0;
  width: 100%;
  text-align: center;
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.7);
}
.lang-card__actions {
  display: flex;
  gap: 8px;
  width: 100%;
}
.lang-action {
  flex: 1;
  height: 44px;
  border-radius: 999px;
  border: none;
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 13px;
  line-height: 16px;
  cursor: pointer;
  transition: transform 120ms ease, filter 120ms ease;
}
.lang-action:active { transform: scale(0.98); }
.lang-action--ghost {
  background: #fff;
  color: #000;
  border: 1px solid rgba(0, 0, 0, 0.16);
}
.lang-action--primary {
  background: linear-gradient(104deg, #005eff 0%, #6f4bff 100%);
  color: #fff;
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.32);
}

.lang-close {
  margin-top: 32px;
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
  transition: transform 120ms ease;
}
.lang-close:active { transform: scale(0.92); }

.lang-fade-enter-active, .lang-fade-leave-active {
  transition: opacity 200ms ease;
}
.lang-fade-enter-active .lang-card,
.lang-fade-leave-active .lang-card {
  transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.lang-fade-enter-from, .lang-fade-leave-to { opacity: 0; }
.lang-fade-enter-from .lang-card,
.lang-fade-leave-to .lang-card {
  transform: translateY(24px);
}

@media (min-width: 900px) {
  .settings-v2__navbar { padding: 24px 40px 20px; }
  .settings-v2__options { padding: 20px 40px 32px; }
  .settings-v2__title { font-size: 28px; line-height: 32px; }
}
</style>

<style>
/* Blue background + pattern painted onto <html>/<body> so Telegram safe-
   area strips (top/bottom) stay blue instead of flashing the parchment
   #f0e4c8 from the global stylesheet. Mirrors the approach used by
   HomeView and RoomsView. */
html.settings-figma-root,
body.settings-figma-root {
  background-color: #0d68db !important;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
}
body.settings-figma-root #app,
body.settings-figma-root .app-root,
body.settings-figma-root .app-main,
body.settings-figma-root .settings-v2 {
  background: transparent !important;
}
</style>
