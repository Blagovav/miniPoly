<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { useInventoryStore } from "../stores/inventory";
import {
  SHOP_CAPS, SHOP_MAPS, SHOP_CHESTS,
  RARITY_LABEL_RU, RARITY_LABEL_EN, RARITY_BADGE_BG,
  type CapEntry, type MapEntry, type ChestEntry,
} from "../shop/cosmetics";
import CosmeticsCaps from "../components/CosmeticsCaps.vue";
import CosmeticsMaps from "../components/CosmeticsMaps.vue";
import ChestModal from "../components/ChestModal.vue";
import Sigil from "../components/Sigil.vue";
import Icon from "../components/Icon.vue";
import { ORDERED_PLAYER_COLORS, lighten } from "../utils/palette";
import type { Rarity } from "../components/RarityGlow.vue";

type Tab = "cosmetics" | "friends";
const props = defineProps<{ defaultTab?: Tab }>();

const router = useRouter();
const { locale } = useI18n();
const { userId, userName, haptic, notify, tg } = useTelegram();
const inv = useInventoryStore();

const isRu = computed(() => locale.value === "ru");
const tab = ref<Tab>(props.defaultTab ?? "cosmetics");
const ownedOnlyCaps = ref(false);
const ownedOnlyMaps = ref(false);

interface Profile {
  gamesPlayed: number;
  gamesWon: number;
  totalEarned: number;
  winRate: number;
}
interface Friend {
  tgUserId: number;
  name: string;
  gamesPlayed: number;
  gamesWon: number;
}

const profile = ref<Profile | null>(null);
const friends = ref<Friend[]>([]);
const invitingId = ref<number | null>(null);
const activeRoomId = ref<string | null>(null);
const toast = ref<{ text: string; kind: "ok" | "err" } | null>(null);
const copied = ref(false);

const botUsername = (import.meta.env.VITE_BOT_USERNAME as string) || "poly_mini_bot";
const referralUrl = computed(() =>
  userId.value
    ? `https://t.me/${botUsername}?start=ref_${userId.value}`
    : `https://t.me/${botUsername}`,
);

// User color — deterministic per tgUserId so the avatar stays stable across sessions.
const myColor = computed(() => {
  const id = userId.value;
  if (!id) return ORDERED_PLAYER_COLORS[0];
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ORDERED_PLAYER_COLORS[Math.abs(h) % ORDERED_PLAYER_COLORS.length];
});

const avatarBg = computed(() => {
  const c = myColor.value;
  const start = c.startsWith("#") ? lighten(c, 0.25) : c;
  return `radial-gradient(circle at 32% 28%, ${start}, ${c} 70%)`;
});

const L = computed(() => isRu.value
  ? {
      back: "Назад",
      games: "ПАРТИЙ СЫГРАНО",
      wins: "ПОБЕД",
      tabCosmetics: "Косметика",
      tabFriends: "Друзья",
      sectionCaps: "Фишки",
      sectionMaps: "Карты",
      ownedOnly: "Только купленные",
      equipped: "Надето",
      equip: "Надеть",
      inChest: "В сундуке →",
      buy: "Купить",
      free: "Бесплатно",
      heroTitle: "Приглашайте друзей\nи получайте награды",
      copyHint: "Скопировать",
      copied: "Ссылка скопирована",
      inviteFriends: "ПРИГЛАСИТЬ ДРУЗЕЙ",
      invitedFriends: "Приглашенные друзья",
      inviteToParty: "Пригласить\nв партию",
      noFriendsTitle: "Пока никого нет",
      noFriendsSub: "Поделитесь ссылкой ниже и сыграйте партию",
      toastNeedRoom: "Сначала войди в игру",
      toastInvited: (name: string) => `Позвал ${name}`,
      toastNoChat: "Друг ещё не запускал бота",
      toastFail: (reason: string) => `Не вышло: ${reason}`,
      toastDown: "Сервер недоступен",
    }
  : {
      back: "Back",
      games: "GAMES PLAYED",
      wins: "WINS",
      tabCosmetics: "Cosmetics",
      tabFriends: "Friends",
      sectionCaps: "Tokens",
      sectionMaps: "Maps",
      ownedOnly: "Owned only",
      equipped: "Equipped",
      equip: "Equip",
      inChest: "In chest →",
      buy: "Buy",
      free: "Free",
      heroTitle: "Invite friends\nand earn rewards",
      copyHint: "Copy",
      copied: "Link copied",
      inviteFriends: "INVITE FRIENDS",
      invitedFriends: "Invited friends",
      inviteToParty: "Invite\nto game",
      noFriendsTitle: "No friends yet",
      noFriendsSub: "Share the link below and play a match",
      toastNeedRoom: "Join a game first",
      toastInvited: (name: string) => `Invited ${name}`,
      toastNoChat: "Friend hasn't opened the bot yet",
      toastFail: (reason: string) => `Failed: ${reason}`,
      toastDown: "Server unavailable",
    });

// ─── Data load ────────────────────────────────────────────────────────────
async function load() {
  if (!userId.value) return;
  const base = (import.meta.env.VITE_API_URL as string) || "";
  const [me, fr] = await Promise.all([
    fetch(`${base}/api/users/${userId.value}`).then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch(`${base}/api/users/${userId.value}/coplayers`).then((r) => r.ok ? r.json() : null).catch(() => null),
  ]);
  profile.value = me?.profile ?? null;
  friends.value = (fr?.players ?? []).map((p: any) => ({
    tgUserId: p.tgUserId,
    name: p.name,
    gamesPlayed: p.gamesPlayed ?? 0,
    gamesWon: p.gamesWon ?? 0,
  }));
}

function refreshActiveRoom() {
  try { activeRoomId.value = localStorage.getItem("activeRoomId"); }
  catch { activeRoomId.value = null; }
}

// ─── Cosmetics helpers ────────────────────────────────────────────────────
function isOwned(id: string) { return inv.owned.has(id); }
function isCapEquipped(id: string) { return inv.equippedToken === id; }
function isMapEquipped(id: string) { return inv.equippedTheme === id; }
function rarityLabel(r: Rarity) { return (isRu.value ? RARITY_LABEL_RU : RARITY_LABEL_EN)[r]; }
function rarityBadge(r: Rarity) { return RARITY_BADGE_BG[r]; }
function pickName(n: { en: string; ru: string }) { return isRu.value ? n.ru : n.en; }

const visibleCaps = computed<CapEntry[]>(() =>
  ownedOnlyCaps.value ? SHOP_CAPS.filter((c) => isOwned(c.id)) : [...SHOP_CAPS],
);
const visibleMaps = computed<MapEntry[]>(() =>
  ownedOnlyMaps.value ? SHOP_MAPS.filter((m) => isOwned(m.id)) : [...SHOP_MAPS],
);

async function buyWithStars(itemId: string, title: string, stars: number) {
  if (!userId.value) { notify("error"); return; }
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const res = await fetch(`${base}/api/stars/invoice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tgUserId: userId.value, itemId, title, stars }),
    });
    const data = await res.json();
    if (!data.link) { notify("error"); return; }
    const tgApp: any = tg.value;
    if (tgApp?.openInvoice) {
      tgApp.openInvoice(data.link, async (status: string) => {
        if (status === "paid") {
          notify("success");
          haptic("heavy");
          await inv.syncServerUnlocks(userId.value);
        } else if (status !== "pending") {
          notify("error");
        }
      });
    } else {
      window.open(data.link, "_blank");
    }
  } catch {
    notify("error");
  }
}

// Chest modal — opened when user taps "В сундуке →" on a chestOnly cap.
const chestModalChest = ref<ChestEntry | null>(null);
const chestModalOpen = computed(() => chestModalChest.value !== null);
function closeChestModal() { chestModalChest.value = null; }

function onCapAction(cap: CapEntry) {
  if (isOwned(cap.id)) {
    if (isCapEquipped(cap.id)) return;
    inv.equip(cap.id, "token");
    haptic("light"); notify("success");
    return;
  }
  if (cap.chestOnly) {
    haptic("light");
    const chest = SHOP_CHESTS.find((c) => c.items?.some((it) => it.capId === cap.id));
    if (chest) { chestModalChest.value = chest; return; }
    router.push({ name: "shop" });
    return;
  }
  if (cap.starsPrice != null) {
    void buyWithStars(cap.id, pickName(cap.name), cap.starsPrice);
    return;
  }
  // Free cap → grant directly.
  const ok = inv.buy(cap.id, 0);
  if (ok) { haptic("light"); notify("success"); }
}

function onMapAction(m: MapEntry) {
  if (isOwned(m.id)) {
    if (isMapEquipped(m.id)) return;
    inv.equip(m.id, "theme");
    haptic("light"); notify("success");
    return;
  }
  if (m.starsPrice != null) {
    void buyWithStars(m.id, pickName(m.name), m.starsPrice);
    return;
  }
  const ok = inv.buy(m.id, 0);
  if (ok) { haptic("light"); notify("success"); }
}

function capBtnLabel(cap: CapEntry) {
  if (isOwned(cap.id)) return isCapEquipped(cap.id) ? L.value.equipped : L.value.equip;
  if (cap.chestOnly) return L.value.inChest;
  if (cap.starsPrice != null) return String(cap.starsPrice);
  return L.value.free;
}
function capBtnClass(cap: CapEntry) {
  if (isOwned(cap.id) && isCapEquipped(cap.id)) return "profile__btn--equipped";
  if (isOwned(cap.id)) return "profile__btn--equip";
  if (cap.chestOnly) return "profile__btn--grad";
  if (cap.starsPrice != null) return "profile__btn--stars";
  return "profile__btn--equip";
}
function mapBtnLabel(m: MapEntry) {
  if (isOwned(m.id)) return isMapEquipped(m.id) ? L.value.equipped : L.value.equip;
  if (m.starsPrice != null) return String(m.starsPrice);
  return L.value.free;
}
function mapBtnClass(m: MapEntry) {
  if (isOwned(m.id) && isMapEquipped(m.id)) return "profile__btn--equipped";
  if (isOwned(m.id)) return "profile__btn--equip";
  if (m.starsPrice != null) return "profile__btn--stars";
  return "profile__btn--equip";
}

// ─── Friends / referral ───────────────────────────────────────────────────
const inviteCount = computed(() => friends.value.length);
const milestones = [3, 5, 10] as const;
const milestoneRewards: { type: "cap" | "map"; capIdx?: number; mapIdx?: number; rarity: Rarity }[] = [
  { type: "cap", capIdx: 7, rarity: "rare" },     // robot
  { type: "cap", capIdx: 5, rarity: "rare" },     // dog
  { type: "map", mapIdx: 1, rarity: "rare" },     // space station
];
const progressPct = computed(() => {
  const max = milestones[milestones.length - 1];
  return Math.min(100, Math.round((inviteCount.value / max) * 100));
});

function showToast(text: string, kind: "ok" | "err" = "ok") {
  toast.value = { text, kind };
  setTimeout(() => (toast.value = null), 2200);
}

async function copyReferral() {
  haptic("light");
  try {
    await navigator.clipboard.writeText(referralUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
    showToast(L.value.copied);
  } catch {
    showToast(L.value.toastDown, "err");
  }
}

async function shareInvite() {
  haptic("medium");
  const url = referralUrl.value;
  const text = isRu.value
    ? "Го в Minipoly, давай сыграем"
    : "Join me in Minipoly, let's play";
  const tgApp: any = tg.value;
  if (tgApp?.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    tgApp.openTelegramLink(shareUrl);
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: "Minipoly", text, url }); return; } catch {}
  }
  await copyReferral();
}

async function inviteToGame(p: Friend) {
  if (!activeRoomId.value) {
    showToast(L.value.toastNeedRoom, "err");
    return;
  }
  invitingId.value = p.tgUserId;
  haptic("light");
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const res = await fetch(`${base}/api/invites/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tgUserId: p.tgUserId,
        roomId: activeRoomId.value,
        fromName: userName.value || "Игрок",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      notify("success");
      showToast(L.value.toastInvited(p.name));
    } else {
      notify("warning");
      const reason = data?.reason === "no chat access"
        ? L.value.toastNoChat
        : data?.error || data?.reason || (isRu.value ? "не доставлено" : "not delivered");
      showToast(L.value.toastFail(reason), "err");
    }
  } catch {
    notify("error");
    showToast(L.value.toastDown, "err");
  } finally {
    invitingId.value = null;
  }
}

function colorForFriend(id: number) {
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return ORDERED_PLAYER_COLORS[Math.abs(hash) % ORDERED_PLAYER_COLORS.length];
}

// ─── Scroll-aware header shadow (matches RoomView/CreateView pattern) ────
const scrollEl = ref<HTMLDivElement | null>(null);
const sticky = ref(false);
function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  sticky.value = el.scrollTop > 4;
}

function goBack() { haptic("light"); router.back(); }
function setTab(t: Tab) {
  if (tab.value === t) return;
  haptic("light");
  tab.value = t;
  // Reset scroll when switching tabs so users don't land halfway down.
  if (scrollEl.value) scrollEl.value.scrollTop = 0;
  sticky.value = false;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
  document.documentElement.classList.add("shop-figma-root");
  document.body.classList.add("shop-figma-root");
  refreshActiveRoom();
  void load();
  void inv.syncServerUnlocks(userId.value);
});
onUnmounted(() => {
  document.documentElement.classList.remove("shop-figma-root");
  document.body.classList.remove("shop-figma-root");
});

// Keep the tab in sync if the route prop ever changes (route swap).
watch(() => props.defaultTab, (t) => { if (t) tab.value = t; });

function userInitial() {
  const n = (userName.value || "?").trim();
  return n.charAt(0).toUpperCase() || "?";
}
</script>

<template>
  <div class="profile">
    <!-- Compact sticky header — pinned at top regardless of scroll, gains
         a card-shadow + opaque bg once the user has scrolled past the hero. -->
    <div class="profile__topbar" :class="{ 'profile__topbar--stuck': sticky }">
      <button class="profile__icon-btn" :aria-label="L.back" @click="goBack">
        <Icon name="back" :size="22" color="#000" />
      </button>
      <button class="profile__settings" aria-label="settings" @click="haptic('light')">
        <img src="/figma/home/settings.webp" alt="" />
      </button>
    </div>

    <!-- Tab toggle — sits in the hero in the un-stuck state, slides up to
         dock under the topbar once sticky is on. -->
    <div class="profile__scroller" ref="scrollEl" @scroll.passive="onScroll">
      <!-- Hero: avatar, name, stats. Hidden behind sticky header on scroll. -->
      <div class="profile__hero">
        <div class="profile__avatar" :style="{ background: avatarBg }">
          <span class="profile__avatar-letter">{{ userInitial() }}</span>
        </div>
        <h1 class="profile__name">{{ userName || (isRu ? "Игрок" : "Player") }}</h1>

        <div class="profile__stats">
          <div class="profile__stat">
            <div class="profile__stat-val">{{ profile?.gamesPlayed ?? 0 }}</div>
            <div class="profile__stat-label">{{ L.games }}</div>
          </div>
          <div class="profile__stat">
            <div class="profile__stat-val">{{ profile?.gamesWon ?? 0 }}</div>
            <div class="profile__stat-label">{{ L.wins }}</div>
          </div>
        </div>
      </div>

      <!-- Tab toggle. Sticky so it docks under the topbar while scrolling. -->
      <div class="profile__tabs-wrap" :class="{ 'profile__tabs-wrap--stuck': sticky }">
        <div class="profile__tabs">
          <button
            class="profile__tab"
            :class="{ 'profile__tab--active': tab === 'cosmetics' }"
            @click="setTab('cosmetics')"
          >
            {{ L.tabCosmetics }}
          </button>
          <button
            class="profile__tab"
            :class="{ 'profile__tab--active': tab === 'friends' }"
            @click="setTab('friends')"
          >
            {{ L.tabFriends }}
          </button>
        </div>
      </div>

      <!-- ╔═══ Cosmetics tab ═══╗ -->
      <template v-if="tab === 'cosmetics'">
        <div class="profile__section-head">
          <h2 class="profile__section-title">{{ L.sectionCaps }}</h2>
          <button
            class="profile__filter"
            :class="{ 'profile__filter--on': ownedOnlyCaps }"
            @click="ownedOnlyCaps = !ownedOnlyCaps; haptic('light')"
          >
            <span>{{ L.ownedOnly }}</span>
            <span class="profile__filter-mark">
              <Icon v-if="ownedOnlyCaps" name="check" :size="12" color="#000" />
            </span>
          </button>
        </div>

        <div class="profile__grid">
          <article
            v-for="cap in visibleCaps"
            :key="cap.id"
            class="profile__card"
          >
            <div class="profile__preview">
              <CosmeticsCaps :type="cap.type" :rarity="cap.rarity" :size="72" />
            </div>
            <div class="profile__meta">
              <span class="profile__rarity" :style="{ background: rarityBadge(cap.rarity) }">
                {{ rarityLabel(cap.rarity) }}
              </span>
              <h3 class="profile__name-card">{{ pickName(cap.name) }}</h3>
            </div>
            <button
              class="profile__btn"
              :class="capBtnClass(cap)"
              @click="onCapAction(cap)"
            >
              <Icon
                v-if="!isOwned(cap.id) && !cap.chestOnly && cap.starsPrice != null"
                name="star"
                :size="12"
                color="#fff"
              />
              <span>{{ capBtnLabel(cap) }}</span>
            </button>
          </article>
        </div>

        <div class="profile__section-head profile__section-head--mt">
          <h2 class="profile__section-title">{{ L.sectionMaps }}</h2>
          <button
            class="profile__filter"
            :class="{ 'profile__filter--on': ownedOnlyMaps }"
            @click="ownedOnlyMaps = !ownedOnlyMaps; haptic('light')"
          >
            <span>{{ L.ownedOnly }}</span>
            <span class="profile__filter-mark">
              <Icon v-if="ownedOnlyMaps" name="check" :size="12" color="#000" />
            </span>
          </button>
        </div>

        <div class="profile__grid">
          <article
            v-for="m in visibleMaps"
            :key="m.id"
            class="profile__card profile__card--map"
          >
            <div class="profile__preview profile__preview--map">
              <CosmeticsMaps :type="m.type" :rarity="m.rarity" :size="100" />
            </div>
            <div class="profile__meta">
              <span class="profile__rarity" :style="{ background: rarityBadge(m.rarity) }">
                {{ rarityLabel(m.rarity) }}
              </span>
              <h3 class="profile__name-card profile__name-card--two">{{ pickName(m.name) }}</h3>
            </div>
            <button
              class="profile__btn"
              :class="mapBtnClass(m)"
              @click="onMapAction(m)"
            >
              <Icon
                v-if="!isOwned(m.id) && m.starsPrice != null"
                name="star"
                :size="12"
                color="#fff"
              />
              <span>{{ mapBtnLabel(m) }}</span>
            </button>
          </article>
        </div>
      </template>

      <!-- ╔═══ Friends tab ═══╗ -->
      <template v-else>
        <div class="profile__friends-hero">
          <img class="profile__couple" src="/figma/profile/couple.webp" alt="" />
          <p class="profile__hero-title">{{ L.heroTitle }}</p>
        </div>

        <!-- Milestones progress bar -->
        <div class="profile__milestones">
          <div class="profile__bar">
            <div class="profile__bar-fill" :style="{ width: `${progressPct}%` }" />
          </div>

          <div class="profile__milestone-row">
            <div
              v-for="(n, idx) in milestones"
              :key="n"
              class="profile__milestone"
              :class="{ 'profile__milestone--reached': inviteCount >= n }"
            >
              <div class="profile__milestone-num">
                <span>{{ n }}</span>
                <Icon
                  v-if="inviteCount >= n"
                  class="profile__milestone-check"
                  name="check"
                  :size="10"
                  color="#fff"
                />
              </div>
              <div class="profile__reward">
                <CosmeticsCaps
                  v-if="milestoneRewards[idx].type === 'cap' && milestoneRewards[idx].capIdx != null"
                  :type="SHOP_CAPS[milestoneRewards[idx].capIdx!].type"
                  :rarity="milestoneRewards[idx].rarity"
                  :size="56"
                />
                <CosmeticsMaps
                  v-else-if="milestoneRewards[idx].mapIdx != null"
                  :type="SHOP_MAPS[milestoneRewards[idx].mapIdx!].type"
                  :rarity="milestoneRewards[idx].rarity"
                  :size="56"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Referral input + copy button -->
        <div class="profile__copy">
          <div class="profile__copy-text">{{ referralUrl }}</div>
          <button class="profile__copy-btn" @click="copyReferral" :aria-label="L.copyHint">
            <Icon v-if="copied" name="check" :size="14" color="#fff" />
            <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2.5" stroke="#fff" stroke-width="1.7"/>
              <path d="M4 16V6.5A2.5 2.5 0 0 1 6.5 4H16" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Big invite CTA -->
        <button class="profile__invite" @click="shareInvite">
          <span>{{ L.inviteFriends }}</span>
        </button>

        <!-- Invited friends list -->
        <h2 class="profile__section-title profile__section-title--friends">
          {{ L.invitedFriends }}
        </h2>

        <div v-if="friends.length === 0" class="profile__empty">
          <div class="profile__empty-title">{{ L.noFriendsTitle }}</div>
          <p class="profile__empty-sub">{{ L.noFriendsSub }}</p>
        </div>

        <div v-else class="profile__friends">
          <div
            v-for="p in friends"
            :key="p.tgUserId"
            class="profile__friend"
          >
            <Sigil
              class="profile__friend-avatar"
              :name="p.name"
              :color="colorForFriend(p.tgUserId)"
              :size="40"
            />
            <div class="profile__friend-name">{{ p.name }}</div>
            <button
              class="profile__btn profile__btn--equip profile__friend-btn"
              :disabled="!activeRoomId || invitingId === p.tgUserId"
              @click="inviteToGame(p)"
            >
              <span class="profile__friend-btn-text">{{ L.inviteToParty }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>

    <transition name="toast">
      <div v-if="toast" class="profile__toast" :class="`profile__toast--${toast.kind}`">
        <Icon :name="toast.kind === 'ok' ? 'check' : 'x'" :size="14" color="#fff" />
        <span>{{ toast.text }}</span>
      </div>
    </transition>

    <ChestModal
      :open="chestModalOpen"
      :chest="chestModalChest"
      @close="closeChestModal"
    />
  </div>
</template>

<style scoped>
.profile {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: transparent;
  color: #fff;
  font-family: 'Golos Text', var(--font-body);
  overflow: hidden;
}

/* ─── Topbar — sits transparently in flow with the body's blue/pattern
       showing through. When scrolled the rounded bottom + shadow live on
       the tabs-wrap below (see .profile__tabs-wrap--stuck) so the topbar
       and tabs read as a single continuous card, not two stacked pieces. */
.profile__topbar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 24px 8px;
  flex-shrink: 0;
}
.profile__icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);
  transition: transform 120ms ease;
}
.profile__icon-btn:active { transform: scale(0.93); }
.profile__settings {
  width: 48px;
  height: 48px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 120ms ease;
  flex-shrink: 0;
}
.profile__settings img {
  width: 66px;
  height: 66px;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.profile__settings:active { transform: scale(0.92); }

/* ─── Scroll container ─── */
.profile__scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 24px 32px;
  position: relative;
  z-index: 3;
}
.profile__scroller::-webkit-scrollbar { width: 4px; }
.profile__scroller::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

/* ─── Hero (avatar + name + stats) ─── */
.profile__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}
.profile__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.25),
    inset 0 -1px 1px rgba(0, 0, 0, 0.2);
  margin-bottom: 12px;
}
.profile__avatar-letter {
  font-family: 'SF Pro Rounded', 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 28px;
  line-height: 36px;
  color: #fff;
  text-shadow: 0 6px 12px rgba(0, 0, 0, 0.16);
  letter-spacing: 0;
}
.profile__name {
  margin: 0 0 16px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 0.8px 0.8px 0 #000;
  text-align: center;
}
.profile__stats {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-bottom: 20px;
}
.profile__stat {
  flex: 1;
  background: #fff;
  border-radius: 18px;
  padding: 12px 8px;
  text-align: center;
  color: #000;
}
.profile__stat-val {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 20px;
  line-height: 22px;
  margin-bottom: 4px;
}
.profile__stat-label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  letter-spacing: 0.02em;
}

/* ─── Tab toggle — `position: sticky` so it docks at scroll-container top
       once the hero (avatar/name/stats) scrolls past it. When stuck the
       wrap takes the rounded-bottom + shadow that would otherwise sit on
       the topbar — together they read as one continuous header card. */
.profile__tabs-wrap {
  position: sticky;
  top: 0;
  z-index: 6;
  margin: 0 -24px;
  padding: 8px 24px;
  background: transparent;
  transition: box-shadow 200ms ease, border-radius 200ms ease;
}
.profile__tabs-wrap--stuck {
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
}
.profile__tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 999px;
}
.profile__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  transition: background 140ms;
}
.profile__tab--active {
  background: #2283f3;
  color: #fff;
  font-weight: 900;
  text-shadow: 0.4px 0.4px 0 #000;
}

/* ─── Section heading ─── */
.profile__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 12px;
}
.profile__section-head--mt { margin-top: 28px; }
.profile__section-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 0.4px 0.4px 0 #000;
}
.profile__section-title--friends {
  margin: 24px 0 12px;
}

.profile__filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 3px 8px;
  background: #fff;
  border: none;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  color: #000;
  cursor: pointer;
  flex-shrink: 0;
}
.profile__filter-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 0.93px solid rgba(0, 0, 0, 0.4);
  background: transparent;
}
.profile__filter--on .profile__filter-mark {
  background: #56e63e;
  border-color: #56e63e;
}

/* ─── Cards grid ─── */
.profile__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.profile__card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #000;
  min-height: 180px;
}
.profile__preview {
  height: 76px;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile__preview--map { height: 100px; }

.profile__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.profile__rarity {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 3px 8px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  color: #fff;
  white-space: nowrap;
}
.profile__name-card {
  margin: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile__name-card--two {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.profile__btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
  white-space: nowrap;
  margin-top: auto;
}
.profile__btn:active { filter: brightness(0.95); transform: translateY(1px); }
.profile__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.profile__btn--equip {
  background: #56e63e;
  color: #000;
}
.profile__btn--equipped {
  background: rgba(0, 0, 0, 0.2);
  color: rgba(0, 0, 0, 0.6);
  cursor: default;
}
.profile__btn--stars {
  background: linear-gradient(to left, #e069d0 0%, #718fff 100%);
  color: #fff;
}
.profile__btn--grad {
  background: linear-gradient(101deg, #005eff 0%, #6f4bff 100%);
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.32);
}

/* ─── Friends tab ─── */
.profile__friends-hero {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.profile__couple {
  width: 234px;
  height: 174px;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 60%, transparent 100%);
          mask-image: radial-gradient(ellipse at center, #000 60%, transparent 100%);
}
.profile__hero-title {
  margin: 4px 0 0;
  white-space: pre-line;
  text-align: center;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 30px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}

/* Milestones */
.profile__milestones {
  margin-top: 24px;
  position: relative;
  padding-bottom: 4px;
}
.profile__bar {
  position: relative;
  height: 6px;
  background: #fff;
  border: 2px solid #fff;
  border-radius: 999px;
  overflow: hidden;
}
.profile__bar-fill {
  position: absolute;
  inset: 0;
  background: #43c22d;
  border-radius: 999px;
  transition: width 240ms ease;
}
.profile__milestone-row {
  display: flex;
  justify-content: space-between;
  margin-top: -16px;
  padding: 0 8px;
}
.profile__milestone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.profile__milestone-num {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #fff;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
}
.profile__milestone--reached .profile__milestone-num {
  background: #43c22d;
  color: #fff;
}
.profile__milestone-check {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: #43c22d;
  border-radius: 50%;
  padding: 1px;
}
.profile__reward {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Referral copy input */
.profile__copy {
  position: relative;
  margin-top: 24px;
  height: 48px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 999px;
  display: flex;
  align-items: center;
  padding: 0 48px 0 16px;
}
.profile__copy-text {
  flex: 1;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile__copy-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #2283f3;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease, background 140ms;
}
.profile__copy-btn:active { transform: translateY(-50%) scale(0.92); }

/* Big green invite CTA */
.profile__invite {
  position: relative;
  width: 100%;
  margin-top: 16px;
  height: 56px;
  border-radius: 18px;
  border: 2px solid #000;
  background: #43c22d;
  color: #fff;
  font-family: 'Golos Text', sans-serif;
  font-weight: 900;
  font-size: 24px;
  line-height: 26px;
  text-shadow: 1.4px 1.4px 0 rgba(0, 0, 0, 0.6);
  cursor: pointer;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.2);
  transition: transform 120ms ease, filter 120ms ease;
}
.profile__invite:active {
  transform: translateY(2px);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}

/* Friends list */
.profile__friends {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.profile__friend {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 8px;
}
.profile__friend-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.profile__friend-name {
  flex: 1;
  min-width: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile__friend-btn {
  height: auto;
  padding: 4px 10px;
}
.profile__friend-btn-text {
  white-space: pre-line;
  text-align: center;
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
}

.profile__empty {
  text-align: center;
  padding: 24px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 18px;
}
.profile__empty-title {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #fff;
  text-shadow: 0.4px 0.4px 0 #000;
  margin-bottom: 4px;
}
.profile__empty-sub {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

/* Toast */
.profile__toast {
  position: fixed;
  left: 50%;
  bottom: calc(80px + var(--tg-safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Golos Text', sans-serif;
  color: #fff;
  z-index: 100;
  max-width: calc(100% - 36px);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.profile__toast--ok { background: linear-gradient(180deg, #5fd650, #43c22d); }
.profile__toast--err { background: linear-gradient(180deg, #f06b6b, #db3535); }
.toast-enter-active, .toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>

<style>
/* Mirror ShopView's body-level treatment so the safe-area strips stay blue
   instead of falling back to the default parchment cream background. The
   `.shop-figma-root` class is applied/removed in onMounted/onUnmounted. */
html.shop-figma-root,
body.shop-figma-root {
  background-color: #0d68db !important;
  background-image:
    linear-gradient(rgba(13, 104, 219, 0.55), rgba(13, 104, 219, 0.55)),
    url('/figma/home/bg-pattern.webp') !important;
  background-size: auto, cover !important;
  background-position: center, center !important;
  background-repeat: no-repeat, no-repeat !important;
  background-attachment: fixed, fixed !important;
}
body.shop-figma-root #app,
body.shop-figma-root .app-root,
body.shop-figma-root .app-main,
body.shop-figma-root .profile {
  background: transparent !important;
}
</style>
