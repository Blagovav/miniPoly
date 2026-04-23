<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTelegram } from "./composables/useTelegram";
import { useTheme } from "./composables/useTheme";
import { useGameStore } from "./stores/game";
import Icon from "./components/Icon.vue";
import LoadingScreen from "./components/LoadingScreen.vue";
import TourOverlay from "./components/TourOverlay.vue";

const TOUR_KEY = "tourV1";

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();
const { init, userId, fetchProfile } = useTelegram();
useTheme();
const game = useGameStore();

// Boot sequence: show the splash on cold start until Telegram is initialized
// and the user's profile + friends list are prefetched, so the first
// interactive frame is never a stale/empty UI. Minimum display time keeps
// the splash from flashing sub-perceptibly when the API is hot.
const booting = ref(true);
const MIN_BOOT_MS = 700;

// First-time tour. Fires after boot completes on the very first session;
// dismissing (or finishing) writes to localStorage so it never re-appears
// on its own. Users can re-open via the welcome hero's "?" pill.
const showTour = ref(false);
function openTour() { showTour.value = true; }
function closeTour() {
  showTour.value = false;
  try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
}

async function runBoot() {
  const startedAt = Date.now();

  init();
  const profileJob = userId.value ? fetchProfile(userId.value) : Promise.resolve(null);
  await Promise.allSettled([profileJob, game.loadFriends(userId.value)]);

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_BOOT_MS) {
    await new Promise((r) => setTimeout(r, MIN_BOOT_MS - elapsed));
  }

  booting.value = false;

  // Deep-link room routing after the UI is ready.
  const url = new URL(window.location.href);
  const room = url.searchParams.get("room");
  const startapp = url.searchParams.get("startapp") || url.searchParams.get("tgWebAppStartParam");
  const fromStartapp = startapp?.startsWith("room_") ? startapp.slice(5) : null;
  const target = room ?? fromStartapp;
  if (target) {
    router.replace({ name: "room", params: { id: target } });
    return; // skip tour when deep-linking into a match
  }

  // First-session tour — only runs if we haven't already dismissed it.
  try {
    if (!localStorage.getItem(TOUR_KEY)) {
      showTour.value = true;
    }
  } catch { /* localStorage disabled — skip */ }
}

// Expose globally so HomeView / any screen can re-open the tour via
// window.dispatchEvent(new CustomEvent('open-tour')). Keeps App free of
// child prop-drilling for a tiny feature.
if (typeof window !== "undefined") {
  window.addEventListener("open-tour", openTour);
}

onMounted(() => {
  void runBoot();
});

const activeScreen = computed(() => route.name?.toString() ?? "home");

const navItems = computed(() => [
  { id: "home",    label: locale.value === "ru" ? "Главная"  : "Home",    icon: "home" as const,   route: "home" },
  { id: "rooms",   label: locale.value === "ru" ? "Игры"     : "Games",   icon: "users" as const,  route: "rooms" },
  { id: "shop",    label: locale.value === "ru" ? "Магазин"  : "Shop",    icon: "bag" as const,    route: "shop" },
  { id: "friends", label: locale.value === "ru" ? "Друзья"   : "Friends", icon: "shield" as const, route: "friends" },
  { id: "create",  label: locale.value === "ru" ? "Создать"  : "Create",  icon: "plus" as const,   route: "create" },
]);

function go(routeName: string) {
  router.push({ name: routeName });
}
</script>

<template>
  <LoadingScreen v-if="booting" />
  <div v-else class="app-root">
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
  <TourOverlay :open="showTour" @close="closeTour" />
</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(10px); }
.fade-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
