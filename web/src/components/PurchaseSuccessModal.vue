<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";
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
  title: "Сделка заключена!",
  sub: "Ваше приобретение добавлено в казну.",
  ok: "Отлично",
  equip: "Экипировать",
  spent: "Потрачено",
  balance: "Остаток",
  kindLabels: { token: "Фишка", map: "Карта", banner: "Знамя", dice: "Кости", theme: "Цвет" } as Record<string, string>,
} : {
  title: "Purchase complete",
  sub: "Your acquisition has joined the treasury.",
  ok: "Splendid",
  equip: "Equip",
  spent: "Spent",
  balance: "Balance",
  kindLabels: { token: "Token", map: "Map", banner: "Banner", dice: "Dice", theme: "House" } as Record<string, string>,
});

const confetti = (() => {
  const arr: { i: number; x: number; delay: number; size: number; color: string }[] = [];
  const colors = ["#d4a84a", "#f5d98a", "#f7eeda", "#b8892e"];
  for (let i = 0; i < 12; i++) {
    arr.push({
      i,
      x: (i * 31) % 100,
      delay: (i * 80) % 900,
      size: 3 + (i % 3),
      color: colors[i % colors.length],
    });
  }
  return arr;
})();

const mapBoard = computed(() => item.value.kind === "map" ? findBoard(item.value.id) : null);
const tokenArtId = computed<TokenArtId>(() => tokenArtFor(item.value.id ?? "dragon"));
const kindLabel = computed(() => L.value.kindLabels[item.value.kind ?? "token"] ?? "");
const itemUnit = computed(() => item.value.unit ?? "◈");
const priceText = computed(() => `${item.value.price} ${itemUnit.value}`);
const itemDisplayName = computed(() => isRu.value && item.value.ru ? item.value.ru : item.value.name);
</script>

<template>
  <transition name="ps-fade">
    <div v-if="open" class="ps-backdrop" @click="onClose">
      <div class="ps-modal" @click.stop>
        <div class="ps-head">
          <div v-for="c in confetti" :key="c.i" class="ps-confetti" :style="{
            left: c.x + '%',
            width: c.size + 'px', height: c.size + 'px',
            background: c.color,
            animationDelay: c.delay + 'ms',
          }"/>

          <div class="ps-star">
            <svg viewBox="0 0 40 40" width="42" height="42">
              <path d="M 20 4 L 23 16 L 36 20 L 23 24 L 20 36 L 17 24 L 4 20 L 17 16 Z" fill="#2a1d10" opacity="0.85"/>
              <path d="M 20 9 L 22 17 L 30 20 L 22 23 L 20 31 L 18 23 L 10 20 L 18 17 Z" fill="#fffef0" opacity="0.95"/>
            </svg>
          </div>

          <div class="ps-title">{{ L.title }}</div>
          <div class="ps-sub">{{ L.sub }}</div>
        </div>

        <div class="ps-body">
          <div class="row" style="gap: 14px; margin-bottom: 14px;">
            <div class="ps-preview">
              <TokenArt v-if="item.kind === 'token'" :id="tokenArtId" :size="40" color="#fff" shadow="rgba(0,0,0,0.55)"/>
              <div v-else-if="mapBoard" style="border-radius: 6px; overflow: hidden; line-height: 0;">
                <BoardPreview :board="mapBoard" :size="48"/>
              </div>
              <div v-else class="ps-preview__generic">◈</div>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div class="ps-kind">{{ kindLabel }}</div>
              <div class="ps-name">{{ itemDisplayName }}</div>
              <div class="ps-price-chip">
                <Icon :name="itemUnit === '★' ? 'star' : 'coin'" :size="10" color="var(--gold)"/>
                {{ priceText }}
              </div>
            </div>
          </div>

          <div class="ps-spent-row">
            <div>
              <div class="ps-cap">{{ L.spent }}</div>
              <div class="ps-spent-val">− {{ priceText }}</div>
            </div>
            <div style="text-align: right;">
              <div class="ps-cap">{{ L.balance }}</div>
              <div class="ps-balance-val">{{ item.balanceAfter ?? "—" }}</div>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost" style="flex: 1;" @click="onClose">{{ L.ok }}</button>
            <button v-if="onEquip" class="btn btn-primary ps-equip" style="flex: 2;" @click="onEquip">
              <Icon name="check" :size="16" color="#2a1d10"/>
              {{ L.equip }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.ps-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ps-modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  margin: 16px;
  background: var(--bg);
  border-radius: 16px;
  border: 1px solid var(--gold);
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35), 0 0 40px rgba(212, 168, 74, 0.25);
  animation: ps-pop 420ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes ps-pop {
  0% { transform: scale(0.85); opacity: 0; }
  60% { transform: scale(1.02); opacity: 1; }
  100% { transform: scale(1); }
}

.ps-head {
  position: relative;
  background:
    radial-gradient(ellipse at 50% 130%, rgba(212, 168, 74, 0.45) 0%, transparent 60%),
    linear-gradient(180deg, #2d1a5a 0%, #1a0e3a 100%);
  padding: 24px 20px 18px;
  color: #f7eeda;
  text-align: center;
  overflow: hidden;
}
.ps-confetti {
  position: absolute;
  top: -10px;
  border-radius: 50%;
  opacity: 0.8;
  animation: ps-confetti 2.2s ease-out infinite;
}
@keyframes ps-confetti {
  0% { transform: translateY(0) rotate(0); opacity: 0; }
  10% { opacity: 0.9; }
  100% { transform: translateY(140px) rotate(360deg); opacity: 0; }
}
.ps-star {
  width: 72px; height: 72px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f5d98a 0%, #d4a84a 60%, #8b6914 100%);
  box-shadow:
    0 0 0 3px rgba(247, 238, 218, 0.15),
    0 8px 20px rgba(0, 0, 0, 0.4),
    inset 0 2px 3px rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ps-title {
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 0.02em;
  color: #f7eeda;
  margin-bottom: 4px;
}
.ps-sub {
  font-size: 12px;
  color: #c9b88e;
  line-height: 1.4;
  max-width: 260px;
  margin: 0 auto;
}

.ps-body { padding: 18px 20px 14px; }
.ps-preview {
  width: 64px; height: 64px;
  border-radius: 10px;
  background: radial-gradient(circle at 32% 28%, #f5d98a, #d4a84a 55%, #8b6914);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.4);
  border: 2px solid #fff;
  flex-shrink: 0;
}
.ps-preview__generic {
  font-size: 24px;
  color: #2a1d10;
  font-family: var(--font-display);
}
.ps-kind {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
}
.ps-name {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--ink);
  line-height: 1.15;
  margin-top: 2px;
}
.ps-price-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 8px;
  background: rgba(212, 168, 74, 0.12);
  border: 1px solid rgba(212, 168, 74, 0.4);
  border-radius: 999px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--gold);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.ps-spent-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--divider);
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 14px;
}
.ps-cap {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ps-spent-val {
  color: var(--accent);
  font-family: var(--font-mono);
  font-weight: 700;
  margin-top: 2px;
}
.ps-balance-val {
  color: var(--ink);
  font-family: var(--font-mono);
  font-weight: 700;
  margin-top: 2px;
}
.ps-equip {
  background: linear-gradient(180deg, #d4a84a 0%, #b8892e 100%);
  color: #2a1d10;
}

.ps-fade-enter-active, .ps-fade-leave-active { transition: opacity 220ms ease; }
.ps-fade-enter-from, .ps-fade-leave-to { opacity: 0; }
</style>
