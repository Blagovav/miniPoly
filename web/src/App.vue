<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTelegram } from "./composables/useTelegram";
import { useTheme } from "./composables/useTheme";
import Icon from "./components/Icon.vue";

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();
const { init } = useTelegram();
useTheme();

onMounted(() => {
  init();

  const url = new URL(window.location.href);
  const room = url.searchParams.get("room");
  const startapp = url.searchParams.get("startapp") || url.searchParams.get("tgWebAppStartParam");
  const fromStartapp = startapp?.startsWith("room_") ? startapp.slice(5) : null;
  const target = room ?? fromStartapp;
  if (target) router.replace({ name: "room", params: { id: target } });
});

const activeScreen = computed(() => route.name?.toString() ?? "home");

const navItems = computed(() => [
  { id: "home",    label: locale.value === "ru" ? "Тронный зал" : "Home",    icon: "home" as const,   route: "home" },
  { id: "rooms",   label: locale.value === "ru" ? "Таверна"     : "Tavern",  icon: "users" as const,  route: "rooms" },
  { id: "shop",    label: locale.value === "ru" ? "Ярмарка"     : "Bazaar",  icon: "bag" as const,    route: "shop" },
  { id: "friends", label: locale.value === "ru" ? "Союзники"    : "Friends", icon: "shield" as const, route: "friends" },
  { id: "create",  label: locale.value === "ru" ? "Создать"     : "Create",  icon: "plus" as const,   route: "create" },
]);

function go(routeName: string) {
  router.push({ name: routeName });
}
</script>

<template>
  <div class="app-root">
    <!-- Desktop sidebar: shown only on wide screens (>= 900px via CSS) -->
    <aside class="desktop-sidebar">
      <div class="desktop-sidebar__brand">MINI · POLY</div>
      <button
        v-for="item in navItems"
        :key="item.id"
        class="desktop-sidebar__item"
        :class="{ active: activeScreen === item.route }"
        @click="go(item.route)"
      >
        <Icon :name="item.icon" :size="15" :color="activeScreen === item.route ? '#d4a84a' : '#8a7152'" />
        <span>{{ item.label }}</span>
      </button>
      <div class="desktop-sidebar__spacer" />
      <div class="desktop-sidebar__footer">Anno MMXXVI</div>
    </aside>

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(10px); }
.fade-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
