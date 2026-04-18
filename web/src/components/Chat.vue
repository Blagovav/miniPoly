<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import { useInventoryStore } from "../stores/inventory";
import { SHOP_ITEMS } from "../shop/items";
import { useTelegram } from "../composables/useTelegram";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

const props = defineProps<{ onSend: (text: string) => void }>();

const { t } = useI18n();
const game = useGameStore();
const inv = useInventoryStore();
const { haptic } = useTelegram();

function playerIndex(id: string): number {
  return game.room?.players.findIndex((p) => p.id === id) ?? -1;
}
function playerColor(id: string): string {
  const idx = playerIndex(id);
  if (idx < 0) return ORDERED_PLAYER_COLORS[0];
  return ORDERED_PLAYER_COLORS[idx % ORDERED_PLAYER_COLORS.length];
}
function isMine(id: string): boolean {
  return !!game.me && id === game.me.id;
}

const open = ref(false);
const draft = ref("");
const list = ref<HTMLDivElement | null>(null);

const ownedEmotes = computed(() =>
  SHOP_ITEMS.filter((i) => i.kind === "emote" && inv.owned.has(i.id)),
);

function toggle() {
  open.value = !open.value;
  if (open.value) {
    game.markChatRead();
    scrollToBottom();
  }
  haptic("light");
}

function send() {
  const text = draft.value.trim();
  if (!text) return;
  props.onSend(text);
  draft.value = "";
}

function sendEmote(icon: string) {
  props.onSend(icon);
  haptic("light");
}

async function scrollToBottom() {
  await nextTick();
  if (list.value) list.value.scrollTop = list.value.scrollHeight;
}

watch(
  () => game.chat.length,
  () => {
    if (open.value) {
      game.markChatRead();
      scrollToBottom();
    }
  },
);
</script>

<template>
  <div :class="['chat', open && 'chat--open']">
    <button class="chat__toggle" @click="toggle" aria-label="chat">
      <Icon name="chat" :size="22" color="#f7eeda"/>
      <span v-if="!open && game.unreadChat > 0" class="chat__badge">
        {{ game.unreadChat }}
      </span>
    </button>

    <transition name="chat-slide">
      <div v-if="open" class="chat__panel card">
        <div class="chat__header">
          <div class="chat__header-text">
            <div class="chat__eyebrow">Pigeon roost</div>
            <div class="chat__title">{{ t("chat.title") }}</div>
          </div>
          <button class="chat__close" @click="toggle" aria-label="close">
            <Icon name="x" :size="14" color="var(--ink-3)"/>
          </button>
        </div>

        <div ref="list" class="chat__list">
          <div v-if="game.chat.length === 0" class="chat__empty">
            {{ t("chat.empty") }}
          </div>
          <div
            v-for="m in game.chat"
            :key="m.id"
            class="chat__msg"
            :class="{ 'chat__msg--me': isMine(m.fromId) }"
          >
            <Sigil
              :name="m.from"
              :color="playerColor(m.fromId)"
              :size="26"
            />
            <div class="chat__bubble" :class="{ 'chat__bubble--me': isMine(m.fromId) }">
              <div v-if="!isMine(m.fromId)" class="chat__from">{{ m.from }}</div>
              <div class="chat__text">{{ m.text }}</div>
            </div>
          </div>
        </div>

        <div v-if="ownedEmotes.length > 0" class="chat__emotes rail">
          <button
            v-for="e in ownedEmotes"
            :key="e.id"
            class="chat__emote"
            @click="sendEmote(e.icon)"
          >
            {{ e.icon }}
          </button>
        </div>

        <div class="chat__input-row">
          <input
            v-model="draft"
            :placeholder="t('chat.placeholder')"
            maxlength="200"
            @keydown.enter="send"
          />
          <button
            class="btn btn-primary chat__send"
            :disabled="!draft.trim()"
            @click="send"
            aria-label="send"
          >
            <Icon name="send" :size="15" color="#fff"/>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.chat {
  position: fixed;
  /* Отодвигаем от нижнего края с учётом safe-area (notch / home bar)
     и Telegram bottom bar (v8+). iOS/Android не обрезает кнопку. */
  bottom: calc(16px + var(--tg-safe-area-inset-bottom, 0px) + var(--tg-content-safe-area-inset-bottom, 0px));
  right: 16px;
  z-index: 80;
}

/* ─── Floating bubble ─── */
.chat__toggle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--primary-soft) 0%, var(--primary) 60%, var(--primary-deep) 100%);
  color: #f7eeda;
  display: grid;
  place-items: center;
  box-shadow:
    0 4px 12px rgba(62, 34, 114, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  border: 1px solid var(--primary-deep);
  position: relative;
  transition: transform 0.12s ease, filter 0.12s ease;
}
.chat__toggle:hover { filter: brightness(1.05); }
.chat__toggle:active { transform: scale(0.94); }

.chat__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--accent);
  color: #f7eeda;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent);
}

/* ─── Drawer panel ─── */
.chat__panel {
  position: fixed;
  right: 16px;
  /* 80px = 16 (margin от края) + 52 (высота кнопки) + 12 (зазор до панели).
     Добавляем safe-area, чтобы панель не залезала под Telegram bottom bar. */
  bottom: calc(80px + var(--tg-safe-area-inset-bottom, 0px) + var(--tg-content-safe-area-inset-bottom, 0px));
  width: min(340px, calc(100vw - 32px));
  height: min(440px, calc(100vh - 180px));
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--card-alt);
  border: 1px solid var(--line);
  box-shadow: 0 12px 32px rgba(42, 29, 16, 0.18);
  overflow: hidden;
}

.chat__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 10px;
}
.chat__header-text { text-align: left; }
.chat__eyebrow {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-3);
  text-transform: uppercase;
}
.chat__title {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--ink);
  margin-top: 1px;
}
.chat__close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--card);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
  flex-shrink: 0;
}
.chat__close:hover { background: var(--bg); }

/* ─── Messages ─── */
.chat__list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
  scrollbar-width: thin;
}
.chat__empty {
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
  margin: auto;
  padding: 20px;
  font-family: var(--font-display);
  font-style: italic;
}

.chat__msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.chat__msg--me { flex-direction: row-reverse; }

.chat__bubble {
  max-width: 72%;
  padding: 7px 11px;
  background: var(--card);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 10px 10px 10px 3px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
  font-family: var(--font-body);
}
.chat__bubble--me {
  background: var(--primary);
  color: #f7eeda;
  border: none;
  border-radius: 10px 10px 3px 10px;
  box-shadow: 0 1px 2px rgba(62, 34, 114, 0.25);
}

.chat__from {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--ink-3);
  font-weight: 600;
  margin-bottom: 2px;
  letter-spacing: 0.02em;
}
.chat__text { font-family: var(--font-body); }

/* ─── Emotes ─── */
.chat__emotes {
  padding: 8px 0;
  border-top: 1px solid var(--divider);
}
.chat__emote {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 16px;
  font-family: var(--font-display);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, border-color 0.15s;
}
.chat__emote:hover { border-color: var(--primary); }
.chat__emote:active { transform: scale(0.92); }

/* ─── Input ─── */
.chat__input-row {
  display: flex;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--divider);
}
.chat__input-row input {
  flex: 1;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  font-size: 13px;
  color: var(--ink);
  font-family: var(--font-body);
  outline: none;
}
.chat__input-row input:focus { border-color: var(--primary); }
.chat__input-row input::placeholder { color: var(--ink-3); }

.chat__send {
  width: 44px;
  padding: 0;
}
.chat__send:disabled { opacity: 0.45; }

/* ─── Slide transition ─── */
.chat-slide-enter-active, .chat-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.2s ease;
}
.chat-slide-enter-from, .chat-slide-leave-to {
  transform: translateY(20px) scale(0.96);
  opacity: 0;
}
</style>
