<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";

type ErrorKind = "offline" | "server" | "generic";

const props = withDefaults(defineProps<{
  kind?: ErrorKind;
  onRetry?: () => void;
  onHome?: () => void;
}>(), { kind: "generic" });

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

const L = computed(() => {
  const k = props.kind;
  return isRu.value ? {
    title: "Что-то пошло не так",
    sub: k === "offline" ? "Связь с королевством потеряна." : "Писарь уронил перо в чернильницу.",
    code: k === "offline" ? "CONNECTION LOST" : "ERROR #" + (k === "server" ? "503" : "418"),
    retry: "Попробовать снова",
    home: "В Тронный зал",
    hint: "Если ошибка повторяется — сообщите герольду.",
  } : {
    title: "Something went awry",
    sub: k === "offline" ? "The realm has lost its tether." : "The scribe has dropped his quill.",
    code: k === "offline" ? "CONNECTION LOST" : "ERROR #" + (k === "server" ? "503" : "418"),
    retry: "Try again",
    home: "Return to Throne Hall",
    hint: "If this persists — summon the herald.",
  };
});
</script>

<template>
  <div class="error-screen">
    <div class="error-screen__spacer"/>

    <div class="error-screen__art">
      <svg viewBox="0 0 160 160" width="160" height="160">
        <defs>
          <linearGradient id="errScrollFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f7eeda"/>
            <stop offset="1" stop-color="#e8dcb8"/>
          </linearGradient>
          <filter id="errSoftShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
          </filter>
        </defs>
        <g filter="url(#errSoftShadow)">
          <path d="M 28 36 L 132 36 Q 138 36 138 42 L 138 60 L 142 66 L 136 72 L 142 80 L 136 88 L 140 96 L 134 102 L 138 118 Q 138 124 132 124 L 92 124 L 84 132 L 76 124 L 28 124 Q 22 124 22 118 L 22 100 L 18 92 L 24 86 L 18 78 L 26 70 L 20 60 L 22 42 Q 22 36 28 36 Z"
            fill="url(#errScrollFill)" stroke="#8a7152" stroke-width="1.5"/>
          <path d="M 70 36 L 66 50 L 74 62 L 68 76 L 76 90 L 70 104 L 78 124"
            stroke="#c0a060" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-dasharray="2 3" opacity="0.5"/>
          <ellipse cx="52" cy="74" rx="10" ry="6" fill="#4a2e82" opacity="0.25"/>
          <circle cx="96" cy="86" r="3" fill="#4a2e82" opacity="0.4"/>
          <circle cx="104" cy="92" r="1.5" fill="#4a2e82" opacity="0.5"/>
          <circle cx="46" cy="92" r="1" fill="#4a2e82" opacity="0.5"/>
          <line x1="36" y1="54" x2="62" y2="54" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="82" y1="54" x2="124" y2="54" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="80" y1="68" x2="122" y2="68" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="80" y1="100" x2="116" y2="100" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="36" y1="112" x2="64" y2="112" stroke="#c9b88e" stroke-width="1.5" stroke-linecap="round"/>
        </g>
        <g class="error-screen__seal">
          <circle cx="84" cy="132" r="14" fill="#9a1c3a" stroke="#5a0818" stroke-width="1.5"/>
          <path d="M 84 118 L 90 126 L 84 132 L 90 140 L 84 146" stroke="#5a0818" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <path d="M 72 132 L 78 128 M 78 136 L 72 132 M 96 132 L 90 128 M 90 136 L 96 132" stroke="#f7eeda" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.7"/>
        </g>
      </svg>
    </div>

    <div class="error-screen__title">{{ L.title }}</div>
    <div class="error-screen__sub">{{ L.sub }}</div>
    <div class="error-screen__code">{{ L.code }}</div>

    <div class="error-screen__spacer"/>

    <div class="error-screen__buttons">
      <button class="btn btn-primary" style="padding: 12px;" @click="onRetry">
        <Icon name="dice" :size="16" color="#f7eeda"/>
        {{ L.retry }}
      </button>
      <button class="btn btn-ghost" style="padding: 12px;" @click="onHome">
        {{ L.home }}
      </button>
    </div>
    <div class="error-screen__hint">{{ L.hint }}</div>
  </div>
</template>

<style scoped>
.error-screen {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: max(50px, var(--csat, 0px)) 24px max(20px, var(--csab, 0px));
  overflow: auto;
  z-index: 100;
}
.error-screen__spacer { flex: 1; }
.error-screen__art {
  position: relative;
  width: 160px;
  height: 160px;
  margin: 0 auto 24px;
}
.error-screen__seal {
  transform-origin: 84px 132px;
  animation: error-wobble 3s ease-in-out infinite;
}
@keyframes error-wobble {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
.error-screen__title {
  font-family: var(--font-display);
  font-size: 24px;
  text-align: center;
  color: var(--ink);
  margin-bottom: 6px;
}
.error-screen__sub {
  font-size: 14px;
  text-align: center;
  color: var(--ink-3);
  line-height: 1.5;
  max-width: 300px;
  margin: 0 auto 14px;
}
.error-screen__code {
  display: inline-block;
  margin: 0 auto 28px;
  padding: 4px 10px;
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.16em;
  color: var(--ink-3);
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--card);
  align-self: center;
}
.error-screen__buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.error-screen__hint {
  font-size: 11px;
  color: var(--ink-4);
  text-align: center;
  line-height: 1.4;
}
</style>
