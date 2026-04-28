import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { i18n } from "./i18n";
import "./style.css";
import { ROUTE_ASSETS, allAssetsCached, preloadAll } from "./utils/assets";
import { useRouteLoader } from "./composables/useRouteLoader";

import HomeView from "./views/HomeView.vue";
import RoomView from "./views/RoomView.vue";
import RoomsView from "./views/RoomsView.vue";
import ShopView from "./views/ShopView.vue";
import CreateView from "./views/CreateView.vue";

import ProfileView from "./views/ProfileView.vue";
import HistoryView from "./views/HistoryView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView, name: "home" },
    { path: "/rooms", component: RoomsView, name: "rooms" },
    { path: "/create", component: CreateView, name: "create" },
    { path: "/shop", component: ShopView, name: "shop" },
    // Profile and Friends share the same view — Friends entry opens the same
    // page with the Friends tab pre-selected, Profile defaults to Cosmetics.
    { path: "/profile", component: ProfileView, name: "profile", props: { defaultTab: "cosmetics" } },
    { path: "/friends", component: ProfileView, name: "friends", props: { defaultTab: "friends" } },
    { path: "/history", component: HistoryView, name: "history" },
    { path: "/room/:id", component: RoomView, name: "room", props: true },
  ],
});

// ── Route-loading splash overlay ────────────────────────────────────────
//
// Before each navigation, decide whether the destination's Figma art is
// already in the in-memory cache (background prefetch from boot may have
// finished, or this isn't the user's first visit to the screen). If yes
// → instant route swap, no UI noise. If no → flip the global
// `isLoading` flag, await the decode + a 200 ms minimum so the overlay
// doesn't strobe on barely-needed transitions, then proceed.
//
// The very first navigation (cold boot, `from.name === undefined`) is
// covered by App.vue's <LoadingScreen v-if="booting" />, so we skip it
// here to avoid double-splash.
const MIN_LOADER_MS = 200;
const { isLoading: routeLoading } = useRouteLoader();

router.beforeEach(async (to, from) => {
  if (!from.name) return;                       // initial boot — handled elsewhere
  if (!to.name || to.name === from.name) return;

  const assets = ROUTE_ASSETS[String(to.name)] ?? [];
  if (assets.length === 0 || allAssetsCached(assets)) return;

  routeLoading.value = true;
  try {
    await Promise.all([
      preloadAll(assets),
      new Promise((r) => setTimeout(r, MIN_LOADER_MS)),
    ]);
  } finally {
    routeLoading.value = false;
  }
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount("#app");
