<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

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
const shortBy = computed(() =>
  reason.value === "funds" ? Math.max(0, item.value.price - (item.value.balance ?? 0)) : 0,
);

const L = computed(() => {
  const r = reason.value;
  return isRu.value ? {
    eyebrow: r === "funds" ? "Не хватает монет" : r === "sold-out" ? "Распродано" : "Сделка отклонена",
    title: r === "funds"
      ? "Казна пуста"
      : r === "sold-out"
        ? "Товар закончился"
        : "Не получилось",
    sub: r === "funds"
      ? "Не хватает монет на счёте."
      : r === "sold-out"
        ? "Этот товар больше недоступен."
        : "Покупка не прошла.",
    need: "Нужно",
    have: "Есть",
    short: "Не хватает",
    cancel: "Отмена",
    topup: "Пополнить",
    browse: "К другим товарам",
    retry: "Повторить",
    closeAria: "Закрыть",
  } : {
    eyebrow: r === "funds" ? "Insufficient balance" : r === "sold-out" ? "Sold out" : "Declined",
    title: r === "funds" ? "Not enough coins" : r === "sold-out" ? "Sold out" : "Couldn't purchase",
    sub: r === "funds"
      ? "Your balance is too low."
      : r === "sold-out"
        ? "This item is no longer available."
        : "We couldn't complete the purchase.",
    need: "Needed",
    have: "You have",
    short: "Short by",
    cancel: "Cancel",
    topup: "Top up",
    browse: "Other items",
    retry: "Try again",
    closeAria: "Close",
  };
});

const ctaLabel = computed(() => {
  if (reason.value === "funds") return L.value.topup;
  if (reason.value === "sold-out") return L.value.browse;
  return L.value.retry;
});
</script>

<template>
  <transition name="pf-fade">
    <div v-if="open" class="pf-scrim" @click.self="onClose">
      <div class="pf-stack">
        <div class="pf-card">
          <span class="pf-eyebrow">{{ L.eyebrow }}</span>
          <h2 class="pf-title">{{ L.title }}</h2>
          <p class="pf-sub">{{ L.sub }}</p>

          <div v-if="reason === 'funds'" class="pf-stats">
            <div class="pf-stat">
              <div class="pf-stat__label">{{ L.need }}</div>
              <div class="pf-stat__val">{{ item.price }} {{ unit }}</div>
            </div>
            <div class="pf-stat">
              <div class="pf-stat__label">{{ L.have }}</div>
              <div class="pf-stat__val pf-stat__val--muted">{{ item.balance ?? 0 }} {{ unit }}</div>
            </div>
            <div class="pf-stat">
              <div class="pf-stat__label">{{ L.short }}</div>
              <div class="pf-stat__val pf-stat__val--accent">{{ shortBy }} {{ unit }}</div>
            </div>
          </div>

          <div class="pf-actions">
            <button type="button" class="pf-btn pf-btn--ghost" @click="onClose">
              {{ L.cancel }}
            </button>
            <button type="button" class="pf-btn pf-btn--primary" @click="onClose">
              {{ ctaLabel }}
            </button>
          </div>
        </div>

        <button type="button" class="pf-close" :aria-label="L.closeAria" @click="onClose">
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
.pf-scrim {
  position: fixed;
  inset: 0;
  z-index: 700;
  background: rgba(0, 0, 0, 0.4);
  /* Designer feedback 2026-05-02 #5.18 — purchase-fail docks 76px from
     bottom so the board stays visible. */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 24px;
  padding-bottom: calc(76px + var(--sab, 0px) + var(--csab, 0px));
}

.pf-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 345px;
}

/* ── Card — parchment popup body */
.pf-card {
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

/* Coral eyebrow pill — same family as the trade-modal "Отправка гонца"
   tag but coloured red to flag the failure. */
.pf-eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #e2776e;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.02em;
}

.pf-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 26px;
  color: #000;
}
.pf-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.65);
  max-width: 260px;
}

/* ── Stats grid (only for "funds" reason) */
.pf-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  width: 100%;
}
.pf-stat {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pf-stat__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  color: rgba(0, 0, 0, 0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pf-stat__val {
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 16px;
  line-height: 18px;
  color: #000;
}
.pf-stat__val--muted { color: rgba(0, 0, 0, 0.55); }
.pf-stat__val--accent { color: #e2776e; }

/* ── Actions */
.pf-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}
.pf-btn {
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
.pf-btn--ghost {
  background: #fff;
  color: #000;
}
.pf-btn--ghost:active { transform: translateY(1px); }
.pf-btn--primary {
  background: #43c22d;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  flex: 2;
}
.pf-btn--primary:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}

/* ── Standalone close FAB */
.pf-close {
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
.pf-close:active { transform: scale(0.94); }

/* ── Transitions */
.pf-fade-enter-active,
.pf-fade-leave-active { transition: opacity 0.22s ease; }
.pf-fade-enter-from,
.pf-fade-leave-to { opacity: 0; }
.pf-fade-enter-active .pf-stack,
.pf-fade-leave-active .pf-stack {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pf-fade-enter-from .pf-stack,
.pf-fade-leave-to .pf-stack { transform: scale(0.94); }
</style>
