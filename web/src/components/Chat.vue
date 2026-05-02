<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useGameStore } from "../stores/game";
import { useTelegram } from "../composables/useTelegram";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";

const props = defineProps<{ onSend: (text: string) => void }>();

const { t } = useI18n();
const game = useGameStore();
const { haptic } = useTelegram();

const open = ref(false);
const draft = ref("");
const list = ref<HTMLDivElement | null>(null);

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
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

const hasMessages = computed(() => game.chat.length > 0);

function openChat() {
  if (open.value) return;
  open.value = true;
  game.markChatRead();
  scrollToBottom();
  haptic("light");
}
function close() {
  if (!open.value) return;
  open.value = false;
  haptic("light");
}
function toggle() {
  open.value ? close() : openChat();
}

function send() {
  const text = draft.value.trim();
  if (!text) return;
  props.onSend(text);
  draft.value = "";
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

// External trigger — RoomView's header chat icon dispatches this event.
function handleExternalToggle() { toggle(); }
onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("toggle-chat", handleExternalToggle);
  }
});
onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("toggle-chat", handleExternalToggle);
  }
});
</script>

<template>
  <transition name="chat-fade">
    <div v-if="open" class="chat" role="dialog" aria-modal="true" @click.self="close">
      <div class="chat__stack">
        <div class="chat__panel" :class="{ 'chat__panel--empty': !hasMessages }">
          <div class="chat__header">
            <h2 class="chat__title">{{ t("chat.title") }}</h2>
          </div>

          <div ref="list" class="chat__list">
            <div v-if="!hasMessages" class="chat__empty">
              {{ t("chat.empty") }}
            </div>

            <template v-else>
              <div
                v-for="m in game.chat"
                :key="m.id"
                class="chat__msg"
                :class="{ 'chat__msg--me': isMine(m.fromId) }"
              >
                <Sigil
                  v-if="!isMine(m.fromId)"
                  class="chat__avatar"
                  :name="m.from"
                  :color="playerColor(m.fromId)"
                  :size="40"
                />

                <div
                  v-if="isMine(m.fromId)"
                  class="chat__bubble chat__bubble--me"
                >
                  <p class="chat__text chat__text--me">{{ m.text }}</p>
                  <span class="chat__time chat__time--me">{{ formatTime(m.ts) }}</span>
                </div>

                <div
                  v-else
                  class="chat__bubble"
                  :style="{ boxShadow: `inset -4px 0 0 0 ${playerColor(m.fromId)}` }"
                >
                  <div class="chat__bubble-top">
                    <span class="chat__name-pill" :style="{ background: playerColor(m.fromId) }">
                      <Sigil
                        :name="m.from"
                        :color="playerColor(m.fromId)"
                        :size="16"
                      />
                      <span class="chat__name">{{ m.from }}</span>
                    </span>
                    <p class="chat__text">{{ m.text }}</p>
                  </div>
                  <span class="chat__time">{{ formatTime(m.ts) }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="chat__input-row">
          <input
            v-model="draft"
            :placeholder="t('chat.placeholder')"
            maxlength="200"
            class="chat__input"
            @keydown.enter="send"
          />
          <button
            class="chat__send"
            :disabled="!draft.trim()"
            @click="send"
            aria-label="send"
          >
            <!-- Figma 75:6068 — paper-airplane asset (image 30) sized 24×24
                 inside the 40×40 blue circle. Replaces the inline Icon stand-in. -->
            <img class="chat__send-icon" src="/figma/room/icon-send.webp" alt="" aria-hidden="true"/>
          </button>
        </div>

        <button class="chat__close-btn" @click="close" aria-label="close">
          <Icon name="x" :size="20" color="#000"/>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Overlay (scrim) ── */
.chat {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 24px calc(16px + var(--sab) + var(--csab));
}

.chat-fade-enter-active,
.chat-fade-leave-active { transition: opacity 0.2s ease; }
.chat-fade-enter-from,
.chat-fade-leave-to { opacity: 0; }

.chat__stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 345px;
  margin: 0 auto;
}

/* ── Popup card ── */
.chat__panel {
  background: var(--card-alt);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: min(530px, calc(100vh - 220px));
  min-height: 116px;
}
.chat__panel--empty { min-height: 0; }

.chat__header {
  flex-shrink: 0;
  background: var(--card-alt);
  padding: 16px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.16);
  border-radius: 0 0 18px 18px;
  z-index: 2;
}
.chat__title {
  margin: 0;
  font-family: 'Unbounded', var(--font-display);
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
}

.chat__list {
  flex: 1;
  /* Designer feedback 2026-05-02 #5.19 — chat body min-height 264px so
     short conversations don't squish the panel vertically. The old `0`
     let the panel collapse to its header when only one message was in. */
  min-height: 264px;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.4) rgba(0, 0, 0, 0.16);
}
.chat__list::-webkit-scrollbar { width: 3px; }
.chat__list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.16);
  border-radius: 100px;
}
.chat__list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 100px;
}

/* ── Empty state pill ── */
.chat__empty {
  margin: 8px 0;
  padding: 10px;
  border: 1.4px dashed rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  text-align: center;
  font-family: 'Unbounded', var(--font-display);
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}

/* ── Message rows ── */
.chat__msg {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.chat__msg--me { justify-content: flex-end; }

.chat__avatar {
  flex-shrink: 0;
  width: 40px !important;
  height: 40px !important;
}

/* Other-player bubble: white card with colored right stripe */
.chat__bubble {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 8px 12px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}
.chat__bubble-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  width: 100%;
}

.chat__name-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 100px;
  color: #fff;
}
.chat__name-pill :deep(.sigil) {
  /* Darken the pill's sigil so the gradient reads on a same-color pill */
  filter: brightness(0.85) contrast(1.1);
}
.chat__name {
  font-family: 'Unbounded', var(--font-display);
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.6);
}

.chat__text {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  word-break: break-word;
  align-self: stretch;
}
.chat__text--me { color: #fff; }

.chat__time {
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 10px;
  line-height: 12px;
  color: rgba(0, 0, 0, 0.6);
}
.chat__time--me { color: rgba(255, 255, 255, 0.6); }

/* Own bubble: solid blue, pointing to the right */
.chat__bubble--me {
  flex: 0 0 auto;
  max-width: 75%;
  background: #3477da;
  border: none;
  border-radius: 16px 16px 0 16px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
  text-align: right;
}

/* ── Input row (below popup) ── */
.chat__input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.chat__input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  outline: none;
}
.chat__input::placeholder { color: rgba(0, 0, 0, 0.4); }
.chat__input:focus { border-color: rgba(0, 0, 0, 0.4); }

.chat__send {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: #2283f3;
  border: 1px solid #000;
  border-radius: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s ease, filter 0.1s ease;
}
.chat__send-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
}
.chat__send:disabled { opacity: 0.45; cursor: default; }
.chat__send:not(:disabled):hover { filter: brightness(1.05); }
.chat__send:not(:disabled):active { transform: scale(0.94); }

/* ── Close button ── */
.chat__close-btn {
  width: 44px;
  height: 44px;
  background: #fff;
  border: 4.125px solid #000;
  border-radius: 50%;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s ease;
  margin-top: 4px;
  padding: 0;
}
.chat__close-btn:active { transform: scale(0.94); }
</style>
