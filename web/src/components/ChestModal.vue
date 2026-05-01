<script setup lang="ts">
/**
 * Lootbox modal — Figma 103:2328 / 105:3185 / 105:3394 / 110:4357.
 *
 * Three view states driven by the internal `mode` ref:
 *   - "details"  — info, items list with drop chances, qty selector, КУПИТЬ
 *   - "opening"  — closed-chest art + "Открываем..." (1.5s purchase animation)
 *   - "result"   — open-chest art + revealed card(s) + ОТКРЫТЬ ЕЩЁ
 *
 * The modal owns the buy/roll loop internally so the parent (ShopView) just
 * passes the chest + open prop and listens for `close`. Stars purchase reuses
 * the same /api/stars/invoice flow as ShopView for cap/map purchases.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useTelegram } from "../composables/useTelegram";
import { useInventoryStore } from "../stores/inventory";
import {
  SHOP_CAPS, SHOP_MAPS,
  RARITY_LABEL_RU, RARITY_LABEL_EN, RARITY_BADGE_BG,
  type ChestEntry,
} from "../shop/cosmetics";
import CosmeticsCaps from "./CosmeticsCaps.vue";
import CosmeticsMaps from "./CosmeticsMaps.vue";
import Icon from "./Icon.vue";
import type { Rarity } from "./RarityGlow.vue";

const props = defineProps<{
  open: boolean;
  chest: ChestEntry | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { locale } = useI18n();
const { haptic, notify, tg, userId } = useTelegram();
const inv = useInventoryStore();

const isRu = computed(() => locale.value === "ru");

type Mode = "details" | "opening" | "result";
const mode = ref<Mode>("details");
const selectedQtyIdx = ref(0);
const revealedItems = ref<string[]>([]);
const purchasing = ref(false);

// Reset state every time the modal is opened so a re-open after close lands
// back on the details view rather than whatever was last shown.
watch(() => props.open, (v) => {
  if (v && props.chest) {
    mode.value = "details";
    selectedQtyIdx.value = props.chest.defaultQtyIdx ?? 0;
    revealedItems.value = [];
    purchasing.value = false;
  }
});

const L = computed(() => isRu.value
  ? {
      collectAll: "Собери все и получи игровую карту",
      itemsInside: "Предметы в наборе",
      tagMap: "Карта",
      tagCap: "Фишка",
      owned: "Есть",
      buy: "КУПИТЬ",
      openMore: "ОТКРЫТЬ ЕЩЁ",
      opening: "Открываем...",
      openingSub: "Бросаем кубики на удачу",
      opened: "Сундук открыт!",
      openedSub: "Ценные награды нашли хозяина",
      equip: "Надеть",
      equipped: "Надето",
      missingDesc: "<Описание сундука>",
    }
  : {
      collectAll: "Collect them all to unlock a map",
      itemsInside: "Items in the set",
      tagMap: "Map",
      tagCap: "Token",
      owned: "Owned",
      buy: "BUY",
      openMore: "OPEN MORE",
      opening: "Opening...",
      openingSub: "Rolling the dice",
      opened: "Chest opened!",
      openedSub: "The loot is yours",
      equip: "Equip",
      equipped: "Equipped",
      missingDesc: "<Chest description>",
    });

// ─── Static lookups ───────────────────────────────────────────────────────
const CAP_BY_ID = new Map(SHOP_CAPS.map((c) => [c.id, c] as const));
const MAP_BY_ID = new Map(SHOP_MAPS.map((m) => [m.id, m] as const));

function rarityLabelFor(r: Rarity) { return (isRu.value ? RARITY_LABEL_RU : RARITY_LABEL_EN)[r]; }
function rarityBadge(r: Rarity) { return RARITY_BADGE_BG[r]; }
function pickName(n: { en: string; ru: string }) { return isRu.value ? n.ru : n.en; }

function capRarityFor(id: string): Rarity { return CAP_BY_ID.get(id)?.rarity ?? "common"; }
function capTypeForId(id: string) { return CAP_BY_ID.get(id)?.type ?? "car"; }
function capNameFor(id: string) {
  const c = CAP_BY_ID.get(id);
  return c ? pickName(c.name) : id;
}

const chestRarityLabel = computed(() => props.chest ? rarityLabelFor(props.chest.rarity) : "");
const chestRarityBg    = computed(() => props.chest ? rarityBadge(props.chest.rarity) : "#000");

const setBonusMap = computed(() => {
  const id = props.chest?.setBonusMapId;
  return id ? MAP_BY_ID.get(id) ?? null : null;
});

// "X из N" for the set-bonus progress chip — driven by current inventory.
const setProgress = computed(() => {
  const items = props.chest?.items ?? [];
  const owned = items.filter((it) => inv.owned.has(it.capId)).length;
  return { owned, total: items.length };
});

function isOwned(capId: string) { return inv.owned.has(capId); }
function isCapEquipped(capId: string) { return inv.equippedToken === capId; }

const titleText = computed(() => {
  if (!props.chest) return "";
  if (mode.value === "opening") return L.value.opening;
  if (mode.value === "result")  return L.value.opened;
  return pickName(props.chest.name);
});
const subtitleText = computed(() => {
  if (!props.chest) return "";
  if (mode.value === "opening") return L.value.openingSub;
  if (mode.value === "result")  return L.value.openedSub;
  return props.chest.description ? pickName(props.chest.description) : L.value.missingDesc;
});

const currentPrice = computed(() => {
  const opts = props.chest?.pricesByQty ?? [];
  return opts[selectedQtyIdx.value] ?? { qty: 1, stars: 0 };
});

// ─── Buy + roll loop ──────────────────────────────────────────────────────
function onClose() {
  if (purchasing.value) return;          // wait until the invoice resolves
  haptic("light");
  emit("close");
}

async function onBuy() {
  if (!props.chest || purchasing.value) return;
  if (!userId.value) { notify("error"); return; }
  haptic("medium");
  purchasing.value = true;
  try {
    const ok = await runStarsPurchase(currentPrice.value.stars);
    if (!ok) { purchasing.value = false; return; }
    // Animate "Открываем…" briefly, then roll + reveal.
    mode.value = "opening";
    await wait(1500);
    revealedItems.value = rollItems(currentPrice.value.qty);
    revealedItems.value.forEach((capId) => inv.buy(capId, 0));
    haptic("heavy");
    notify("success");
    mode.value = "result";
  } finally {
    purchasing.value = false;
  }
}

async function runStarsPurchase(stars: number): Promise<boolean> {
  if (!props.chest) return false;
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const res = await fetch(`${base}/api/stars/invoice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tgUserId: userId.value,
        itemId: `${props.chest.id}-x${currentPrice.value.qty}`,
        title: `${pickName(props.chest.name)} × ${currentPrice.value.qty}`,
        stars,
      }),
    });
    const data = await res.json();
    if (!data.link) { notify("error"); return false; }
    const tgApp: any = tg.value;
    if (!tgApp?.openInvoice) {
      // Browser fallback — opens the invoice in a new tab. We can't observe
      // payment from here, so we treat any non-error as "paid" for the sake
      // of the local reveal animation. Real Stars purchases happen inside TG.
      window.open(data.link, "_blank");
      return true;
    }
    return await new Promise<boolean>((resolve) => {
      tgApp.openInvoice(data.link, async (status: string) => {
        if (status === "paid") {
          await inv.syncServerUnlocks(userId.value);
          resolve(true);
        } else {
          if (status !== "pending") notify("error");
          resolve(false);
        }
      });
    });
  } catch {
    notify("error");
    return false;
  }
}

/** Weighted-random pick across `chest.items` — repeated for `qty` opens.
 *  Avoids drawing the exact same cap twice in one batch when possible
 *  (multi-pulls feel bad if you get three duplicates). */
function rollItems(qty: number): string[] {
  const items = props.chest?.items ?? [];
  if (items.length === 0) return [];
  const totalWeight = items.reduce((s, it) => s + it.chance, 0) || 1;
  const out: string[] = [];
  for (let i = 0; i < qty; i++) {
    let r = Math.random() * totalWeight;
    let pickedIdx = 0;
    for (let j = 0; j < items.length; j++) {
      r -= items[j].chance;
      if (r <= 0) { pickedIdx = j; break; }
    }
    let capId = items[pickedIdx].capId;
    // Re-roll once if we'd give the same cap as the previous pull and there
    // are unseen alternatives. Cosmetic-only — server-authoritative drops
    // would replace this in production.
    if (i > 0 && capId === out[i - 1] && items.length > 1) {
      const alt = items.filter((it) => it.capId !== capId);
      if (alt.length > 0) capId = alt[Math.floor(Math.random() * alt.length)].capId;
    }
    out.push(capId);
  }
  return out;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function onEquipReward(capId: string) {
  if (isCapEquipped(capId)) return;
  inv.equip(capId, "token");
  haptic("light");
  notify("success");
}

function selectQty(i: number) {
  if (purchasing.value) return;
  haptic("light");
  selectedQtyIdx.value = i;
}
</script>

<template>
  <Teleport to="body">
    <transition name="chest-fade">
      <div v-if="open && chest" class="chest-overlay" @click.self="onClose">
        <transition name="chest-pop">
          <div :key="mode" class="chest-modal" :class="`chest-modal--${mode}`">
            <button
              class="chest-close"
              :aria-label="isRu ? 'Закрыть' : 'Close'"
              :disabled="purchasing"
              @click="onClose"
            >
              <Icon name="x" :size="14" color="#000" />
            </button>

            <!-- ─── Hero (chest art + glow) ─── -->
            <div class="chest-hero">
              <div class="chest-hero__glow chest-hero__glow--bg" />
              <div class="chest-hero__glow chest-hero__glow--fg" />
              <img
                class="chest-hero__art"
                :class="{ 'chest-hero__art--open': mode === 'result' }"
                :src="mode === 'result' ? chest.artOpen : chest.artClosed"
                alt=""
                draggable="false"
              />
            </div>

            <!-- ─── Title block ─── -->
            <div class="chest-titleblock">
              <span class="chest-rarity" :style="{ background: chestRarityBg }">
                {{ chestRarityLabel }}
              </span>
              <h2 class="chest-title">{{ titleText }}</h2>
              <p v-if="subtitleText" class="chest-subtitle">{{ subtitleText }}</p>
            </div>

            <!-- ─── Body ─── -->
            <div class="chest-body">
              <!-- ─── DETAILS mode ─── -->
              <template v-if="mode === 'details'">
                <div v-if="chest.pricesByQty && chest.pricesByQty.length > 1" class="chest-qty">
                  <button
                    v-for="(p, i) in chest.pricesByQty"
                    :key="i"
                    class="chest-qty__opt"
                    :class="{ 'chest-qty__opt--on': selectedQtyIdx === i }"
                    @click="selectQty(i)"
                  >
                    {{ p.qty }}
                  </button>
                </div>

                <!-- Set-bonus card — magenta→blue gradient with the
                     reward map preview + progress chip. -->
                <div v-if="setBonusMap" class="chest-section">
                  <h3 class="chest-section__title">{{ L.collectAll }}</h3>
                  <div class="chest-bonus">
                    <div class="chest-bonus__icon">
                      <CosmeticsMaps
                        :type="setBonusMap.type"
                        :rarity="setBonusMap.rarity"
                        :size="44"
                      />
                    </div>
                    <div class="chest-bonus__text">
                      <div class="chest-bonus__name">{{ pickName(setBonusMap.name) }}</div>
                      <div class="chest-bonus__tags">
                        <span class="chest-tag chest-tag--white">{{ L.tagMap }}</span>
                        <span
                          class="chest-tag"
                          :style="{ background: rarityBadge(setBonusMap.rarity) }"
                        >
                          {{ rarityLabelFor(setBonusMap.rarity) }}
                        </span>
                      </div>
                    </div>
                    <span class="chest-bonus__chip">
                      {{ setProgress.owned }}/{{ setProgress.total }}
                    </span>
                  </div>
                </div>

                <!-- Items list with drop chances -->
                <div class="chest-section">
                  <h3 class="chest-section__title">{{ L.itemsInside }}</h3>
                  <div class="chest-items">
                    <div
                      v-for="item in chest.items"
                      :key="item.capId"
                      class="chest-item"
                    >
                      <div class="chest-item__icon">
                        <CosmeticsCaps
                          :type="capTypeForId(item.capId)"
                          :rarity="capRarityFor(item.capId)"
                          :size="44"
                        />
                      </div>
                      <div class="chest-item__text">
                        <div class="chest-item__name">{{ capNameFor(item.capId) }}</div>
                        <div class="chest-item__tags">
                          <span class="chest-tag chest-tag--white">{{ L.tagCap }}</span>
                          <span
                            class="chest-tag"
                            :style="{ background: rarityBadge(capRarityFor(item.capId)) }"
                          >
                            {{ rarityLabelFor(capRarityFor(item.capId)) }}
                          </span>
                        </div>
                      </div>
                      <span
                        class="chest-item__chip"
                        :class="{ 'chest-item__chip--owned': isOwned(item.capId) }"
                      >
                        {{ isOwned(item.capId) ? L.owned : `${item.chance}%` }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- ─── RESULT mode ─── -->
              <template v-else-if="mode === 'result'">
                <div
                  class="chest-rewards"
                  :class="{ 'chest-rewards--single': revealedItems.length === 1 }"
                >
                  <article
                    v-for="(capId, i) in revealedItems"
                    :key="i"
                    class="chest-reward"
                  >
                    <div class="chest-reward__preview">
                      <CosmeticsCaps
                        :type="capTypeForId(capId)"
                        :rarity="capRarityFor(capId)"
                        :size="72"
                      />
                    </div>
                    <span
                      class="chest-rarity chest-reward__rarity"
                      :style="{ background: rarityBadge(capRarityFor(capId)) }"
                    >
                      {{ rarityLabelFor(capRarityFor(capId)) }}
                    </span>
                    <div class="chest-reward__name">{{ capNameFor(capId) }}</div>
                    <button
                      class="chest-reward__btn"
                      :disabled="isCapEquipped(capId)"
                      :class="{ 'chest-reward__btn--equipped': isCapEquipped(capId) }"
                      @click="onEquipReward(capId)"
                    >
                      {{ isCapEquipped(capId) ? L.equipped : L.equip }}
                    </button>
                  </article>
                </div>

                <!-- Qty selector for the next purchase -->
                <div v-if="chest.pricesByQty && chest.pricesByQty.length > 1" class="chest-qty">
                  <button
                    v-for="(p, i) in chest.pricesByQty"
                    :key="i"
                    class="chest-qty__opt"
                    :class="{ 'chest-qty__opt--on': selectedQtyIdx === i }"
                    @click="selectQty(i)"
                  >
                    {{ p.qty }}
                  </button>
                </div>
              </template>

              <!-- "opening" body intentionally empty — hero + title carry the state -->
            </div>

            <!-- ─── Sticky bottom CTA (hidden during opening animation) ─── -->
            <button
              v-if="mode !== 'opening'"
              class="chest-cta"
              :disabled="purchasing"
              @click="onBuy"
            >
              <span class="chest-cta__text">
                {{ mode === "result" ? L.openMore : L.buy }}
              </span>
              <span class="chest-cta__price">
                <Icon name="star" :size="20" color="#fff" />
                <span>{{ currentPrice.stars }}</span>
              </span>
            </button>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.chest-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  padding-bottom: calc(24px + var(--tg-safe-area-inset-bottom, 0px));
  z-index: 200;
}

.chest-modal {
  position: relative;
  width: 100%;
  max-width: 345px;
  max-height: 100%;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 0 16px 88px;       /* 88 leaves room for the sticky CTA */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #fff;
  font-family: 'Golos Text', var(--font-body);
}

/* Single scroll surface — hero+title+body all scroll together so a tall items
   list can't push the CTA off the bottom. */
.chest-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 16px;
}
.chest-body::-webkit-scrollbar { width: 4px; }
.chest-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
}

/* ─── Close button (top-right of hero) ─── */
.chest-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  z-index: 5;
  transition: transform 120ms ease;
}
.chest-close:active { transform: scale(0.92); }
.chest-close:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Hero (chest illustration + radial halo) ─── */
.chest-hero {
  position: relative;
  height: 192px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 -16px;
  overflow: hidden;
}
.chest-hero__glow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
/* Outer red exotic halo — matches RarityGlow.vue's exotic colors. */
.chest-hero__glow--bg {
  width: 280px;
  height: 280px;
  background: radial-gradient(
    circle,
    rgba(219, 53, 53, 0.42) 0%,
    rgba(219, 53, 53, 0.18) 30%,
    transparent 60%
  );
  filter: blur(16px);
}
.chest-hero__glow--fg {
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(255, 200, 80, 0.55), transparent 70%);
  filter: blur(8px);
}
.chest-hero__art {
  position: relative;
  width: 152px;
  height: 152px;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.45));
  transition: transform 360ms ease;
}
.chest-hero__art--open {
  width: 240px;
  height: 240px;
  transform: translateY(-12px);
}
.chest-modal--opening .chest-hero__art {
  animation: chest-shake 0.3s ease-in-out infinite;
}
@keyframes chest-shake {
  0%, 100% { transform: rotate(-3deg); }
  50%      { transform: rotate(3deg); }
}

/* ─── Title block ─── */
.chest-titleblock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 0 0;
}
.chest-rarity {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 12px;
  color: #fff;
  white-space: nowrap;
  box-shadow:
    inset 0 -1px 2px rgba(255, 255, 255, 0.16),
    inset 0 2px 2px rgba(255, 255, 255, 0.16);
}
.chest-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 600;
  font-size: 28px;
  line-height: 30px;
  color: #fff;
  text-align: center;
}
.chest-subtitle {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 18px;
  color: #fff;
  text-align: center;
  padding: 0 8px;
}

/* ─── Qty selector ─── */
.chest-qty {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  flex-shrink: 0;
}
.chest-qty__opt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: transparent;
  border: none;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.chest-qty__opt--on {
  background: #fff;
  color: #000;
}

/* ─── Section headings ─── */
.chest-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chest-section__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 600;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-align: center;
}

/* ─── Set-bonus card (magenta→blue gradient) ─── */
.chest-bonus {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 18px;
  background: linear-gradient(226deg, #9126af 0%, #3a53d1 100%);
}
.chest-bonus__icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.chest-bonus__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chest-bonus__name {
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chest-bonus__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.chest-bonus__chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  background: #fff;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  color: #000;
  white-space: nowrap;
}

/* ─── Tags shared by bonus card + items ─── */
.chest-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  color: #fff;
  white-space: nowrap;
}
.chest-tag--white {
  background: #fff;
  color: #000;
}

/* ─── Items list ─── */
.chest-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chest-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #2b2a34;
  border-radius: 18px;
}
.chest-item__icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.chest-item__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chest-item__name {
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chest-item__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.chest-item__chip {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  white-space: nowrap;
}
.chest-item__chip--owned {
  background: #fff;
  color: #000;
}

/* ─── Result mode: revealed cap cards (1 centered, multiple in 2-col grid) ─── */
.chest-rewards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.chest-rewards--single {
  display: flex;
  justify-content: center;
}
.chest-reward {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
}
.chest-rewards--single .chest-reward {
  width: 140px;
}
.chest-reward__preview {
  width: 100%;
  height: 76px;
  background: #000;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.chest-reward__rarity {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 500;
  padding: 3px 8px;
}
.chest-reward__name {
  align-self: flex-start;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.chest-reward__btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  background: #56e63e;
  border: none;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 16px;
  color: #000;
  cursor: pointer;
  margin-top: auto;
}
.chest-reward__btn:active { filter: brightness(0.95); transform: translateY(1px); }
.chest-reward__btn--equipped {
  background: rgba(0, 0, 0, 0.2);
  color: rgba(0, 0, 0, 0.6);
  cursor: default;
}

/* ─── Sticky bottom CTA (КУПИТЬ / ОТКРЫТЬ ЕЩЁ) ─── */
.chest-cta {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  height: 56px;
  border-radius: 18px;
  border: 2px solid #000;
  background: linear-gradient(to left, #e069d0 0%, #718fff 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.2);
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1.4px 1.4px 0 rgba(0, 0, 0, 0.6);
  transition: transform 120ms ease, filter 120ms ease;
}
.chest-cta:disabled { opacity: 0.7; cursor: wait; }
.chest-cta:not(:disabled):active {
  transform: translateY(2px);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}
.chest-cta__text {
  letter-spacing: 0.01em;
}
.chest-cta__price {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ─── Transitions ─── */
.chest-fade-enter-active, .chest-fade-leave-active {
  transition: opacity 220ms ease;
}
.chest-fade-enter-from, .chest-fade-leave-to { opacity: 0; }

.chest-pop-enter-active {
  transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease;
}
.chest-pop-leave-active {
  transition: transform 200ms ease, opacity 200ms ease;
}
.chest-pop-enter-from {
  transform: scale(0.92);
  opacity: 0;
}
.chest-pop-leave-to {
  transform: scale(0.96);
  opacity: 0;
}
</style>
