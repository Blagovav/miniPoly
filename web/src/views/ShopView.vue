<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";
import {
  SHOP_CAPS, SHOP_MAPS, SHOP_CHESTS,
  RARITY_LABEL_RU, RARITY_LABEL_EN, RARITY_BADGE_BG,
  type CapEntry, type MapEntry, type ChestEntry,
} from "../shop/cosmetics";
import CosmeticsCaps from "../components/CosmeticsCaps.vue";
import CosmeticsMaps from "../components/CosmeticsMaps.vue";
import ChestModal from "../components/ChestModal.vue";
import Icon from "../components/Icon.vue";
import PurchaseSuccessModal, { type PurchaseData } from "../components/PurchaseSuccessModal.vue";
import PurchaseFailModal, { type PurchaseFailData } from "../components/PurchaseFailModal.vue";
import type { Rarity } from "../components/RarityGlow.vue";

type FilterId = "all" | "chests" | "caps" | "maps" | "dice";

const { locale } = useI18n();
const router = useRouter();
const inv = useInventoryStore();
const { haptic, notify, tg, userId } = useTelegram();

const isRu = computed(() => locale.value === "ru");

// Scroll-aware topbar shadow — same pattern as RoomView/CreateView/ProfileView.
const scrollEl = ref<HTMLDivElement | null>(null);
const scrolled = ref(false);
function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  scrolled.value = el.scrollTop > 4;
}

onMounted(() => {
  inv.syncServerUnlocks(userId.value);
  // Same body-level treatment as HomeView so safe-area strips stay blue.
  document.documentElement.classList.add("shop-figma-root");
  document.body.classList.add("shop-figma-root");
});
onUnmounted(() => {
  document.documentElement.classList.remove("shop-figma-root");
  document.body.classList.remove("shop-figma-root");
});

const L = computed(() => isRu.value
  ? {
      title: "Магазин",
      filterAll: "Все товары",
      filterChests: "Сундуки Удачи",
      filterCaps: "Фишки",
      filterMaps: "Карты",
      filterDice: "Кости",
      sectionChests: "Сундуки Удачи",
      sectionCaps: "Фишки",
      sectionMaps: "Карты",
      sectionDice: "Кости",
      seeAll: "Смотреть все →",
      hideOwned: "Скрыть купленные",
      equipped: "Надето",
      equip: "Надеть",
      inChest: "В сундуке →",
      lookInside: "Посмотреть что внутри",
      comingSoon: "Скоро",
      free: "Бесплатно",
    }
  : {
      title: "Shop",
      filterAll: "All goods",
      filterChests: "Lucky Chests",
      filterCaps: "Tokens",
      filterMaps: "Maps",
      filterDice: "Dice",
      sectionChests: "Lucky Chests",
      sectionCaps: "Tokens",
      sectionMaps: "Maps",
      sectionDice: "Dice",
      seeAll: "See all →",
      hideOwned: "Hide owned",
      equipped: "Owned",
      equip: "Equip",
      inChest: "In chest →",
      lookInside: "See what's inside",
      comingSoon: "Coming soon",
      free: "Free",
    });

const filter = ref<FilterId>("all");
const hideOwned = ref(false);

const filters = computed(() => [
  { id: "all" as FilterId,      label: L.value.filterAll },
  { id: "chests" as FilterId,   label: L.value.filterChests },
  { id: "caps" as FilterId,     label: L.value.filterCaps },
  { id: "maps" as FilterId,     label: L.value.filterMaps },
  { id: "dice" as FilterId,     label: L.value.filterDice },
]);

const ownedSet = computed(() => inv.owned);

function isOwned(id: string) { return ownedSet.value.has(id); }

function isCapEquipped(id: string) {
  // Cap ids start with "cap-"; equipped token uses original "token-" namespace.
  // Until a migration unifies them we just compare directly so the UI shows
  // "Надеть" when owned but not the active token.
  return inv.equippedToken === id;
}

function rarityLabel(r: Rarity): string {
  return (isRu.value ? RARITY_LABEL_RU : RARITY_LABEL_EN)[r];
}
function rarityBadge(r: Rarity): string { return RARITY_BADGE_BG[r]; }

function pickName(n: { en: string; ru: string }) {
  return isRu.value ? n.ru : n.en;
}

const visibleCaps = computed<CapEntry[]>(() =>
  hideOwned.value
    ? SHOP_CAPS.filter((c) => !isOwned(c.id))
    : [...SHOP_CAPS],
);

const visibleMaps = computed<MapEntry[]>(() =>
  hideOwned.value
    ? SHOP_MAPS.filter((m) => !isOwned(m.id))
    : [...SHOP_MAPS],
);

/** First N caps shown under "Все товары" preview row. */
const capsPreview = computed<CapEntry[]>(() => SHOP_CAPS.slice(0, 4));

const heroChest = computed<ChestEntry | undefined>(() => SHOP_CHESTS[0]);

// ── Modals -----------------------------------------------------------------
const successData = ref<PurchaseData | null>(null);
const failData = ref<PurchaseFailData | null>(null);
const successOpen = computed(() => !!successData.value);
const failOpen = computed(() => !!failData.value);

// ── Actions ---------------------------------------------------------------
function goBack() { haptic("light"); router.back(); }

function onCapAction(cap: CapEntry) {
  if (isOwned(cap.id)) {
    if (isCapEquipped(cap.id)) return;
    inv.equip(cap.id, "token");
    haptic("light");
    notify("success");
    return;
  }
  if (cap.chestOnly) {
    // "В сундуке →" — open the chest that contains this cap so the user can
    // see drop chances + buy directly. Falls back to the chests filter if the
    // catalogue doesn't pin this cap to a specific chest yet.
    const chest = SHOP_CHESTS.find((c) => c.items?.some((it) => it.capId === cap.id));
    if (chest) { openChest(chest); return; }
    filter.value = "chests";
    haptic("light");
    return;
  }
  if (cap.starsPrice) {
    void buyWithStars(cap.id, pickName(cap.name), cap.starsPrice);
    return;
  }
  // Free cap → grant.
  const ok = inv.buy(cap.id, 0);
  if (ok) { haptic("light"); notify("success"); }
}

function onMapAction(map: MapEntry) {
  if (isOwned(map.id)) return;
  if (map.starsPrice) {
    void buyWithStars(map.id, pickName(map.name), map.starsPrice);
  }
}

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
    const tgApp: any = tg.value as any;
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

// ── Chest modal -----------------------------------------------------------
const chestModalChest = ref<ChestEntry | null>(null);
const chestModalOpen = computed(() => chestModalChest.value !== null);

function openChest(chest?: ChestEntry) {
  haptic("medium");
  chestModalChest.value = chest ?? heroChest.value ?? null;
}
function closeChestModal() { chestModalChest.value = null; }


// ── Button label / class resolvers (used in template) ─────────────────────
function capBtnLabel(cap: CapEntry): string {
  if (isOwned(cap.id)) return isCapEquipped(cap.id) ? L.value.equipped : L.value.equip;
  if (cap.chestOnly) return L.value.inChest;
  if (cap.starsPrice != null) return String(cap.starsPrice);
  return L.value.free;
}
function capBtnClass(cap: CapEntry) {
  if (isOwned(cap.id) && isCapEquipped(cap.id)) return "shop2__btn--equipped";
  if (isOwned(cap.id)) return "shop2__btn--equip";
  if (cap.chestOnly) return "shop2__btn--grad";
  if (cap.starsPrice != null) return "shop2__btn--stars";
  return "shop2__btn--equip";
}

function mapBtnLabel(m: MapEntry): string {
  if (isOwned(m.id)) return L.value.equipped;
  if (m.starsPrice != null) return String(m.starsPrice);
  return L.value.free;
}
function mapBtnClass(m: MapEntry) {
  if (isOwned(m.id)) return "shop2__btn--equipped";
  if (m.starsPrice != null) return "shop2__btn--stars";
  return "shop2__btn--equip";
}

</script>

<template>
  <div class="shop2">
    <!-- ── Topbar ── -->
    <div class="shop2__topbar">
      <button class="shop2__back" :aria-label="L.title" @click="goBack">
        <Icon name="back" :size="22" color="#000"/>
      </button>
      <h1 class="shop2__title">{{ L.title }}</h1>
    </div>

    <!-- ── Filter chips (horizontal scroll) ── -->
    <div class="shop2__filters" :class="{ 'shop2__filters--scrolled': scrolled }">
      <div class="shop2__filters-track">
        <button
          v-for="f in filters"
          :key="f.id"
          class="shop2__chip"
          :class="{ 'shop2__chip--active': filter === f.id }"
          @click="filter = f.id; haptic('light')"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div class="shop2__content" ref="scrollEl" @scroll.passive="onScroll">
      <!-- ╔═══ ALL: chest hero + caps preview ═══╗ -->
      <template v-if="filter === 'all'">
        <h2 class="shop2__section-title">{{ L.sectionChests }}</h2>
        <div v-if="heroChest" class="shop2__chest" :style="{ borderColor: rarityBadge(heroChest.rarity) }">
          <div class="shop2__chest-content">
            <span class="shop2__rarity" :style="{ background: rarityBadge(heroChest.rarity) }">
              {{ rarityLabel(heroChest.rarity) }}
            </span>
            <h3 class="shop2__chest-name">{{ pickName(heroChest.name) }}</h3>
            <div class="shop2__chest-row">
              <div
                v-for="ct in heroChest.contains"
                :key="ct"
                class="shop2__chest-chip"
              >
                <CosmeticsCaps :type="ct" rarity="epic" :size="22"/>
              </div>
              <div class="shop2__chest-chip shop2__chest-chip--more">
                +{{ heroChest.containsExtra }}
              </div>
            </div>
            <button class="shop2__btn-grad shop2__chest-cta" @click="openChest(heroChest)">
              <span>{{ L.lookInside }}</span>
            </button>
          </div>
          <div class="shop2__chest-art" aria-hidden="true">
            <img
              v-if="heroChest.cardArt || heroChest.artClosed"
              class="shop2__chest-img"
              :src="heroChest.cardArt || heroChest.artClosed"
              alt=""
              draggable="false"
            />
            <span v-else class="shop2__chest-emoji">📦</span>
          </div>
        </div>

        <div class="shop2__section-head">
          <h2 class="shop2__section-title">{{ L.sectionCaps }}</h2>
          <button class="shop2__see-all" @click="filter = 'caps'; haptic('light')">
            {{ L.seeAll }}
          </button>
        </div>

        <div class="shop2__grid">
          <article
            v-for="cap in capsPreview"
            :key="cap.id"
            class="shop2__card"
          >
            <div class="shop2__preview">
              <CosmeticsCaps :type="cap.type" :rarity="cap.rarity" :size="72"/>
            </div>
            <div class="shop2__meta">
              <span class="shop2__rarity" :style="{ background: rarityBadge(cap.rarity) }">
                {{ rarityLabel(cap.rarity) }}
              </span>
              <h3 class="shop2__name">{{ pickName(cap.name) }}</h3>
            </div>
            <button
              class="shop2__btn"
              :class="capBtnClass(cap)"
              @click="onCapAction(cap)"
            >
              <Icon
                v-if="cap.starsPrice && !isOwned(cap.id) && !cap.chestOnly"
                name="star"
                :size="14"
                color="#fff"
              />
              <span>{{ capBtnLabel(cap) }}</span>
            </button>
          </article>
        </div>
      </template>

      <!-- ╔═══ CHESTS ═══╗ -->
      <template v-else-if="filter === 'chests'">
        <h2 class="shop2__section-title">{{ L.sectionChests }}</h2>
        <div
          v-for="ch in SHOP_CHESTS"
          :key="ch.id"
          class="shop2__chest"
          :style="{ borderColor: rarityBadge(ch.rarity) }"
        >
          <div class="shop2__chest-content">
            <span class="shop2__rarity" :style="{ background: rarityBadge(ch.rarity) }">
              {{ rarityLabel(ch.rarity) }}
            </span>
            <h3 class="shop2__chest-name">{{ pickName(ch.name) }}</h3>
            <div class="shop2__chest-row">
              <div
                v-for="ct in ch.contains"
                :key="ct"
                class="shop2__chest-chip"
              >
                <CosmeticsCaps :type="ct" rarity="epic" :size="22"/>
              </div>
              <div class="shop2__chest-chip shop2__chest-chip--more">
                +{{ ch.containsExtra }}
              </div>
            </div>
            <button class="shop2__btn-grad shop2__chest-cta" @click="openChest(ch)">
              <span>{{ L.lookInside }}</span>
            </button>
          </div>
          <div class="shop2__chest-art" aria-hidden="true">
            <img
              v-if="ch.cardArt || ch.artClosed"
              class="shop2__chest-img"
              :src="ch.cardArt || ch.artClosed"
              alt=""
              draggable="false"
            />
            <span v-else class="shop2__chest-emoji">📦</span>
          </div>
        </div>
      </template>

      <!-- ╔═══ CAPS ═══╗ -->
      <template v-else-if="filter === 'caps'">
        <div class="shop2__section-head">
          <h2 class="shop2__section-title">{{ L.sectionCaps }}</h2>
          <button
            class="shop2__toggle"
            :class="{ 'shop2__toggle--on': hideOwned }"
            @click="hideOwned = !hideOwned; haptic('light')"
          >
            <span>{{ L.hideOwned }}</span>
            <span class="shop2__toggle-mark">
              <Icon v-if="hideOwned" name="check" :size="12" color="#000"/>
            </span>
          </button>
        </div>

        <div class="shop2__grid">
          <article
            v-for="cap in visibleCaps"
            :key="cap.id"
            class="shop2__card"
          >
            <div class="shop2__preview">
              <CosmeticsCaps :type="cap.type" :rarity="cap.rarity" :size="72"/>
            </div>
            <div class="shop2__meta">
              <span class="shop2__rarity" :style="{ background: rarityBadge(cap.rarity) }">
                {{ rarityLabel(cap.rarity) }}
              </span>
              <h3 class="shop2__name">{{ pickName(cap.name) }}</h3>
            </div>
            <button
              class="shop2__btn"
              :class="capBtnClass(cap)"
              @click="onCapAction(cap)"
            >
              <Icon
                v-if="cap.starsPrice && !isOwned(cap.id) && !cap.chestOnly"
                name="star"
                :size="14"
                color="#fff"
              />
              <span>{{ capBtnLabel(cap) }}</span>
            </button>
          </article>
        </div>
      </template>

      <!-- ╔═══ MAPS ═══╗ -->
      <template v-else-if="filter === 'maps'">
        <div class="shop2__section-head">
          <h2 class="shop2__section-title">{{ L.sectionMaps }}</h2>
          <button
            class="shop2__toggle"
            :class="{ 'shop2__toggle--on': hideOwned }"
            @click="hideOwned = !hideOwned; haptic('light')"
          >
            <span>{{ L.hideOwned }}</span>
            <span class="shop2__toggle-mark">
              <Icon v-if="hideOwned" name="check" :size="12" color="#000"/>
            </span>
          </button>
        </div>

        <div class="shop2__grid">
          <article
            v-for="m in visibleMaps"
            :key="m.id"
            class="shop2__card shop2__card--map"
          >
            <div class="shop2__preview shop2__preview--map">
              <CosmeticsMaps :type="m.type" :rarity="m.rarity" :size="100"/>
            </div>
            <div class="shop2__meta">
              <span class="shop2__rarity" :style="{ background: rarityBadge(m.rarity) }">
                {{ rarityLabel(m.rarity) }}
              </span>
              <h3 class="shop2__name shop2__name--two">{{ pickName(m.name) }}</h3>
            </div>
            <button
              class="shop2__btn"
              :class="mapBtnClass(m)"
              @click="onMapAction(m)"
            >
              <Icon
                v-if="m.starsPrice && !isOwned(m.id)"
                name="star"
                :size="14"
                color="#fff"
              />
              <span>{{ mapBtnLabel(m) }}</span>
            </button>
          </article>
        </div>
      </template>

      <!-- ╔═══ DICE (empty) ═══╗ -->
      <template v-else>
        <h2 class="shop2__section-title">{{ L.sectionDice }}</h2>
        <div class="shop2__empty">
          <Icon name="dice" :size="48" color="rgba(255,255,255,0.5)"/>
          <p>{{ L.comingSoon }}</p>
        </div>
      </template>
    </div>

    <PurchaseSuccessModal
      :open="successOpen"
      :data="successData"
      :on-close="() => (successData = null)"
    />
    <PurchaseFailModal
      :open="failOpen"
      :data="failData"
      :on-close="() => (failData = null)"
    />
    <ChestModal
      :open="chestModalOpen"
      :chest="chestModalChest"
      @close="closeChestModal"
    />
  </div>
</template>

<style scoped>
.shop2 {
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

/* ── Topbar ── */
.shop2__topbar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 24px 8px;
  flex-shrink: 0;
}
.shop2__back {
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
.shop2__back:active { transform: scale(0.93); }
.shop2__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}

/* ── Filters: horizontal scroll w/ fade mask ── */
.shop2__filters {
  flex-shrink: 0;
  background: #1362c7;
  position: relative;
  z-index: 4;
  transition: background-color 200ms ease, box-shadow 200ms ease, border-radius 200ms ease;
}
/* Scrolled state — bottom of the header zone (topbar + filters) detaches
   from the content via rounded bottom corners + shadow, matching RoomView. */
.shop2__filters--scrolled {
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
}
.shop2__filters-track {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 24px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 16px,
    #000 calc(100% - 16px),
    transparent 100%
  );
          mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 16px,
    #000 calc(100% - 16px),
    transparent 100%
  );
}
.shop2__filters-track::-webkit-scrollbar { display: none; }
.shop2__chip {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  letter-spacing: 0;
  cursor: pointer;
  white-space: nowrap;
  text-shadow: 0.2px 0.2px 0 #000;
  transition: background 120ms, color 120ms;
}
.shop2__chip--active {
  background: #fff;
  color: #000;
  border-color: #fff;
  text-shadow: none;
}

/* ── Content area ── */
.shop2__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 32px 24px 32px;
  position: relative;
  z-index: 3;
}
.shop2__content::-webkit-scrollbar { width: 4px; }
.shop2__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

/* ── Section heading ── */
.shop2__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.shop2__section-title {
  margin: 0 0 16px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
}
.shop2__section-head .shop2__section-title { margin: 0; }
.shop2__see-all {
  background: #fff;
  color: #000;
  border: none;
  padding: 5px 8px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

/* ── Grid ── */
.shop2__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

/* ── Card ── */
.shop2__card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #000;
}
.shop2__preview {
  height: 76px;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.shop2__preview--map { height: 100px; }

.shop2__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.shop2__rarity {
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
.shop2__name {
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
.shop2__name--two {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

/* ── Buy button (4 visual states) ── */
.shop2__btn {
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
.shop2__btn:active { filter: brightness(0.95); transform: translateY(1px); }
.shop2__btn--stars {
  background: linear-gradient(to left, #e069d0 0%, #718fff 100%);
  color: #fff;
}
.shop2__btn--equip {
  background: #56e63e;
  color: #000;
}
.shop2__btn--equipped {
  background: rgba(0, 0, 0, 0.2);
  color: rgba(0, 0, 0, 0.6);
  cursor: default;
}
.shop2__btn--grad {
  background: linear-gradient(101deg, #005eff 0%, #6f4bff 100%);
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.32);
}

/* ── Hide-owned toggle pill ── */
.shop2__toggle {
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
.shop2__toggle-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 0.93px solid rgba(0, 0, 0, 0.4);
  background: transparent;
}
.shop2__toggle--on .shop2__toggle-mark {
  background: #56e63e;
  border-color: #56e63e;
}

/* ── Chest hero ── */
.shop2__chest {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 8px;
  background: #000;
  border: 1px solid #e069d0;
  border-radius: 24px;
  /* No outer padding — the chest art column needs to bleed all the way
     to the top, bottom, and right card edges. .shop2__chest-content
     re-introduces breathing room only on the text side. */
  padding: 0;
  margin-bottom: 32px;
  overflow: hidden;
}
.shop2__chest-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 14px 0 14px 14px;
  /* z-index above the chest art so the floating-cap overflow doesn't
     accidentally catch taps meant for the chips / CTA. */
  position: relative;
  z-index: 1;
}
.shop2__chest-name {
  margin: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.shop2__chest-row {
  display: flex;
  gap: 4px;
  align-items: center;
}
.shop2__chest-chip {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 0.4px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  overflow: hidden;
}
.shop2__chest-chip--more {
  background: #fff;
  color: #000;
  border-radius: 999px;
  border-color: transparent;
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 10px;
  line-height: 14px;
  width: auto;
  padding: 0 8px;
}
.shop2__chest-cta {
  margin-top: 2px;
  align-self: flex-start;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 11px;
  line-height: 14px;
  letter-spacing: 0.01em;
  background: linear-gradient(104deg, #005eff 0%, #6f4bff 100%);
  color: #fff;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.32);
}
.shop2__chest-art {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  width: 138px;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Emoji fallback — only used when no chest art (cardArt / artClosed) is
   wired up. The marketing-style cardArt ships its own halo + lighting so
   no extra CSS glow is layered on top. */
.shop2__chest-emoji {
  font-size: 96px;
  line-height: 1;
  filter: drop-shadow(0 4px 8px rgba(255, 200, 80, 0.4));
}
.shop2__chest-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Anchor the chest at the bottom-right of the card, with the floating
     caps spilling up + leftward — matches the Figma sticker placement
     where the composition reads as "treasure overflowing the corner". */
  object-position: right bottom;
  pointer-events: none;
  user-select: none;
}

.shop2__btn-grad {
  background: linear-gradient(104deg, #005eff 0%, #6f4bff 100%);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.32);
}
.shop2__btn-grad:active { filter: brightness(0.95); }

/* ── Theme/banner placeholder previews (Houses/Banners) ── */
.shop2__theme-emoji {
  font-size: 48px;
  line-height: 1;
}

/* ── Empty state (Dice) ── */
.shop2__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 18px;
}
.shop2__empty p {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 1px 1px 0 #000;
}

@media (min-width: 900px) {
  .shop2__content { padding: 32px 40px; }
}
</style>

<style>
/* Body-level blue + pattern matches HomeView so the topbar's safe-area
   strip stays blue instead of the default parchment cream. The 55% blue
   overlay is the same trick HomeView uses so the icon pattern reads at
   ~45% strength without an extra layer. */
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
body.shop-figma-root .shop2 {
  background: transparent !important;
}
</style>
