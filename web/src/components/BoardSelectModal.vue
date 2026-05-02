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
  eyebrow: "Выбор поля",
  title: "Карта партии",
  sub: "Поле, на котором будет партия",
  apply: "Применить",
  close: "Закрыть",
  hostOnly: "Только хост может выбрать карту",
  price: "Купить",
  active: "Текущая",
  buyFail: "Не хватает монет",
  buyOk: "Карта открыта!",
  closeAria: "Закрыть",
} : {
  eyebrow: "Map picker",
  title: "Match board",
  sub: "The board this match will play on",
  apply: "Apply",
  close: "Close",
  hostOnly: "Only the host can pick the map",
  price: "Buy",
  active: "Active",
  buyFail: "Not enough coins",
  buyOk: "Map unlocked!",
  closeAria: "Close",
});

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
  const ok = inv.buy(`board-${b.id}`, b.price);
  if (ok) { haptic("medium"); notify("success"); }
  else    { haptic("light");  notify("warning"); }
}

function metaOf(id: string) { return RARITY_META[findBoard(id).rarity]; }
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
    <div v-if="open" class="bs-scrim" @click.self="onClose">
      <div class="bs-stack">
        <div class="bs-card">
          <div class="bs-head">
            <span class="bs-eyebrow">{{ L.eyebrow }}</span>
            <h2 class="bs-title">{{ L.title }}</h2>
            <p class="bs-sub">{{ L.sub }}</p>
          </div>

          <div v-if="isHost === false" class="bs-warn">
            <Icon name="lock" :size="12" color="#8b1a1a"/>
            {{ L.hostOnly }}
          </div>

          <!-- Spotlight: large preview of selected board on a white inner
               card matching the figma popup pattern. -->
          <div class="bs-spotlight">
            <div class="bs-spotlight__preview">
              <BoardPreview :board="picked" :size="96"/>
            </div>
            <div class="bs-spotlight__body">
              <div
                class="bs-spotlight__rarity"
                :style="{ color: metaOf(picked.id).color }"
              >{{ metaLabel(picked.id) }}</div>
              <div class="bs-spotlight__name">{{ boardLabel(picked.id) }}</div>
              <div class="bs-spotlight__desc">{{ boardDesc(picked.id) }}</div>
            </div>
          </div>

          <!-- Grid: 2-column board picker -->
          <div class="bs-grid">
            <button
              v-for="b in BOARDS"
              :key="b.id"
              class="bs-tile"
              :class="{ 'bs-tile--active': b.id === pick }"
              :disabled="isHost === false"
              @click="setPick(b.id)"
            >
              <div
                class="bs-tile__preview"
                :style="{
                  filter: isOwned(b) ? 'none' : 'saturate(0.5) brightness(0.95)',
                }"
              >
                <BoardPreview :board="b" :size="120"/>
              </div>
              <div class="bs-tile__name">{{ boardLabel(b.id) }}</div>
              <div
                class="bs-tile__rarity"
                :style="{ color: metaOf(b.id).color }"
              >{{ metaLabel(b.id) }}</div>

              <span v-if="b.id === pick" class="bs-tile__chip bs-tile__chip--active">{{ L.active }}</span>
              <span v-else-if="isOwned(b)" class="bs-tile__chip bs-tile__chip--owned">
                <Icon name="check" :size="11" color="#fff"/>
              </span>
              <span v-if="!isOwned(b)" class="bs-tile__chip bs-tile__chip--price">
                <Icon :name="b.unit === '★' ? 'star' : 'coin'" :size="10" color="#000"/>
                {{ b.price }}
              </span>
            </button>
          </div>

          <!-- Footer actions -->
          <div class="bs-actions">
            <button type="button" class="bs-btn bs-btn--ghost" @click="onClose">
              {{ L.close }}
            </button>
            <button
              v-if="isHost !== false && isOwned(picked)"
              type="button"
              class="bs-btn bs-btn--primary"
              @click="applyPick"
            >{{ L.apply }}</button>
            <button
              v-else-if="isHost !== false"
              type="button"
              class="bs-btn bs-btn--primary"
              @click="buyBoard(picked)"
            >
              {{ L.price }} · {{ picked.price }}{{ picked.unit === '★' ? ' ★' : ' ◈' }}
            </button>
          </div>
        </div>

        <button type="button" class="bs-close" :aria-label="L.closeAria" @click="onClose">
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
.bs-scrim {
  position: fixed;
  inset: 0;
  z-index: 600;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(16px + var(--sat, 0px)) 24px calc(16px + var(--sab, 0px) + var(--csab, 0px));
}

.bs-stack {
  width: 100%;
  max-width: 345px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-height: 100%;
  min-height: 0;
}

/* ── Card */
.bs-card {
  width: 100%;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'Unbounded', sans-serif;
  color: #000;
  overflow-y: auto;
  min-height: 0;
}
.bs-card::-webkit-scrollbar { width: 3px; }
.bs-card::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 100px;
}

/* ── Head */
.bs-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.bs-eyebrow {
  display: inline-flex;
  padding: 6px 12px;
  background: #484337;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 14px;
  color: #fff;
}
.bs-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 26px;
  color: #000;
}
.bs-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.55);
}

/* ── Host warning */
.bs-warn {
  padding: 8px 12px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.25);
  border-radius: 12px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 14px;
  color: #8b1a1a;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

/* ── Spotlight (selected board) — white inner card per figma popup pattern */
.bs-spotlight {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}
.bs-spotlight__preview {
  border-radius: 8px;
  overflow: hidden;
  line-height: 0;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
}
.bs-spotlight__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bs-spotlight__rarity {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.bs-spotlight__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
}
.bs-spotlight__desc {
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}

/* ── Grid */
.bs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.bs-tile {
  position: relative;
  padding: 8px;
  background: #fff;
  border: 1.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: 'Unbounded', sans-serif;
  color: #000;
  transition: transform 80ms ease, border-color 120ms ease;
}
.bs-tile:disabled { cursor: not-allowed; opacity: 0.55; }
.bs-tile:not(:disabled):active { transform: translateY(1px); }
.bs-tile--active { border-color: #000; }
.bs-tile__preview {
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 6px;
  line-height: 0;
}
.bs-tile__name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #000;
  margin-bottom: 2px;
}
.bs-tile__rarity {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.bs-tile__chip {
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 9px;
  line-height: 12px;
  letter-spacing: 0.06em;
}
.bs-tile__chip--active {
  background: #43c22d;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.5);
}
.bs-tile__chip--owned {
  background: #43c22d;
  width: 20px;
  height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bs-tile__chip--price {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.2);
  color: #000;
}

/* ── Actions */
.bs-actions {
  display: flex;
  gap: 8px;
}
.bs-btn {
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
.bs-btn--ghost {
  background: #fff;
  color: #000;
}
.bs-btn--ghost:active { transform: translateY(1px); }
.bs-btn--primary {
  background: #43c22d;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.18);
  flex: 2;
}
.bs-btn--primary:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}

/* ── Standalone close FAB */
.bs-close {
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
  flex-shrink: 0;
  transition: transform 80ms ease;
}
.bs-close:active { transform: scale(0.94); }

/* ── Transitions */
.bs-fade-enter-active,
.bs-fade-leave-active { transition: opacity 0.22s ease; }
.bs-fade-enter-from,
.bs-fade-leave-to { opacity: 0; }
.bs-fade-enter-active .bs-stack,
.bs-fade-leave-active .bs-stack {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bs-fade-enter-from .bs-stack,
.bs-fade-leave-to .bs-stack { transform: scale(0.96); }
</style>
