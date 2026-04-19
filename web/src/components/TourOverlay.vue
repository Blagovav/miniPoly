<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";
import { useTelegram } from "../composables/useTelegram";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { locale } = useI18n();
const { haptic } = useTelegram();
const step = ref(0);

// Reset to first slide every time the tour is re-opened so re-entry always
// starts fresh (vs mid-tour if user dismissed previously).
watch(
  () => props.open,
  (v) => {
    if (v) step.value = 0;
  },
);

const slides = computed(() => {
  const isRu = locale.value === "ru";
  return [
    {
      emoji: "👑",
      title: isRu ? "Добро пожаловать в Mini·Poly" : "Welcome to Mini·Poly",
      body: isRu
        ? "Классическая Монополия в Телеграме. Коротко покажу, с чего начать."
        : "Classic Monopoly inside Telegram. A quick tour to get you started.",
    },
    {
      emoji: "🎲",
      title: isRu ? "Ход за ходом" : "Turn by turn",
      body: isRu
        ? "На своём ходу жми «Бросить кубики» — фишка двигается автоматически. Попал на свободную клетку — можешь её купить."
        : "On your turn, tap «Roll dice» and your token moves. Land on a free property — buy it if you like.",
    },
    {
      emoji: "🏠",
      title: isRu ? "Монополия и дома" : "Monopolies and houses",
      body: isRu
        ? "Собрал все клетки одного цвета — получил монополию. Теперь можно строить дома и отели, и рента растёт в разы."
        : "Own the full colour group — that's a monopoly. Build houses and hotels to multiply rent.",
    },
    {
      emoji: "🤖",
      title: isRu ? "Не хватает игроков?" : "No opponents?",
      body: isRu
        ? "Хост в лобби может нажать «+ Добавить бота» — AI-игрок заполнит место и играет за каждый ход автоматически."
        : "The host can tap «+ Add a bot» in the lobby — an AI player fills a seat and plays every turn on its own.",
    },
    {
      emoji: "🎙",
      title: isRu ? "Войс-чат прямо в игре" : "Voice chat in game",
      body: isRu
        ? "В игре слева снизу кнопка микрофона. Тап — включил, тап ещё раз — выключил. Вокруг сигила говорящего горит золотое кольцо."
        : "A mic button sits bottom-left in-match. Tap on/off to talk. A gold ring around the speaker's sigil shows who's live.",
    },
  ];
});

const current = computed(() => slides.value[step.value]);
const isLast = computed(() => step.value === slides.value.length - 1);

function next() {
  if (isLast.value) return finish();
  haptic("light");
  step.value++;
}
function prev() {
  if (step.value === 0) return;
  haptic("light");
  step.value--;
}
function finish() {
  haptic("medium");
  emit("close");
}
function skip() {
  haptic("light");
  emit("close");
}
</script>

<template>
  <transition name="tour-fade">
    <div v-if="open" class="tour-scrim" @click="skip">
      <div class="tour-card" @click.stop>
        <button class="tour-card__skip" @click="skip" :aria-label="locale === 'ru' ? 'Пропустить' : 'Skip'">
          <Icon name="x" :size="14" color="var(--ink-3)" />
        </button>

        <div class="tour-card__emoji" aria-hidden>{{ current.emoji }}</div>
        <div class="tour-card__title">{{ current.title }}</div>
        <div class="tour-card__body">{{ current.body }}</div>

        <div class="tour-card__dots" aria-hidden>
          <span
            v-for="(_, i) in slides"
            :key="i"
            :class="['tour-card__dot', i === step && 'tour-card__dot--active']"
          />
        </div>

        <div class="tour-card__actions">
          <button
            class="btn btn-ghost"
            :disabled="step === 0"
            @click="prev"
          >
            {{ locale === 'ru' ? 'Назад' : 'Back' }}
          </button>
          <button class="btn btn-primary" @click="next">
            {{ isLast
              ? (locale === 'ru' ? 'Поехали' : 'Let\'s go')
              : (locale === 'ru' ? 'Дальше' : 'Next') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.tour-scrim {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(26, 15, 5, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.tour-card {
  position: relative;
  width: min(380px, 100%);
  background: var(--card-alt);
  border: 2px solid var(--primary);
  border-radius: 14px;
  padding: 28px 22px 20px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(26, 15, 5, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.45);
  animation: tour-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tour-card__skip {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
}
.tour-card__skip:hover { background: var(--card); }

.tour-card__emoji {
  font-size: 56px;
  line-height: 1;
  margin: 4px 0 10px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}
.tour-card__title {
  font-family: var(--font-title);
  font-size: 18px;
  letter-spacing: 0.06em;
  color: var(--ink);
  margin-bottom: 8px;
  text-transform: uppercase;
}
.tour-card__body {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink-2);
  line-height: 1.5;
  margin-bottom: 18px;
  padding: 0 8px;
}

.tour-card__dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 18px;
}
.tour-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line-strong);
  transition: background 0.2s ease, transform 0.2s ease;
}
.tour-card__dot--active {
  background: var(--primary);
  transform: scale(1.4);
}

.tour-card__actions {
  display: flex;
  gap: 10px;
}
.tour-card__actions .btn {
  flex: 1;
  padding: 11px;
  font-size: 14px;
}
.tour-card__actions .btn:disabled {
  opacity: 0.4;
  pointer-events: none;
}

@keyframes tour-pop {
  0% { transform: scale(0.85) translateY(8px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.tour-fade-enter-active, .tour-fade-leave-active { transition: opacity 0.25s ease; }
.tour-fade-enter-from, .tour-fade-leave-to { opacity: 0; }
</style>
