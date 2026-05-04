<script setup lang="ts">
/**
 * Full-screen splash overlay shown during slow route transitions —
 * specifically, navigations where the destination's image bundle isn't
 * already decoded into the browser cache.
 *
 * Visual is the same blue + Figma bg-pattern + centered logo as the
 * cold-start splash, just smaller and with a softer pulse so the user
 * reads it as "loading the next screen" rather than "app restarting".
 *
 * State is a single bool exposed via `useRouteLoader()`. The toggle
 * lives in main.ts's router.beforeEach guard, which awaits the bundle
 * preload + a 200 ms minimum (so the loader doesn't strobe on
 * already-cached navigations that took 30 ms).
 */
import { useRouteLoader } from "../composables/useRouteLoader";

const { isLoading } = useRouteLoader();
</script>

<template>
  <transition name="route-loader-fade">
    <div v-if="isLoading" class="route-loader" aria-hidden="true">
      <img class="route-loader__logo" src="/figma/splash/logo.webp" alt="" />
    </div>
  </transition>
</template>

<style scoped>
.route-loader {
  position: fixed;
  inset: 0;
  z-index: 90; /* above plain views; below Chat (120) and modals (130). */
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0d68db;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp');
  background-size: auto, cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;
  background-attachment: fixed, fixed;
  padding-top: max(var(--sat, 0px), var(--csat, 0px));
  padding-bottom: max(var(--sab, 0px), var(--csab, 0px));
}
.route-loader__logo {
  width: min(60vw, 240px);
  height: auto;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  transform: translateY(-2%);
  animation: route-loader-pulse 1.4s ease-in-out infinite;
}

@keyframes route-loader-pulse {
  0%, 100% { opacity: 0.85; transform: translateY(-2%) scale(1); }
  50%      { opacity: 1;    transform: translateY(-2%) scale(1.04); }
}

/* Fade in fast (90 ms) so the overlay catches the eye before the old
   view starts unmounting. Fade out is slightly slower (180 ms) so the
   reveal of the new view feels like a curtain lift, not a snap. */
.route-loader-fade-enter-active { transition: opacity 90ms ease-out; }
.route-loader-fade-leave-active { transition: opacity 180ms ease-in; }
.route-loader-fade-enter-from,
.route-loader-fade-leave-to { opacity: 0; }
</style>
