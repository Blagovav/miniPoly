<script setup lang="ts">
/**
 * Maintenance screen — Figma 133:14968.
 * Renders instead of the router when the app is in maintenance mode (see
 * App.vue for the trigger). Re-uses the home blue bg + bg-pattern via the
 * `home-figma-root` class so the safe-area strips stay tinted, and drops
 * the confused-mascot illustration centred in the viewport with a two-
 * line "we'll be back" message underneath. No interactions — the user
 * dismisses by closing the Telegram mini-app.
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

const lines = computed(() =>
  isRu.value
    ? ["Наши инженеры активно улучшают игру.", "Возвращайтесь позже"]
    : ["Our engineers are improving the game.", "Check back soon"],
);

// Reuse the Home blue background painter so the Telegram chrome and
// safe-areas don't bleed through to the parchment default.
onMounted(() => {
  document.documentElement.classList.add("home-figma-root");
  document.body.classList.add("home-figma-root");
});
onBeforeUnmount(() => {
  document.documentElement.classList.remove("home-figma-root");
  document.body.classList.remove("home-figma-root");
});
</script>

<template>
  <div class="maintenance">
    <div class="maintenance__inner">
      <div class="maintenance__art" aria-hidden="true">
        <img src="/figma/lobby/confused-mascot.webp" alt="" />
      </div>
      <p class="maintenance__msg">
        <span v-for="(line, i) in lines" :key="i" class="maintenance__line">
          {{ line }}
        </span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.maintenance {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  /* bg painted on <body> via home-figma-root */
  background: transparent;
  color: #fff;
}

.maintenance__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
  /* Figma puts the mascot+text block vertically near the top half;
     translate slightly upward so the centre of the artwork lands at
     ~y=380 to match the canvas. */
  transform: translateY(-32px);
  width: 100%;
  max-width: 345px;
}

.maintenance__art {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  user-select: none;
}
.maintenance__art img {
  width: 274px;
  height: 274px;
  object-fit: contain;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.35));
}

.maintenance__msg {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 30px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}
.maintenance__line {
  display: block;
}
</style>
