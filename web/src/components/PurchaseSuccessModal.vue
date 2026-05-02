<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import TokenArt, { type TokenArtId } from "./TokenArt.vue";
import { tokenArtFor } from "../utils/palette";
import BoardPreview from "./BoardPreview.vue";
import { findBoard } from "../utils/boards";

export interface PurchaseData {
  id?: string;
  name: string;
  ru?: string;
  price: number;
  unit?: "★" | "◈";
  kind?: "token" | "map" | "banner" | "dice" | "theme";
  spentSummary?: string;
  balanceAfter?: string;
}

const props = defineProps<{
  open: boolean;
  data: PurchaseData | null;
  onClose: () => void;
  onEquip?: () => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

const item = computed<PurchaseData>(() => props.data ?? {
  name: "Item", price: 0, kind: "token", unit: "◈",
});

const L = computed(() => isRu.value ? {
  eyebrow: "Покупка",
  title: "Покупка прошла!",
  sub: "Товар добавлен в инвентарь.",
  ok: "Отлично",
  equip: "Надеть",
  spent: "Потрачено",
  balance: "Остаток",
  closeAria: "Закрыть",
  kindLabels: {
    token: "Фишка", map: "Карта", banner: "Знамя", dice: "Кости", theme: "Цвет",
  } as Record<string, string>,
} : {
  eyebrow: "Purchase",
  title: "Purchase complete",
  sub: "Item added to your inventory.",
  ok: "Nice",
  equip: "Equip",
  spent: "Spent",
  balance: "Balance",
  closeAria: "Close",
  kindLabels: {
    token: "Token", map: "Map", banner: "Banner", dice: "Dice", theme: "House",
  } as Record<string, string>,
});

const mapBoard = computed(() => item.value.kind === "map" ? findBoard(item.value.id) : null);
const tokenArtId = computed<TokenArtId>(() => tokenArtFor(item.value.id ?? "dragon"));
const kindLabel = computed(() => L.value.kindLabels[item.value.kind ?? "token"] ?? "");
const itemUnit = computed(() => item.value.unit ?? "◈");
const priceText = computed(() => `${item.value.price} ${itemUnit.value}`);
const itemDisplayName = computed(() => isRu.value && item.value.ru ? item.value.ru : item.value.name);
</script>

<template>
  <transition name="ps-fade">
    <div v-if="open" class="ps-scrim" @click.self="onClose">
      <div class="ps-stack">
        <div class="ps-card">
          <span class="ps-eyebrow">{{ L.eyebrow }}</span>
          <h2 class="ps-title">{{ L.title }}</h2>
          <p class="ps-sub">{{ L.sub }}</p>

          <!-- Item row: preview + kind/name/price -->
          <div class="ps-item">
            <div class="ps-preview">
              <TokenArt
                v-if="item.kind === 'token'"
                :id="tokenArtId"
                :size="40"
                color="#fff"
                shadow="rgba(0,0,0,0.55)"
              />
              <div v-else-if="mapBoard" class="ps-preview__board">
                <BoardPreview :board="mapBoard" :size="48"/>
              </div>
              <div v-else class="ps-preview__generic">◈</div>
            </div>
            <div class="ps-item__body">
              <div class="ps-kind">{{ kindLabel }}</div>
              <div class="ps-name">{{ itemDisplayName }}</div>
              <div class="ps-price-chip">{{ priceText }}</div>
            </div>
          </div>

          <!-- Spent / balance summary -->
          <div class="ps-totals">
            <div class="ps-totals__col">
              <div class="ps-totals__cap">{{ L.spent }}</div>
              <div class="ps-totals__val ps-totals__val--spent">−{{ priceText }}</div>
            </div>
            <div class="ps-totals__col ps-totals__col--right">
              <div class="ps-totals__cap">{{ L.balance }}</div>
              <div class="ps-totals__val">{{ item.balanceAfter ?? "—" }}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="ps-actions">
            <button type="button" class="ps-btn ps-btn--ghost" @click="onClose">
              {{ L.ok }}
            </button>
            <button
              v-if="onEquip"
              type="button"
              class="ps-btn ps-btn--primary"
              @click="onEquip"
            >{{ L.equip }}</button>
          </div>
        </div>

        <button type="button" class="ps-close" :aria-label="L.closeAria" @click="onClose">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="#000"
              stroke-width="2.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.ps-scrim {
  position: fixed;
  inset: 0;
  z-index: 700;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.ps-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 345px;
}

.ps-card {
  width: 100%;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  color: #000;
}

/* Green eyebrow pill — success accent */
.ps-eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #43c22d;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.5);
  letter-spacing: 0.02em;
}

.ps-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 26px;
  color: #000;
}
.ps-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.65);
  max-width: 260px;
}

/* Item row */
.ps-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  text-align: left;
}
.ps-preview {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16),
              inset 0 1px 2px rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}
.ps-preview__board {
  border-radius: 8px;
  overflow: hidden;
  line-height: 0;
}
.ps-preview__generic {
  font-family: 'Unbounded', sans-serif;
  font-size: 24px;
  font-weight: 900;
  color: #2a1d10;
}
.ps-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ps-kind {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  color: rgba(0, 0, 0, 0.55);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ps-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ps-price-chip {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 11px;
  line-height: 14px;
  color: rgba(0, 0, 0, 0.7);
}

/* Spent / balance */
.ps-totals {
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}
.ps-totals__col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}
.ps-totals__col--right { text-align: right; align-items: flex-end; }
.ps-totals__cap {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  color: rgba(0, 0, 0, 0.55);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.ps-totals__val {
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 16px;
  line-height: 18px;
  color: #000;
}
.ps-totals__val--spent { color: #e2776e; }

/* Actions */
.ps-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}
.ps-btn {
  flex: 1;
  height: 48px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 16px;
  line-height: 18px;
  cursor: pointer;
  transition: transform 80ms ease, box-shadow 80ms ease;
}
.ps-btn--ghost {
  background: #fff;
  color: #000;
}
.ps-btn--ghost:active { transform: translateY(1px); }
.ps-btn--primary {
  background: #43c22d;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  flex: 2;
}
.ps-btn--primary:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}

/* Standalone close FAB */
.ps-close {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 4px solid #000;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 80ms ease;
}
.ps-close:active { transform: scale(0.94); }

/* Transitions */
.ps-fade-enter-active,
.ps-fade-leave-active { transition: opacity 0.22s ease; }
.ps-fade-enter-from,
.ps-fade-leave-to { opacity: 0; }
.ps-fade-enter-active .ps-stack,
.ps-fade-leave-active .ps-stack {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ps-fade-enter-from .ps-stack,
.ps-fade-leave-to .ps-stack { transform: scale(0.94); }
</style>
