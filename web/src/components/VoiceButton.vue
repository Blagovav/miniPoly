<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";
import { useTelegram } from "../composables/useTelegram";
import type { VoiceClient } from "../composables/useVoice";

const props = defineProps<{ voice: VoiceClient }>();
const { t } = useI18n();
const { haptic } = useTelegram();

const label = computed(() => {
  if (props.voice.isConnecting.value) return t("voice.connecting");
  if (!props.voice.isActive.value) return t("voice.tapToJoin");
  if (props.voice.isTransmitting.value) return t("voice.talking");
  return t("voice.holdToTalk");
});

function onPointerDown(ev: PointerEvent) {
  // Don't interfere with the inline × disarm handle.
  if ((ev.target as HTMLElement).closest(".vb__disarm")) return;
  ev.preventDefault();
  (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  if (!props.voice.isActive.value) {
    // First press: ask for mic + join voice. User needs to release and press
    // again to actually transmit — that's expected behaviour (permission grant
    // mid-press is unreliable on iOS Telegram WebView).
    if (props.voice.isConnecting.value) return;
    haptic("medium");
    void props.voice.toggle();
    return;
  }
  haptic("heavy");
  props.voice.press();
}

function onPointerUp() {
  if (props.voice.isTransmitting.value) {
    haptic("light");
    props.voice.release();
  }
}

function disarm(ev: MouseEvent) {
  ev.stopPropagation();
  haptic("light");
  props.voice.stop();
}
</script>

<template>
  <div class="vb-wrap">
    <transition name="vb-err">
      <div v-if="voice.lastError.value" class="vb__error">
        {{
          voice.lastError.value === "permission"
            ? t("voice.errPermission")
            : voice.lastError.value === "no-device"
              ? t("voice.errNoDevice")
              : t("voice.errFailed")
        }}
      </div>
    </transition>

    <button
      class="vb"
      :class="{
        'vb--active': voice.isActive.value,
        'vb--transmitting': voice.isTransmitting.value,
        'vb--connecting': voice.isConnecting.value,
      }"
      :aria-label="label"
      :aria-pressed="voice.isTransmitting.value"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
      @contextmenu.prevent
    >
      <span v-if="voice.isActive.value" class="vb__disarm" @click="disarm" :aria-label="t('voice.leave')">
        <Icon name="x" :size="10" color="#fff" />
      </span>

      <Icon
        :name="voice.isActive.value ? 'mic' : 'micOff'"
        :size="22"
        color="#f7eeda"
      />

      <span v-if="voice.isTransmitting.value" class="vb__pulse vb__pulse--1" />
      <span v-if="voice.isTransmitting.value" class="vb__pulse vb__pulse--2" />
    </button>
  </div>
</template>

<style scoped>
.vb-wrap {
  position: fixed;
  /* Отодвигаем от нижнего края с учётом safe-area (notch / home bar)
     и Telegram bottom bar (v8+). iOS/Android не обрезает кнопку. */
  bottom: calc(16px + var(--tg-safe-area-inset-bottom, 0px) + var(--tg-content-safe-area-inset-bottom, 0px));
  right: 80px;
  z-index: 80;
}

.vb {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  position: relative;
  background: linear-gradient(180deg, var(--ink-3) 0%, var(--ink-2) 60%, var(--ink) 100%);
  color: #f7eeda;
  border: 1px solid var(--ink);
  box-shadow:
    0 4px 12px rgba(42, 29, 16, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.12s ease, filter 0.12s ease, background 0.2s ease;
}
.vb:hover { filter: brightness(1.05); }
.vb:active { transform: scale(0.94); }

.vb--active {
  background: linear-gradient(180deg, var(--primary-soft) 0%, var(--primary) 60%, var(--primary-deep) 100%);
  border-color: var(--primary-deep);
  box-shadow:
    0 4px 12px rgba(62, 34, 114, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.vb--transmitting {
  background: linear-gradient(180deg, var(--gold-soft) 0%, var(--gold) 55%, #8b6914 100%);
  border-color: #8b6914;
  box-shadow:
    0 0 0 2px rgba(184, 137, 46, 0.5),
    0 4px 16px rgba(184, 137, 46, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transform: scale(1.04);
}

.vb--connecting {
  animation: vb-breath 1.1s ease-in-out infinite;
}

/* Expanding pulse rings while transmitting */
.vb__pulse {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  opacity: 0.6;
  pointer-events: none;
  animation: vb-pulse 1.2s ease-out infinite;
}
.vb__pulse--2 { animation-delay: 0.6s; }

/* Small × badge to fully leave voice (hide mic + drop peers). */
.vb__disarm {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent);
  display: grid;
  place-items: center;
  border: 1px solid var(--accent);
  box-shadow: 0 1px 3px rgba(139, 26, 26, 0.4);
  cursor: pointer;
  z-index: 2;
}
.vb__disarm:hover { filter: brightness(1.1); }

.vb__error {
  position: absolute;
  right: 0;
  bottom: 60px;
  white-space: nowrap;
  font-size: 11px;
  font-family: var(--font-body);
  color: #fff;
  background: var(--accent);
  padding: 5px 9px;
  border-radius: var(--r-md);
  box-shadow: 0 4px 10px rgba(139, 26, 26, 0.3);
}
.vb-err-enter-active, .vb-err-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.vb-err-enter-from, .vb-err-leave-to { opacity: 0; transform: translateY(4px); }

@keyframes vb-pulse {
  0%   { transform: scale(1);   opacity: 0.55; }
  100% { transform: scale(1.7); opacity: 0; }
}
@keyframes vb-breath {
  0%, 100% { filter: brightness(0.9); }
  50%      { filter: brightness(1.15); }
}
</style>
