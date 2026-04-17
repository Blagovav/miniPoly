<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { SHOP_ITEMS } from "../shop/items";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";

const { t, locale } = useI18n();
const router = useRouter();
const inv = useInventoryStore();
const { haptic, notify, tg, userId } = useTelegram();

// Подтянем купленные за Stars при входе в магазин.
onMounted(() => inv.syncServerUnlocks(userId.value));

async function buyWithStars(item: (typeof SHOP_ITEMS)[number]) {
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

const tabs = [
  { id: "token", label: "shop.tokens" },
  { id: "theme", label: "shop.themes" },
  { id: "emote", label: "shop.emotes" },
] as const;

const tab = ref<(typeof tabs)[number]["id"]>("token");

const items = computed(() => SHOP_ITEMS.filter((i) => i.kind === tab.value));

function isOwned(id: string) {
  return inv.owned.has(id);
}

function isEquipped(id: string, kind: "token" | "theme") {
  if (kind === "token") return inv.equippedToken === id;
  if (kind === "theme") return inv.equippedTheme === id;
  return false;
}

function onAction(item: (typeof SHOP_ITEMS)[number]) {
  if (!isOwned(item.id)) {
    const ok = inv.buy(item.id, item.price);
    if (ok) {
      haptic("medium");
      notify("success");
    } else {
      notify("error");
    }
    return;
  }
  if (item.kind === "token" || item.kind === "theme") {
    inv.equip(item.id, item.kind);
    haptic("light");
  }
}

function actionLabel(item: (typeof SHOP_ITEMS)[number]) {
  if (!isOwned(item.id)) return `${t("shop.buy")} · ${item.price} 🪙`;
  if (item.kind === "token" || item.kind === "theme") {
    return isEquipped(item.id, item.kind) ? t("shop.equipped") : t("shop.equip");
  }
  return t("shop.owned");
}
</script>

<template>
  <div class="shop">
    <header class="shop__head">
      <button class="btn btn--ghost back" @click="router.back()">←</button>
      <h2 class="title">{{ t("shop.title") }}</h2>
      <div class="chip coins">🪙 <span class="money">{{ inv.coins }}</span></div>
    </header>

    <div class="tabs">
      <button
        v-for="tt in tabs"
        :key="tt.id"
        :class="['tab', tab === tt.id && 'active']"
        @click="tab = tt.id"
      >
        {{ t(tt.label) }}
      </button>
    </div>

    <div class="grid">
      <div
        v-for="item in items"
        :key="item.id"
        :class="['item', isOwned(item.id) && 'owned', isEquipped(item.id, item.kind as any) && 'equipped']"
      >
        <div v-if="item.starsPrice && !isOwned(item.id)" class="item__stars-badge">⭐ {{ item.starsPrice }}</div>
        <div class="item__icon">{{ item.icon }}</div>
        <div class="item__name">{{ item.name[locale as "en" | "ru"] }}</div>
        <button class="btn btn--ghost item__cta" @click="onAction(item)">
          {{ actionLabel(item) }}
        </button>
        <button
          v-if="item.starsPrice && !isOwned(item.id)"
          class="btn btn--primary item__stars-btn"
          @click="buyWithStars(item)"
        >
          ⭐ Stars
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop {
  padding: 18px;
  max-width: 640px;
  margin: 0 auto;
}
.shop__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.shop__head .title { flex: 1; font-size: 22px; }
.back {
  width: 40px; height: 40px; padding: 0; border-radius: 12px;
}
.coins {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.05));
  border-color: rgba(251, 191, 36, 0.35);
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 14px;
  border: 1px solid var(--border);
  margin-bottom: 14px;
}
.tab {
  flex: 1;
  padding: 10px;
  font-weight: 600;
  color: var(--text-dim);
  border-radius: 10px;
  font-size: 13px;
  transition: all 0.2s ease;
}
.tab.active {
  background: linear-gradient(135deg, var(--purple), #7e22ce);
  color: #fff;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.item {
  padding: 14px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  text-align: center;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
.item.owned { border-color: rgba(34, 197, 94, 0.45); }
.item.equipped {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px var(--gold), 0 0 20px -6px rgba(251, 191, 36, 0.5);
}
.item__icon {
  font-size: 42px;
  line-height: 1;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
}
.item__name {
  font-weight: 600;
  font-size: 13px;
  min-height: 32px;
  display: flex;
  align-items: center;
  text-align: center;
}
.item__cta {
  padding: 8px 10px;
  font-size: 12px;
  width: 100%;
}
.item__stars-btn {
  padding: 8px 10px;
  font-size: 12px;
  width: 100%;
  background: linear-gradient(135deg, #ffd95e 0%, #f59e0b 100%);
}
.item__stars-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 800;
  background: linear-gradient(135deg, #ffd95e, #d97706);
  color: #1a1000;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.5);
}
.item { position: relative; }
</style>
