<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import { useInventoryStore } from "../stores/inventory";
import { SHOP_ITEMS } from "../shop/items";
import { useTelegram } from "../composables/useTelegram";

const props = defineProps<{ onSend: (text: string) => void }>();

const { t } = useI18n();
const game = useGameStore();
const inv = useInventoryStore();
const { haptic } = useTelegram();

function playerOf(id: string) {
  return game.room?.players.find((p) => p.id === id) ?? null;
}
function playerColor(id: string): string {
  return playerOf(id)?.color ?? "#94a3b8";
}
function playerIcon(id: string): string {
  const p = playerOf(id);
  if (!p || !p.token) return "●";
  return SHOP_ITEMS.find((i) => i.id === p.token)?.icon ?? "●";
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
    <button class="chat__toggle" @click="toggle">
      <span>💬</span>
      <span v-if="!open && game.unreadChat > 0" class="chat__badge">
        {{ game.unreadChat }}
      </span>
    </button>

    <transition name="chat-slide">
      <div v-if="open" class="chat__panel card">
        <div class="chat__header">
          <span>💬 {{ t("chat.title") }}</span>
          <button class="chat__close" @click="toggle">✕</button>
        </div>

        <div ref="list" class="chat__list">
          <div v-if="game.chat.length === 0" class="chat__empty">
            {{ t("chat.empty") }}
          </div>
          <div
            v-for="m in game.chat"
            :key="m.id"
            class="chat__msg"
          >
            <span class="chat__icon" :style="{ background: playerColor(m.fromId) }">
              {{ playerIcon(m.fromId) }}
            </span>
            <span class="chat__from" :style="{ color: playerColor(m.fromId) }">
              {{ m.from }}:
            </span>
            <span class="chat__text">{{ m.text }}</span>
          </div>
        </div>

        <div v-if="ownedEmotes.length > 0" class="chat__emotes">
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
          <button class="btn btn--primary send" :disabled="!draft.trim()" @click="send">
            →
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.chat {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 80;
}
.chat__toggle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--purple), #7e22ce);
  color: #fff;
  font-size: 22px;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 24px -6px rgba(168, 85, 247, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  transition: transform 0.15s ease;
}
.chat__toggle:active { transform: scale(0.92); }
.chat__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--red);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.chat__panel {
  position: fixed;
  right: 16px;
  bottom: 80px;
  width: min(340px, calc(100vw - 32px));
  height: min(420px, calc(100vh - 180px));
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}
.chat__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.chat__close {
  color: var(--text-mute);
  font-size: 18px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.chat__close:hover { color: var(--text); background: rgba(255, 255, 255, 0.05); }

.chat__list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}
.chat__empty {
  text-align: center;
  color: var(--text-mute);
  font-size: 12px;
  margin: auto;
  padding: 20px;
}
.chat__msg {
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.chat__icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 10px;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  margin-top: 1px;
}
.chat__from {
  font-weight: 700;
  margin-right: 4px;
  flex-shrink: 0;
}
.chat__text {
  flex: 1;
}

.chat__emotes {
  display: flex;
  gap: 4px;
  padding: 8px 0;
  overflow-x: auto;
  border-top: 1px solid var(--border);
}
.chat__emote {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  font-size: 18px;
  transition: transform 0.1s;
}
.chat__emote:active { transform: scale(0.9); }

.chat__input-row {
  display: flex;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.chat__input-row input {
  flex: 1;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.chat__input-row input:focus { border-color: var(--purple); }
.send {
  width: 44px;
  padding: 0;
  font-size: 20px;
}

.chat-slide-enter-active, .chat-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.2s ease;
}
.chat-slide-enter-from, .chat-slide-leave-to {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}
</style>
