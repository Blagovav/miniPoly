<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

// Paint html/body blue so Telegram safe-area strips stay blue during the
// boot flash instead of showing the parchment #f0e4c8 from the global
// stylesheet (matches HomeView/RoomsView behaviour).
onMounted(() => {
  document.documentElement.classList.add("splash-figma-root");
  document.body.classList.add("splash-figma-root");
});
onUnmounted(() => {
  document.documentElement.classList.remove("splash-figma-root");
  document.body.classList.remove("splash-figma-root");
});
</script>

<template>
  <div class="splash">
    <img class="splash__logo" src="/figma/splash/logo.webp" alt="MiniPoly" />
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding-top: max(var(--sat, 0px), var(--csat, 0px));
  padding-bottom: max(var(--sab, 0px), var(--csab, 0px));
  /* Paint the bg directly on .splash too — the body class trick alone
     leaks the parent view's color (e.g. RoomView .room → var(--bg)
     parchment) when LoadingScreen mounts INSIDE that view. Playtester
     2026-05-07 «фон везде уродский, должен быть наш лоудинг скрин».
     Mirrors the splash-figma-root rule below verbatim so the visual
     stays the same when used at root level. */
  background-color: #0d68db;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp');
  background-size: auto, cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;
}
.splash__logo {
  /* Figma 52:5051 — logo image is 418px wide on a 393px frame, i.e. ~106vw,
     so it bleeds slightly past the viewport edges by design. Cap at 480px on
     wide viewports so it doesn't grow unbounded. */
  width: min(106vw, 480px);
  height: auto;
  object-fit: contain;
  pointer-events: none;
  /* Mimic the Figma position: sits slightly above center so the vertical
     balance with the pattern below the logo matches the mockup. */
  transform: translateY(-2%);
  animation: splash-pop 360ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
}

@keyframes splash-pop {
  from { opacity: 0; transform: translateY(-2%) scale(0.94); }
  to   { opacity: 1; transform: translateY(-2%) scale(1); }
}
</style>

<style>
html.splash-figma-root,
body.splash-figma-root {
  background-color: #0d68db !important;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
}
body.splash-figma-root #app,
body.splash-figma-root .app-root,
body.splash-figma-root .app-main {
  background: transparent !important;
}
</style>
