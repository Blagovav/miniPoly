<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";

export interface PurchaseFailData {
  name: string;
  ru?: string;
  price: number;
  unit?: "★" | "◈";
  balance?: number;
  reason?: "funds" | "sold-out" | "generic";
}

const props = defineProps<{
  open: boolean;
  data: PurchaseFailData | null;
  onClose: () => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

const item = computed<PurchaseFailData>(() => props.data ?? {
  name: "Item", price: 0, unit: "◈", balance: 0, reason: "funds",
});
const reason = computed(() => item.value.reason ?? "funds");
const unit = computed(() => item.value.unit ?? "◈");
const shortBy = computed(() => reason.value === "funds" ? Math.max(0, item.value.price - (item.value.balance ?? 0)) : 0);

const L = computed(() => {
  const r = reason.value;
  return isRu.value ? {
    title: r === "funds" ? "Казна пуста" : r === "sold-out" ? "Распродано" : "Сделка отклонена",
    sub: r === "funds"
      ? "Недостаточно средств в вашей казне."
      : r === "sold-out"
        ? "Этого товара больше нет у торговца."
        : "Казначей не смог провести сделку.",
    need: "Требуется",
    have: "В казне",
    short: "Не хватает",
    cancel: "Отмена",
    topup: "Пополнить казну",
    browse: "К другим товарам",
    retry: "Повторить",
    hint: r === "funds"
      ? "Пополните казну монетами или звёздами ярмарки."
      : "Вернитесь позже — или попробуйте другой товар.",
  } : {
    title: r === "funds" ? "Empty coffers" : r === "sold-out" ? "Sold out" : "Transaction declined",
    sub: r === "funds"
      ? "Your treasury lacks the necessary coin."
      : r === "sold-out"
        ? "The merchant has none left to sell."
        : "The royal accountant could not complete this transaction.",
    need: "Needed",
    have: "You have",
    short: "Short by",
    cancel: "Cancel",
    topup: "Top up coffers",
    browse: "Browse other wares",
    retry: "Try again",
    hint: r === "funds"
      ? "Top up with bazaar coin or royal stars."
      : "Come back later — or try another ware.",
  };
});
</script>

<template>
  <transition name="pf-fade">
    <div v-if="open" class="pf-backdrop" @click="onClose">
      <div class="pf-modal" @click.stop>
        <div class="pf-head">
          <div class="pf-coin">
            <svg viewBox="0 0 72 72" width="72" height="72">
              <defs>
                <linearGradient id="pfBrokenCoin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#8a7152"/>
                  <stop offset="1" stop-color="#4a3a28"/>
                </linearGradient>
              </defs>
              <path d="M 36 10 A 26 26 0 0 0 24 58 L 32 34 Z" fill="url(#pfBrokenCoin)" stroke="#2a1d10" stroke-width="1.5"/>
              <g transform="translate(4, 1) rotate(6 36 36)">
                <path d="M 36 10 A 26 26 0 0 1 48 58 L 40 34 Z" fill="url(#pfBrokenCoin)" stroke="#2a1d10" stroke-width="1.5"/>
              </g>
              <path d="M 36 10 L 34 22 L 38 30 L 32 40 L 36 58"
                stroke="#1a110a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <div class="pf-title">{{ L.title }}</div>
          <div class="pf-sub">{{ L.sub }}</div>
        </div>

        <div class="pf-body">
          <div v-if="reason === 'funds'" class="pf-cards">
            <div class="pf-card">
              <div class="pf-cap">{{ L.need }}</div>
              <div class="pf-card__val" style="color: var(--ink);">{{ item.price }} {{ unit }}</div>
            </div>
            <div class="pf-card">
              <div class="pf-cap">{{ L.have }}</div>
              <div class="pf-card__val" style="color: var(--ink-2);">{{ item.balance ?? 0 }} {{ unit }}</div>
            </div>
            <div class="pf-card">
              <div class="pf-cap">{{ L.short }}</div>
              <div class="pf-card__val" style="color: var(--accent);">{{ shortBy }} {{ unit }}</div>
            </div>
          </div>

          <div class="pf-hint">{{ L.hint }}</div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost" style="flex: 1;" @click="onClose">{{ L.cancel }}</button>
            <button class="btn btn-primary" style="flex: 2;" @click="onClose">
              <template v-if="reason === 'funds'">
                <Icon :name="unit === '★' ? 'star' : 'coin'" :size="16" color="#fff"/>
                {{ L.topup }}
              </template>
              <template v-else-if="reason === 'sold-out'">{{ L.browse }}</template>
              <template v-else>{{ L.retry }}</template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.pf-backdrop {
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
.pf-modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  margin: 16px;
  background: var(--bg);
  border-radius: 16px;
  border: 1px solid var(--accent);
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  animation: pf-shake 420ms ease-out;
}
@keyframes pf-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}

.pf-head {
  position: relative;
  background:
    radial-gradient(ellipse at 50% 130%, rgba(154, 28, 58, 0.25) 0%, transparent 60%),
    linear-gradient(180deg, #3a1218 0%, #1a0810 100%);
  padding: 24px 20px 18px;
  color: #f7eeda;
  text-align: center;
}
.pf-coin {
  width: 72px; height: 72px;
  margin: 0 auto 12px;
}
.pf-title {
  font-family: var(--font-display);
  font-size: 22px;
  color: #f7eeda;
  margin-bottom: 4px;
}
.pf-sub {
  font-size: 12px;
  color: #c9b88e;
  line-height: 1.4;
  max-width: 260px;
  margin: 0 auto;
}

.pf-body { padding: 16px 20px 14px; }
.pf-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.pf-card {
  padding: 8px 6px;
  background: var(--card);
  border: 1px solid var(--divider);
  border-radius: 8px;
  text-align: center;
}
.pf-cap {
  font-size: 9px;
  color: var(--ink-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pf-card__val {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}
.pf-hint {
  font-size: 11px;
  color: var(--ink-3);
  text-align: center;
  line-height: 1.4;
  padding: 0 8px 12px;
}

.pf-fade-enter-active, .pf-fade-leave-active { transition: opacity 220ms ease; }
.pf-fade-enter-from, .pf-fade-leave-to { opacity: 0; }
</style>
