<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useTelegram } from "./composables/useTelegram";
import { useTheme } from "./composables/useTheme";

const router = useRouter();
const { init } = useTelegram();
useTheme();

onMounted(() => {
  init();

  // Deep-link: ?room=XXX or ?startapp=room_XXX
  const url = new URL(window.location.href);
  const room = url.searchParams.get("room");
  const startapp = url.searchParams.get("startapp") || url.searchParams.get("tgWebAppStartParam");
  const fromStartapp = startapp?.startsWith("room_") ? startapp.slice(5) : null;
  const target = room ?? fromStartapp;
  if (target) router.replace({ name: "room", params: { id: target } });
});
</script>

<template>
  <div class="app-root">
    <div class="bg-orb bg-orb--1" />
    <div class="bg-orb bg-orb--2" />
    <div class="bg-orb bg-orb--3" />
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
.app-root {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  isolation: isolate;
}
.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  z-index: -1;
  pointer-events: none;
}
.bg-orb--1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #a855f7, transparent);
  top: -100px;
  left: -100px;
  animation: float 14s ease-in-out infinite;
}
.bg-orb--2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #22c55e, transparent);
  bottom: -150px;
  right: -150px;
  animation: float 18s ease-in-out infinite reverse;
}
.bg-orb--3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #fbbf24, transparent);
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: float 22s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(40px, -40px); }
}
.bg-orb--3 {
  animation-name: float-center;
}
@keyframes float-center {
  0%, 100% { transform: translate(-50%, -50%); }
  50% { transform: translate(calc(-50% + 30px), calc(-50% - 30px)); }
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(10px); }
.fade-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
