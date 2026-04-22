import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { i18n } from "./i18n";
import "./style.css";

import HomeView from "./views/HomeView.vue";
import RoomView from "./views/RoomView.vue";
import RoomsView from "./views/RoomsView.vue";
import ShopView from "./views/ShopView.vue";
import CreateView from "./views/CreateView.vue";

import FriendsView from "./views/FriendsView.vue";
import HistoryView from "./views/HistoryView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView, name: "home" },
    { path: "/rooms", component: RoomsView, name: "rooms" },
    { path: "/create", component: CreateView, name: "create" },
    { path: "/shop", component: ShopView, name: "shop" },
    { path: "/friends", component: FriendsView, name: "friends" },
    { path: "/history", component: HistoryView, name: "history" },
    { path: "/room/:id", component: RoomView, name: "room", props: true },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount("#app");
