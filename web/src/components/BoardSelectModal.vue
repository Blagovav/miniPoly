<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "./Icon.vue";
import BoardPreview from "./BoardPreview.vue";
import { BOARDS, RARITY_META, findBoard, type BoardDef } from "../utils/boards";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";

const props = defineProps<{
  open: boolean;
  selectedId: string;
  isHost?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
const inv = useInventoryStore();
const { haptic, notify, tg, userId } = useTelegram();

const pick = ref(props.selectedId || "eldmark");
watch(() => props.selectedId, (id) => { pick.value = id || "eldmark"; });
watch(() => props.open, (o) => { if (o) pick.value = props.selectedId || "eldmark"; });

const picked = computed(() => findBoard(pick.value));
const L = computed(() => isRu.value ? {
  title: "Выбор карты", sub: "Поле, на котором будет партия",
  apply: "Применить", close: "Закрыть",
  hostOnly: "Только хост может выбрать карту",
  price: "Купить", active: "Текущая",
  buyFail: "Не хватает монет",
  buyOk: "Карта открыта!",
} : {
  title: "Choose a Map", sub: "The board this match will play on",
  apply: "Apply", close: "Close",
  hostOnly: "Only the host can choose the map",
  price: "Buy", active: "Active",
  buyFail: "Not enough coins",
  buyOk: "Map unlocked!",
});

// Board считается owned если:
//   — он free,
//   — либо помечен static `owned: true` (дефолтные карты),
//   — либо куплен и лежит в inventory (`board-<id>`).
function isOwned(b: BoardDef): boolean {
  if (b.rarity === "free") return true;
  if (b.owned === true) return true;
  return inv.owned.has(`board-${b.id}`);
}

function setPick(id: string) {
  if (props.isHost !== false) pick.value = id;
}
function applyPick() {
  props.onSelect(pick.value);
  props.onClose();
}

// Покупка: монеты — локально, звёзды — через bot invoice.
async function buyBoard(b: BoardDef) {
  if (isOwned(b)) return;
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
  const ok = inv.buy(`board-${b.id}`, b.price);
  if (ok) {
    haptic("medium");
    notify("success");
  } else {
    haptic("light");
    notify("warning");
  }
}

function metaOf(id: string) {
  return RARITY_META[findBoard(id).rarity];
}
function metaLabel(id: string) {
  const m = metaOf(id);
  return isRu.value ? m.ru : m.en;
}
function boardLabel(id: string) {
  const b = findBoard(id);
  return isRu.value ? b.ru : b.name;
}
function boardDesc(id: string) {
  const b = findBoard(id);
  return isRu.value ? b.desc.ru : b.desc.en;
}
</script>

<template>
  <transition name="bs-fade">
    <div v-if="open" class="bs-backdrop" @click="onClose">
      <div class="bs-modal" @click.stop>
        <div class="bs-head">
          <div class="row between">
            <div>
              <div class="bs-title">{{ L.title }}</div>
              <div class="bs-sub">{{ L.sub }}</div>
            </div>
            <button class="icon-btn bs-close" @click="onClose">
              <Icon name="x" :size="16"/>
            </button>
          </div>
          <div v-if="isHost === false" class="bs-host-warn">
            <Icon name="lock" :size="12" color="var(--accent)"/>
            {{ L.hostOnly }}
          </div>
        </div>

        <div
          class="bs-spotlight"
          :style="{
            background: picked.palette.bg,
            color: picked.palette.text || '#2a1d10',
          }"
        >
          <div class="row" style="gap: 14px; align-items: flex-start;">
            <div class="bs-spotlight__preview" :style="{ borderColor: picked.palette.gold }">
              <BoardPreview :board="picked" :size="96"/>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div
                class="bs-spotlight__rarity"
                :style="{ color: RARITY_META[picked.rarity].color, opacity: picked.dark ? 0.85 : 0.8 }"
              >
                {{ metaLabel(picked.id) }}
              </div>
              <div class="bs-spotlight__name">{{ boardLabel(picked.id) }}</div>
              <div class="bs-spotlight__desc">{{ boardDesc(picked.id) }}</div>
            </div>
          </div>
        </div>

        <div class="bs-list">
          <div class="bs-grid">
            <button
              v-for="b in BOARDS"
              :key="b.id"
              class="bs-card"
              :class="{ active: b.id === pick }"
              :disabled="isHost === false"
              @click="setPick(b.id)"
            >
              <div
                class="bs-card__preview"
                :style="{
                  borderColor: b.palette.line,
                  filter: isOwned(b) ? 'none' : 'saturate(0.5) brightness(0.95)',
                }"
              >
                <BoardPreview :board="b" :size="120"/>
              </div>
              <div class="bs-card__name">{{ boardLabel(b.id) }}</div>
              <div class="bs-card__rarity" :style="{ color: metaOf(b.id).color }">
                {{ metaLabel(b.id) }}
              </div>

              <div v-if="b.id === pick" class="bs-card__active">{{ L.active }}</div>
              <div v-else-if="isOwned(b)" class="bs-card__owned">
                <Icon name="check" :size="11" color="#fff"/>
              </div>
              <div v-if="!isOwned(b)" class="bs-card__price">
                <Icon :name="b.unit === '★' ? 'star' : 'coin'" :size="10" color="var(--gold)"/>
                {{ b.price }}
              </div>
            </button>
          </div>
        </div>

        <div class="bs-foot">
          <button class="btn btn-ghost" style="flex: 1; padding: 12px;" @click="onClose">
            {{ L.close }}
          </button>
          <button
            v-if="isHost !== false && isOwned(picked)"
            class="btn btn-primary"
            style="flex: 2; padding: 12px;"
            @click="applyPick"
          >
            <Icon name="check" :size="16" color="#fff"/>
            {{ L.apply }}
          </button>
          <button
            v-else-if="isHost !== false"
            class="btn btn-primary bs-buy"
            style="flex: 2; padding: 12px;"
            @click="buyBoard(picked)"
          >
            <Icon :name="picked.unit === '★' ? 'star' : 'coin'" :size="16" color="#2a1d10"/>
            {{ L.price }} · {{ picked.price }}{{ picked.unit === '★' ? ' ★' : ' ◈' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.bs-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 600;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bs-modal {
  background: var(--bg);
  width: 100%;
  max-width: 440px;
  max-height: 92dvh;
  display: flex;
  flex-direction: column;
  border-radius: 16px 16px 0 0;
  border: 1px solid var(--line);
  overflow: hidden;
  animation: sheet-unfurl 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom;
  box-shadow: 0 -8px 24px rgba(42, 29, 16, 0.3);
}
@keyframes sheet-unfurl {
  0% { transform: translateY(100%); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
.bs-head {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--divider);
  background: var(--card);
}
.bs-title {
  font-family: var(--font-display);
  font-size: 19px;
  color: var(--ink);
}
.bs-sub {
  font-size: 11px;
  color: var(--ink-3);
}
.bs-close { width: 32px; height: 32px; }
.bs-host-warn {
  margin-top: 10px;
  padding: 6px 10px;
  background: rgba(154, 28, 58, 0.08);
  border: 1px solid rgba(154, 28, 58, 0.2);
  border-radius: 6px;
  font-size: 11px;
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 6px;
}

.bs-spotlight {
  padding: 14px 20px;
  border-bottom: 1px solid var(--divider);
}
.bs-spotlight__preview {
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--gold);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  line-height: 0;
}
.bs-spotlight__rarity {
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 3px;
  font-weight: 600;
}
.bs-spotlight__name {
  font-family: var(--font-display);
  font-size: 21px;
  line-height: 1.1;
}
.bs-spotlight__desc {
  font-size: 12px;
  opacity: 0.75;
  margin-top: 6px;
  line-height: 1.35;
}

.bs-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}
.bs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.bs-card {
  position: relative;
  padding: 8px;
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  color: var(--ink);
}
.bs-card:disabled { cursor: default; opacity: 0.6; }
.bs-card.active {
  background: rgba(90, 58, 154, 0.08);
  border-color: var(--primary);
}
.bs-card__preview {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--line);
  margin-bottom: 7px;
  line-height: 0;
}
.bs-card__name {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink);
  line-height: 1.15;
  margin-bottom: 2px;
}
.bs-card__rarity {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
}
.bs-card__active {
  position: absolute;
  top: 6px; right: 6px;
  padding: 2px 7px;
  font-size: 9px;
  letter-spacing: 0.1em;
  background: var(--primary);
  color: #fff;
  border-radius: 999px;
  font-weight: 700;
}
.bs-card__owned {
  position: absolute;
  top: 6px; right: 6px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--emerald);
  display: flex;
  align-items: center;
  justify-content: center;
}
.bs-card__price {
  position: absolute;
  top: 6px; right: 6px;
  padding: 3px 7px;
  font-size: 10px;
  background: rgba(42, 29, 16, 0.85);
  color: var(--gold);
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-weight: 600;
}

.bs-foot {
  padding: 14px;
  border-top: 1px solid var(--divider);
  background: var(--card);
  display: flex;
  gap: 8px;
}
.bs-buy {
  background: linear-gradient(180deg, #d4a84a 0%, #b8892e 100%);
  color: #2a1d10;
}

.bs-fade-enter-active, .bs-fade-leave-active { transition: opacity 200ms ease; }
.bs-fade-enter-from, .bs-fade-leave-to { opacity: 0; }
.bs-fade-enter-active .bs-modal,
.bs-fade-leave-active .bs-modal {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bs-fade-leave-to .bs-modal { transform: translateY(20%); }
</style>
