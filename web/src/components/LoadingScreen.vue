<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

type Variant = "sigil" | "dice" | "scroll" | "coins";

// Each step advances through pending → active → done as the boot sequence
// progresses. Shown as a checklist under the main spinner so players can see
// what's actually happening (not just a frozen-looking splash).
export type BootStep = { label: string; status: "pending" | "active" | "done" };

const props = withDefaults(defineProps<{
  variant?: Variant;
  message?: string;
  fullscreen?: boolean;
  steps?: BootStep[];
}>(), { variant: "sigil", fullscreen: true });

const { locale } = useI18n();

const ticks = (() => {
  const arr: { i: number; x1: number; y1: number; x2: number; y2: number; sw: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i * 15) * Math.PI / 180;
    const long = i % 3 === 0;
    const r1 = 52, r2 = long ? 46 : 49;
    arr.push({
      i,
      x1: 60 + Math.cos(a) * r1,
      y1: 60 + Math.sin(a) * r1,
      x2: 60 + Math.cos(a) * r2,
      y2: 60 + Math.sin(a) * r2,
      sw: long ? 1.4 : 0.8,
    });
  }
  return arr;
})();

const msg = computed(() => {
  if (props.message) return props.message;
  const isRu = locale.value === "ru";
  const map = isRu ? {
    sigil: "Загружаем игру…",
    dice: "Бросаем кубики…",
    scroll: "Готовим доску…",
    coins: "Считаем монеты…",
  } : {
    sigil: "Loading the game…",
    dice: "Rolling the dice…",
    scroll: "Preparing the board…",
    coins: "Counting the cash…",
  };
  return map[props.variant];
});
</script>

<template>
  <div :class="fullscreen ? 'loading-screen' : 'loading-overlay loading-inline'">
    <div v-if="fullscreen" class="loading-bg"/>
    <div class="loading-inner">
      <div class="loading-art">
        <!-- sigil -->
        <div v-if="variant === 'sigil'" class="ls-sigil">
          <svg viewBox="0 0 120 120" width="140" height="140">
            <defs>
              <radialGradient id="sg-ring" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#f5d98a" stop-opacity="0"/>
                <stop offset="70%" stop-color="#f5d98a" stop-opacity="0"/>
                <stop offset="92%" stop-color="#d4a84a" stop-opacity="0.9"/>
                <stop offset="100%" stop-color="#8b6914" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <g class="ls-spin-slow">
              <circle cx="60" cy="60" r="54" fill="none" stroke="url(#sg-ring)" stroke-width="2"/>
              <line v-for="t in ticks" :key="t.i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
                stroke="#8b6914" :stroke-width="t.sw" opacity="0.7"/>
            </g>
            <g class="ls-spin-fast-rev">
              <circle cx="60" cy="60" r="40" fill="none" stroke="#8b6914" stroke-width="0.6" stroke-dasharray="2 4" opacity="0.55"/>
            </g>
            <g class="ls-pulse">
              <path d="M40 38 L80 38 L80 64 Q80 82 60 92 Q40 82 40 64 Z" fill="#6b4cc4" stroke="#3e2272" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M44 38 L46 28 L50 34 L54 24 L60 32 L66 24 L70 34 L74 28 L76 38 Z" fill="#d4a84a" stroke="#8b6914" stroke-width="1" stroke-linejoin="round"/>
              <circle cx="46" cy="28" r="1.3" fill="#8b6914"/>
              <circle cx="54" cy="24" r="1.5" fill="#8b6914"/>
              <circle cx="66" cy="24" r="1.5" fill="#8b6914"/>
              <circle cx="74" cy="28" r="1.3" fill="#8b6914"/>
              <path d="M60 54 Q57 50 57 47 Q57 44 60 46 Q63 44 63 47 Q63 50 60 54 Z M55 58 Q52 56 54 53 Q57 55 58 56 Z M65 58 Q68 56 66 53 Q63 55 62 56 Z" fill="#d4a84a" opacity="0.95"/>
              <line x1="52" y1="60" x2="68" y2="60" stroke="#d4a84a" stroke-width="1.5"/>
              <path d="M60 62 L60 76" stroke="#d4a84a" stroke-width="1.3"/>
            </g>
          </svg>
        </div>

        <!-- dice -->
        <div v-else-if="variant === 'dice'" class="ls-dice">
          <div class="ls-die ls-die-1">
            <svg viewBox="0 0 40 40" width="56" height="56">
              <rect x="2" y="2" width="36" height="36" rx="6" fill="#fff" stroke="#8b6914" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="2.5" fill="#2a1d10"/>
              <circle cx="28" cy="12" r="2.5" fill="#2a1d10"/>
              <circle cx="20" cy="20" r="2.5" fill="#2a1d10"/>
              <circle cx="12" cy="28" r="2.5" fill="#2a1d10"/>
              <circle cx="28" cy="28" r="2.5" fill="#2a1d10"/>
            </svg>
          </div>
          <div class="ls-die ls-die-2">
            <svg viewBox="0 0 40 40" width="56" height="56">
              <rect x="2" y="2" width="36" height="36" rx="6" fill="#fff" stroke="#8b6914" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="2.5" fill="#2a1d10"/>
              <circle cx="28" cy="12" r="2.5" fill="#2a1d10"/>
              <circle cx="28" cy="28" r="2.5" fill="#2a1d10"/>
            </svg>
          </div>
        </div>

        <!-- scroll -->
        <div v-else-if="variant === 'scroll'" class="ls-scroll">
          <svg viewBox="0 0 160 90" width="180" height="110">
            <rect x="8" y="20" width="14" height="50" rx="7" fill="#8b6914" stroke="#4a3008" stroke-width="1.5"/>
            <rect x="11" y="20" width="8" height="50" rx="4" fill="#b88834"/>
            <rect x="138" y="20" width="14" height="50" rx="7" fill="#8b6914" stroke="#4a3008" stroke-width="1.5"/>
            <rect x="141" y="20" width="8" height="50" rx="4" fill="#b88834"/>
            <path d="M22 22 L138 22 L138 68 L22 68 Z" fill="#f7eeda" stroke="#c8b07c" stroke-width="1"/>
            <g class="ls-scroll-lines">
              <line x1="32" y1="32" x2="128" y2="32" stroke="#6b4a2a" stroke-width="1.2" opacity="0.6"/>
              <line x1="32" y1="38" x2="120" y2="38" stroke="#6b4a2a" stroke-width="1.2" opacity="0.6"/>
              <line x1="32" y1="44" x2="124" y2="44" stroke="#6b4a2a" stroke-width="1.2" opacity="0.6"/>
              <line x1="32" y1="50" x2="110" y2="50" stroke="#6b4a2a" stroke-width="1.2" opacity="0.6"/>
              <line x1="32" y1="56" x2="116" y2="56" stroke="#6b4a2a" stroke-width="1.2" opacity="0.6"/>
            </g>
            <g class="ls-pulse">
              <circle cx="80" cy="70" r="7" fill="#8b1a1a" stroke="#4a0e0e" stroke-width="1"/>
              <text x="80" y="73" text-anchor="middle" font-size="7" fill="#d4a84a" font-family="serif" font-weight="700">M</text>
            </g>
          </svg>
        </div>

        <!-- coins -->
        <div v-else-if="variant === 'coins'" class="ls-coins">
          <div v-for="i in 5" :key="i" class="ls-coin" :style="{ animationDelay: ((i - 1) * 0.12) + 's' }">
            <svg viewBox="0 0 40 40" width="48" height="48">
              <defs>
                <radialGradient :id="'coin-grad-' + i" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stop-color="#f5d98a"/>
                  <stop offset="60%" stop-color="#d4a84a"/>
                  <stop offset="100%" stop-color="#8b6914"/>
                </radialGradient>
              </defs>
              <circle cx="20" cy="20" r="17" :fill="`url(#coin-grad-${i})`" stroke="#4a3008" stroke-width="1.2"/>
              <circle cx="20" cy="20" r="13" fill="none" stroke="#8b6914" stroke-width="0.7"/>
              <text x="20" y="25" text-anchor="middle" font-size="13" fill="#4a3008" font-family="serif" font-weight="700">◈</text>
            </svg>
          </div>
        </div>
      </div>

      <div class="loading-text">
        <div class="loading-title">Mini · Poly</div>
        <div class="loading-sub">{{ msg }}</div>
        <div v-if="!steps?.length" class="loading-dots" aria-hidden>
          <span/><span/><span/>
        </div>
        <ul v-else class="loading-steps">
          <li
            v-for="(s, i) in steps"
            :key="i"
            :class="['loading-step', `loading-step--${s.status}`]"
          >
            <span class="loading-step__mark" aria-hidden>
              <template v-if="s.status === 'done'">✓</template>
              <template v-else-if="s.status === 'active'">◌</template>
              <template v-else>·</template>
            </span>
            <span class="loading-step__label">{{ s.label }}</span>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="fullscreen" class="loading-foot">Anno MMXXVI · Guild of Mapmakers</div>
  </div>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  z-index: 100;
  overflow: hidden;
  padding-top: max(var(--sat, 0px), var(--csat, 0px));
  padding-bottom: max(var(--sab, 0px), var(--csab, 0px));
}
.loading-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 30%, rgba(107, 76, 196, 0.08), transparent 60%),
    radial-gradient(circle at 50% 85%, rgba(212, 168, 74, 0.06), transparent 55%);
  pointer-events: none;
}
.loading-overlay {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  animation: ls-fade-in 200ms ease-out;
}
.loading-inline .loading-inner { padding: 20px; }
@keyframes ls-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.loading-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 0 32px;
  text-align: center;
}
.loading-art {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-title {
  font-family: var(--font-title);
  font-size: 34px;
  letter-spacing: 0.18em;
  color: var(--primary);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.loading-sub {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink-2);
  letter-spacing: 0.05em;
  font-style: italic;
}
.loading-dots {
  display: inline-flex;
  gap: 6px;
  margin-top: 12px;
  justify-content: center;
}
.loading-dots span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: ls-dot 1.2s ease-in-out infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 0.15s; }
.loading-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes ls-dot {
  0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-4px); }
}
.loading-steps {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  min-width: 220px;
}
.loading-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink-3);
  transition: color 0.2s ease, opacity 0.2s ease;
  opacity: 0.5;
}
.loading-step--active {
  color: var(--ink);
  opacity: 1;
}
.loading-step--done {
  color: var(--ink-2);
  opacity: 1;
}
.loading-step__mark {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  flex-shrink: 0;
  background: rgba(107, 76, 196, 0.08);
  color: var(--ink-4);
  border: 1px solid rgba(107, 76, 196, 0.12);
}
.loading-step--active .loading-step__mark {
  background: rgba(107, 76, 196, 0.18);
  color: var(--primary);
  border-color: rgba(107, 76, 196, 0.5);
  animation: ls-step-spin 1s linear infinite;
}
.loading-step--done .loading-step__mark {
  background: var(--emerald, #2d7a4f);
  color: #fff;
  border-color: var(--emerald, #2d7a4f);
}
@keyframes ls-step-spin {
  to { transform: rotate(360deg); }
}
.loading-foot {
  position: absolute;
  bottom: calc(24px + max(var(--sab, 0px), var(--csab, 0px)));
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-4);
}

/* ── Sigil ── */
.ls-sigil :deep(.ls-spin-slow) {
  transform-origin: 60px 60px;
  animation: ls-spin-slow 12s linear infinite;
}
.ls-sigil :deep(.ls-spin-fast-rev) {
  transform-origin: 60px 60px;
  animation: ls-spin-fast-rev 6s linear infinite;
}
.ls-sigil :deep(.ls-pulse) {
  transform-origin: 60px 60px;
  animation: ls-pulse 2.2s ease-in-out infinite;
}
@keyframes ls-spin-slow { to { transform: rotate(360deg); } }
@keyframes ls-spin-fast-rev { to { transform: rotate(-360deg); } }
@keyframes ls-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(107, 76, 196, 0)); }
  50% { transform: scale(1.04); filter: drop-shadow(0 0 8px rgba(107, 76, 196, 0.35)); }
}

/* ── Dice ── */
.ls-dice {
  display: flex;
  gap: 14px;
  align-items: center;
}
.ls-die {
  animation: ls-tumble 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2));
}
.ls-die-2 { animation-delay: 0.2s; }
@keyframes ls-tumble {
  0% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-18px) rotate(140deg); }
  60% { transform: translateY(-4px) rotate(280deg); }
  100% { transform: translateY(0) rotate(360deg); }
}

/* ── Scroll ── */
.ls-scroll :deep(.ls-scroll-lines line) {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: ls-line 2.4s ease-in-out infinite;
}
.ls-scroll :deep(.ls-scroll-lines line:nth-child(2)) { animation-delay: 0.15s; }
.ls-scroll :deep(.ls-scroll-lines line:nth-child(3)) { animation-delay: 0.3s; }
.ls-scroll :deep(.ls-scroll-lines line:nth-child(4)) { animation-delay: 0.45s; }
.ls-scroll :deep(.ls-scroll-lines line:nth-child(5)) { animation-delay: 0.6s; }
.ls-scroll :deep(.ls-pulse) {
  transform-origin: 80px 70px;
  animation: ls-pulse 2.2s ease-in-out infinite;
}
@keyframes ls-line {
  0% { stroke-dashoffset: 100; }
  50%, 100% { stroke-dashoffset: 0; }
}

/* ── Coins ── */
.ls-coins {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 100px;
  position: relative;
}
.ls-coin {
  position: absolute;
  left: 50%;
  margin-left: -24px;
  animation: ls-coin 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.25));
}
@keyframes ls-coin {
  0% { transform: translateY(-60px) rotate(0deg); opacity: 0; }
  20% { opacity: 1; }
  50% { transform: translateY(0) rotate(180deg); opacity: 1; }
  80% { transform: translateY(0) rotate(360deg); opacity: 1; }
  100% { transform: translateY(-60px) rotate(540deg); opacity: 0; }
}
</style>
