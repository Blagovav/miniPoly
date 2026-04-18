<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { SHOP_ITEMS } from "../shop/items";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";
import Icon from "../components/Icon.vue";
import TokenArt from "../components/TokenArt.vue";
import BoardPreview from "../components/BoardPreview.vue";
import PurchaseSuccessModal, { type PurchaseData } from "../components/PurchaseSuccessModal.vue";
import PurchaseFailModal, { type PurchaseFailData } from "../components/PurchaseFailModal.vue";
import { BOARDS, RARITY_META, type BoardDef } from "../utils/boards";
import { tokenArtFor, lighten, PLAYER_COLORS } from "../utils/palette";

type ShopItem = (typeof SHOP_ITEMS)[number];
type TabId = "tokens" | "maps" | "houses" | "banners" | "dice";

const { locale } = useI18n();
const router = useRouter();
const inv = useInventoryStore();
const { haptic, notify, tg, userId } = useTelegram();

// Подтянем купленные за Stars при входе в магазин.
onMounted(() => inv.syncServerUnlocks(userId.value));

// Purchase result modals
const successData = ref<PurchaseData | null>(null);
const failData = ref<PurchaseFailData | null>(null);
const successOpen = computed(() => !!successData.value);
const failOpen = computed(() => !!failData.value);

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Магазин",
      sub: "Фишки и бусты",
      buy: "Купить",
      equipped: "В игре",
      equip: "Надеть",
      owned: "В наличии",
      free: "Открыто",
      notEnough: "Не хватает монет",
      rarityCommon: "Обычная",
      rarityRare: "Редкая",
      rarityEpic: "Эпическая",
      rarityLegendary: "Легенда",
      emptyMaps: "Карты скоро",
      emptyDice: "Кости скоро",
      mapOwned: "В игре",
      mapBuy: "Купить",
    }
  : {
      title: "Shop",
      sub: "Tokens & boosts",
      buy: "Buy",
      equipped: "Owned",
      equip: "Equip",
      owned: "Owned",
      free: "Unlocked",
      notEnough: "Not enough coins",
      rarityCommon: "Common",
      rarityRare: "Rare",
      rarityEpic: "Epic",
      rarityLegendary: "Legendary",
      emptyMaps: "Maps coming soon",
      emptyDice: "Dice coming soon",
      mapOwned: "Owned",
      mapBuy: "Buy",
    });

const tab = ref<TabId>("tokens");

const tabs = computed(() => [
  { id: "tokens" as TabId, label: isRu.value ? "Фишки" : "Tokens" },
  { id: "maps" as TabId, label: isRu.value ? "Карты" : "Maps" },
  { id: "houses" as TabId, label: isRu.value ? "Цвета дома" : "Houses" },
  { id: "banners" as TabId, label: isRu.value ? "Знамёна" : "Banners" },
  { id: "dice" as TabId, label: isRu.value ? "Кости" : "Dice" },
]);

// Map tab → underlying SHOP_ITEMS kind (or null if tab has no data yet).
function kindForTab(t: TabId): ShopItem["kind"] | null {
  if (t === "tokens") return "token";
  if (t === "houses") return "theme";
  if (t === "banners") return "emote";
  return null; // maps & dice not yet in SHOP_ITEMS
}

const items = computed<ShopItem[]>(() => {
  const kind = kindForTab(tab.value);
  if (!kind) return [];
  return SHOP_ITEMS.filter((i) => i.kind === kind);
});

function isOwned(id: string) {
  return inv.owned.has(id);
}

function isEquipped(id: string, kind: ShopItem["kind"]) {
  if (kind === "token") return inv.equippedToken === id;
  if (kind === "theme") return inv.equippedTheme === id;
  return false;
}

// Rarity derived from price (no rarity field on SHOP_ITEMS).
function rarityOf(item: ShopItem): "common" | "rare" | "epic" | "legendary" {
  if (item.starsPrice) {
    if (item.starsPrice >= 100) return "legendary";
    return "epic";
  }
  if (item.price === 0) return "common";
  if (item.price >= 1500) return "legendary";
  if (item.price >= 800) return "epic";
  if (item.price >= 400) return "rare";
  return "common";
}

function rarityLabel(r: ReturnType<typeof rarityOf>): string {
  if (r === "rare") return L.value.rarityRare;
  if (r === "epic") return L.value.rarityEpic;
  if (r === "legendary") return L.value.rarityLegendary;
  return L.value.rarityCommon;
}

function rarityColor(r: ReturnType<typeof rarityOf>): string {
  if (r === "rare") return "var(--primary)";
  if (r === "epic") return "#9a3aa3";
  if (r === "legendary") return "var(--gold)";
  return "var(--ink-3)";
}

function itemName(item: ShopItem): string {
  return item.name[locale.value as "en" | "ru"];
}

function boardLabel(b: BoardDef): string {
  return isRu.value ? b.ru : b.name;
}
function boardRarityLabel(b: BoardDef): string {
  const m = RARITY_META[b.rarity];
  return isRu.value ? m.ru : m.en;
}
function boardRarityColor(b: BoardDef): string {
  return RARITY_META[b.rarity].color;
}
function isBoardOwned(b: BoardDef): boolean {
  if (b.rarity === "free") return true;
  if (b.owned === true) return true;
  return inv.owned.has(`board-${b.id}`);
}
function boardCtaBg(b: BoardDef): string {
  if (isBoardOwned(b)) return "var(--bg-deep)";
  if (b.rarity === "legendary" || b.rarity === "epic") return "var(--gold)";
  return "var(--primary)";
}

async function buyBoard(b: BoardDef) {
  if (isBoardOwned(b)) return;
  // Stars — через invoice
  if (b.unit === "★") {
    if (!userId.value) { notify("error"); return; }
    try {
      const base = (import.meta.env.VITE_API_URL as string) || "";
      const res = await fetch(`${base}/api/stars/invoice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tgUserId: userId.value,
          itemId: `board-${b.id}`,
          title: isRu.value ? b.ru : b.name,
          stars: b.price,
        }),
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
    return;
  }
  // Монетная покупка
  if (inv.coins < b.price) {
    notify("error");
    failData.value = {
      name: b.name, ru: b.ru,
      price: b.price, unit: "◈",
      balance: inv.coins, reason: "funds",
    };
    return;
  }
  const ok = inv.buy(`board-${b.id}`, b.price);
  if (ok) {
    haptic("medium");
    notify("success");
  } else {
    notify("error");
  }
}

function goBack() {
  haptic("light");
  router.back();
}

function purchaseDataOf(item: ShopItem): PurchaseData {
  return {
    id: item.id,
    name: item.name.en,
    ru: item.name.ru,
    price: item.price,
    unit: "◈",
    kind: item.kind === "emote" ? "banner" : (item.kind as "token" | "theme"),
    balanceAfter: `${inv.coins} ◈`,
  };
}

function onPrimaryAction(item: ShopItem) {
  // Owned → equip / already equipped
  if (isOwned(item.id)) {
    if (item.kind === "token" || item.kind === "theme") {
      if (isEquipped(item.id, item.kind)) return;
      inv.equip(item.id, item.kind);
      haptic("light");
      notify("success");
    }
    return;
  }
  // Not owned → buy with coins
  if (item.price > 0) {
    if (!canAffordCoins(item)) {
      failData.value = {
        name: item.name.en, ru: item.name.ru,
        price: item.price, unit: "◈",
        balance: inv.coins, reason: "funds",
      };
      notify("error");
      return;
    }
    const ok = inv.buy(item.id, item.price);
    if (ok) {
      haptic("medium");
      notify("success");
      successData.value = purchaseDataOf(item);
    } else {
      notify("error");
      failData.value = {
        name: item.name.en, ru: item.name.ru,
        price: item.price, unit: "◈",
        balance: inv.coins, reason: "generic",
      };
    }
    return;
  }
  // Free items that are somehow not owned — just grant.
  const ok = inv.buy(item.id, 0);
  if (ok) {
    haptic("light");
    notify("success");
    successData.value = purchaseDataOf(item);
  }
}

function equipFromSuccess() {
  const d = successData.value;
  if (!d) return;
  if (d.id && (d.kind === "token" || d.kind === "theme")) {
    inv.equip(d.id, d.kind);
    haptic("light");
  }
  successData.value = null;
}

async function buyWithStars(item: ShopItem) {
  if (!item.starsPrice || !userId.value) {
    notify("error");
    return;
  }
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const res = await fetch(`${base}/api/stars/invoice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tgUserId: userId.value,
        itemId: item.id,
        title: item.name[locale.value as "en" | "ru"],
        stars: item.starsPrice,
      }),
    });
    const data = await res.json();
    if (!data.link) {
      notify("error");
      alert("Не удалось создать счёт. Попробуй позже.");
      return;
    }
    const tgApp: any = tg.value as any;
    if (tgApp?.openInvoice) {
      tgApp.openInvoice(data.link, async (status: string) => {
        if (status === "paid") {
          notify("success");
          haptic("heavy");
          await inv.syncServerUnlocks(userId.value);
        } else if (status === "failed" || status === "cancelled") {
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

function primaryLabel(item: ShopItem): string {
  if (isOwned(item.id)) {
    if (item.kind === "token" || item.kind === "theme") {
      return isEquipped(item.id, item.kind) ? L.value.equipped : L.value.equip;
    }
    return L.value.owned;
  }
  return L.value.buy;
}

function canAffordCoins(item: ShopItem) {
  return inv.coins >= item.price;
}

// Medallion gradient for token preview — uses house-red palette for common,
// gold for premium (mirrors the Vue reference port exactly).
function discStyle(item: ShopItem) {
  if (item.starsPrice) {
    return {
      background: "radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914)",
      boxShadow:
        "0 0 0 2px #fff, 0 0 14px rgba(212,168,74,0.55), 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.5)",
    };
  }
  const base = PLAYER_COLORS.you;
  return {
    background: `radial-gradient(circle at 32% 28%, ${lighten(base, 0.45)}, ${base} 60%, ${lighten(base, -0.25)})`,
    boxShadow:
      "0 0 0 2px #fff, 0 3px 6px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.4)",
  };
}
</script>

<template>
  <div class="app shop">
    <!-- Topbar -->
    <div class="topbar">
      <button class="icon-btn" aria-label="back" @click="goBack">
        <Icon name="back" :size="18"/>
      </button>
      <div class="title">
        <h1>{{ L.title }}</h1>
        <div class="sub">{{ L.sub }}</div>
      </div>
      <div class="coins-chip">
        <Icon name="coin" :size="14" color="var(--gold)"/>
        <span class="money">{{ inv.coins }}</span>
        <span class="coins-chip__sep">·</span>
        <Icon name="star" :size="13" color="var(--gold)"/>
        <span class="money">42</span>
      </div>
    </div>

    <div class="content">
      <!-- Tabs (5) -->
      <div class="shop-tabs">
        <button
          v-for="tt in tabs"
          :key="tt.id"
          class="shop-tab"
          :class="{ active: tab === tt.id }"
          @click="tab = tt.id"
        >
          {{ tt.label }}
        </button>
      </div>

      <!-- Empty state for Dice tab (not wired to catalog yet) -->
      <div v-if="tab === 'dice'" class="coming-soon">
        <Icon name="dice" :size="36" color="var(--ink-3)"/>
        <p>{{ L.emptyDice }}</p>
      </div>

      <!-- Maps tab — heraldic boards with rarity, BoardPreview -->
      <div v-else-if="tab === 'maps'" class="shop-grid">
        <div
          v-for="b in BOARDS"
          :key="b.id"
          class="shop-card map-card"
          :class="{ legendary: b.rarity === 'legendary', owned: isBoardOwned(b) }"
        >
          <div v-if="isBoardOwned(b)" class="badge badge--owned">
            <Icon name="check" :size="10" color="#fff"/>
            <span>{{ L.mapOwned.toUpperCase() }}</span>
          </div>
          <div v-else-if="b.rarity === 'legendary'" class="badge badge--premium">
            <span>★ PRO</span>
          </div>

          <div class="map-card__preview" :style="{ borderColor: b.palette.gold }">
            <BoardPreview :board="b" :size="140"/>
          </div>

          <div class="item-name">{{ boardLabel(b) }}</div>
          <div class="item-rarity" :style="{ color: boardRarityColor(b) }">
            {{ boardRarityLabel(b) }}
          </div>

          <div class="row between card-foot">
            <div
              class="price"
              :class="{ 'price--epic': b.rarity === 'legendary' || b.rarity === 'epic' }"
            >
              <template v-if="isBoardOwned(b)">—</template>
              <template v-else>{{ b.unit === '★' ? '★ ' + b.price : '◈ ' + b.price }}</template>
            </div>
            <button
              class="btn cta"
              :disabled="isBoardOwned(b)"
              :style="{ background: boardCtaBg(b), color: isBoardOwned(b) ? 'var(--ink-3)' : '#fff' }"
              @click="buyBoard(b)"
            >
              <span>{{ isBoardOwned(b) ? L.mapOwned : L.mapBuy }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Grid of item cards -->
      <div v-else class="shop-grid">
        <div
          v-for="item in items"
          :key="item.id"
          class="shop-card"
          :class="{
            premium: !!item.starsPrice,
            owned: isOwned(item.id),
            equipped: isEquipped(item.id, item.kind as any),
          }"
        >
          <!-- Owned badge (top-left) -->
          <div v-if="isOwned(item.id)" class="badge badge--owned">
            <Icon name="check" :size="10" color="#fff"/>
            <span>{{ isEquipped(item.id, item.kind as any) ? L.equipped.toUpperCase() : L.owned.toUpperCase() }}</span>
          </div>
          <!-- Premium (Stars) badge (top-right) -->
          <div v-else-if="item.starsPrice" class="badge badge--premium">
            <span>★ PRO</span>
          </div>

          <!-- Preview: token medallion / theme tile / banner emoji -->
          <div
            v-if="item.kind === 'token'"
            class="preview preview--token"
            :class="{ 'preview--premium': !!item.starsPrice }"
          >
            <div class="token-disc" :style="discStyle(item)">
              <TokenArt :id="tokenArtFor(item.id)" :size="42" color="#fff" shadow="rgba(0,0,0,0.55)"/>
            </div>
            <template v-if="item.starsPrice">
              <span class="spark spark--1"/>
              <span class="spark spark--2"/>
              <span class="spark spark--3"/>
            </template>
          </div>
          <div
            v-else-if="item.kind === 'theme'"
            class="preview preview--theme"
          >
            <span class="theme-emoji">{{ item.icon }}</span>
          </div>
          <div
            v-else
            class="preview preview--emote"
          >
            <span class="emote-emoji">{{ item.icon }}</span>
          </div>

          <!-- Name -->
          <div class="item-name">{{ itemName(item) }}</div>
          <!-- Rarity -->
          <div class="item-rarity" :style="{ color: rarityColor(rarityOf(item)) }">
            {{ rarityLabel(rarityOf(item)) }}
          </div>

          <!-- Price + CTA row -->
          <div class="row between card-foot">
            <div class="price" :class="{ 'price--stars': !!item.starsPrice, 'price--epic': rarityOf(item) === 'epic' || rarityOf(item) === 'legendary' }">
              <template v-if="isOwned(item.id)">—</template>
              <template v-else-if="item.starsPrice">★ {{ item.starsPrice }}</template>
              <template v-else-if="item.price === 0">{{ L.free }}</template>
              <template v-else>◈ {{ item.price }}</template>
            </div>

            <!-- Primary CTA: Equip / Equipped / Buy (coins) -->
            <button
              v-if="!item.starsPrice || isOwned(item.id)"
              class="btn cta"
              :class="{
                'btn-primary': !isOwned(item.id),
                'btn-emerald': isOwned(item.id) && !isEquipped(item.id, item.kind as any) && (item.kind === 'token' || item.kind === 'theme'),
                'btn-ghost': isEquipped(item.id, item.kind as any) || (isOwned(item.id) && item.kind === 'emote'),
              }"
              :disabled="isEquipped(item.id, item.kind as any) || (isOwned(item.id) && item.kind === 'emote')"
              @click="onPrimaryAction(item)"
            >
              <Icon v-if="isEquipped(item.id, item.kind as any)" name="check" :size="12" color="currentColor"/>
              <span>{{ primaryLabel(item) }}</span>
            </button>

            <!-- Stars CTA for premium, unowned items -->
            <button
              v-else
              class="btn btn-wax cta cta--stars"
              @click="buyWithStars(item)"
            >
              <Icon name="star" :size="12" color="#fff"/>
              <span>{{ item.starsPrice }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <PurchaseSuccessModal
      :open="successOpen"
      :data="successData"
      :on-close="() => (successData = null)"
      :on-equip="successData?.kind === 'token' || successData?.kind === 'theme' ? equipFromSuccess : undefined"
    />
    <PurchaseFailModal
      :open="failOpen"
      :data="failData"
      :on-close="() => (failData = null)"
    />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--bg);
}

.icon-btn :deep(svg) { color: var(--ink-2); }

/* Coins chip in the topbar */
.coins-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 999px;
  flex-shrink: 0;
}
.coins-chip .money {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.coins-chip__sep {
  color: var(--line-strong);
  font-size: 12px;
}

/* Maps tab card overrides */
.map-card { padding: 10px; }
.map-card.legendary { border-color: var(--gold); box-shadow: 0 0 12px rgba(212, 168, 74, 0.25); }
.map-card__preview {
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--gold);
  margin-bottom: 10px;
  line-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  aspect-ratio: 1 / 1;
}
.map-card__preview :deep(svg) {
  width: 100%;
  height: 100%;
}

/* Tabs (5 narrow) */
.shop-tabs {
  display: flex;
  gap: 4px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px;
  margin-bottom: 14px;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 4px 12px -4px rgba(42, 29, 16, 0.15);
}
.shop-tab {
  flex: 1;
  padding: 8px 4px;
  background: transparent;
  color: var(--ink-2);
  border: none;
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 160ms, color 160ms;
  white-space: nowrap;
}
.shop-tab.active {
  background: var(--primary);
  color: #fff;
}

/* Coming-soon stub for Maps / Dice */
.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
  background: var(--card);
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  color: var(--ink-3);
  text-align: center;
}
.coming-soon p {
  margin: 0;
  font-size: 13px;
  font-family: var(--font-body);
  letter-spacing: 0.04em;
}

/* Grid */
.shop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* Card */
.shop-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.shop-card.premium { border-color: var(--gold); }
.shop-card.equipped { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }

/* Badges */
.badge {
  position: absolute;
  top: 6px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.1em;
  font-weight: 700;
  line-height: 1;
}
.badge--owned {
  left: 6px;
  background: var(--emerald);
  color: #fff;
}
.badge--premium {
  right: 6px;
  background: var(--gold);
  color: #1a1000;
}
.badge :deep(svg) { display: block; }

/* Preview area */
.preview {
  border-radius: 8px;
  border: 1px solid var(--line);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.preview--token {
  height: 86px;
  background: linear-gradient(145deg, var(--card-alt), var(--bg-deep));
}
.preview--token.preview--premium {
  background: radial-gradient(circle at 50% 40%, #3a2d0e, #1a130d);
}
.token-disc {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview--theme {
  height: 68px;
  background: linear-gradient(135deg, var(--bg-deep), var(--card-alt));
}
.theme-emoji {
  font-size: 34px;
  line-height: 1;
}

.preview--emote {
  height: 68px;
  background: linear-gradient(145deg, var(--card-alt), var(--bg-deep));
}
.emote-emoji {
  font-size: 36px;
  line-height: 1;
}

.spark {
  position: absolute;
  border-radius: 50%;
  background: #d4a84a;
}
.spark--1 { top: 8px; left: 12px; width: 3px; height: 3px; opacity: 0.7; }
.spark--2 { top: 18px; right: 16px; width: 2px; height: 2px; opacity: 0.6; background: #f5d98a; }
.spark--3 { bottom: 14px; left: 20px; width: 2px; height: 2px; opacity: 0.5; }

/* Text */
.item-name {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-rarity {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  margin-top: 2px;
}

/* Foot row */
.card-foot { margin-top: 8px; gap: 6px; }
.price {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-2);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.price--stars { color: var(--gold); }
.price--epic { color: var(--gold); }

.cta {
  padding: 5px 11px;
  font-size: 11px;
  border-radius: 999px;
  line-height: 1;
  min-height: 0;
  font-weight: 600;
  white-space: nowrap;
  gap: 4px;
}
.cta--stars { padding: 5px 10px; }
</style>
