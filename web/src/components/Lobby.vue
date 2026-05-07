<script setup lang="ts">
// Ported 1:1 from design-ref/screens_game.vue.js → LobbyScreen.
// Preserves all real-data logic: SHOP_ITEMS tokens, inventory, Telegram share,
// takenTokens map, i18n and the onReady / onStart / onSelectToken callbacks
// that RoomView wires up to the WebSocket. Destroy/leave moved to the
// RoomView topbar with confirm modals — Lobby no longer owns those flows.
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RoomState } from "../../../shared/types";
import { SHOP_ITEMS } from "../shop/items";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";
import { useGameStore } from "../stores/game";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import CosmeticsCaps from "./CosmeticsCaps.vue";
import { capTypeFor, SHOP_CAPS } from "../shop/cosmetics";
import type { Rarity } from "./RarityGlow.vue";
import BoardPreview from "./BoardPreview.vue";
import BoardSelectModal from "./BoardSelectModal.vue";
import { findBoard } from "../utils/boards";
import { ORDERED_PLAYER_COLORS } from "../utils/palette";
import BotAvatar from "./BotAvatar.vue";

const props = defineProps<{
  room: RoomState;
  myPlayerId: string | null;
  onReady: () => void;
  onStart: () => void;
  onSelectToken: (tokenId: string) => void;
  onAddBot?: () => void;
  onRemoveBot?: (playerId: string) => void;
  // Sends a friend request to another lobby player (by their tgUserId).
  // Optional so the lobby can render without it during early onboarding.
  onFriendRequest?: (toUserId: number) => void;
}>();

const inv = useInventoryStore();
const game = useGameStore();
const { t, locale } = useI18n();
const isRu = computed(() => locale.value === "ru");
void t;

// Per-row friendship state — drives the in-lobby «В ДРУЗЬЯ» button.
function friendStateFor(p: { tgUserId: number; isBot?: boolean; id: string }):
  "self" | "bot" | "friend" | "pending" | "none" {
  if (p.isBot) return "bot";
  if (p.id === props.myPlayerId) return "self";
  if (game.friendIds.has(p.tgUserId)) return "friend";
  if (game.sentFriendRequests.has(p.tgUserId)) return "pending";
  return "none";
}
function requestFriend(p: { tgUserId: number }) {
  if (!props.onFriendRequest) return;
  if (game.sentFriendRequests.has(p.tgUserId)) return;
  // Optimistic flip — server's `friendStatusUpdate` cleans up if rejected.
  const next = new Set(game.sentFriendRequests);
  next.add(p.tgUserId);
  game.sentFriendRequests = next;
  props.onFriendRequest(p.tgUserId);
}

// Lobby-only board pick (display-only — server doesn't pick boards yet).
const boardId = ref<string>("eldmark");
const boardModalOpen = ref(false);
const board = computed(() => findBoard(boardId.value));
const boardName = computed(() => isRu.value ? board.value.ru : board.value.name);
const boardDesc = computed(() => isRu.value ? board.value.desc.ru : board.value.desc.en);

// Available tokens = free set + anything the player owns from the shop.
const availableTokens = computed(() => {
  const freeTokens = ["token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo"];
  const owned = new Set(inv.owned);
  return SHOP_ITEMS.filter(
    (i) => i.kind === "token" && (freeTokens.includes(i.id) || owned.has(i.id)),
  );
});

// Tokens already claimed by others (so we grey them out and block re-pick).
const takenTokens = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.room.players) {
    if (p.token && p.id !== props.myPlayerId) map.set(p.token, p.name);
  }
  return map;
});

const copied = ref(false);

const me = computed(() => props.room.players.find((p) => p.id === props.myPlayerId));
const isHost = computed(() => !!me.value && props.room.hostId === me.value.id);

// Host auto-ready (Figma 110:9441 / 110:9624). The redesign drops the
// host's ready toggle — they only see "НАЧАТЬ ПАРТИЮ" — so we have to flip
// the flag implicitly the moment they've chosen a token. Server-side host
// is still treated like any other player and must call `ready`; without
// this watcher canStart would stay false forever and the Start CTA would
// never light up.
watch(
  () => [isHost.value, me.value?.token, me.value?.ready] as const,
  ([host, token, ready]) => {
    if (host && token && !ready) props.onReady();
  },
  { immediate: true },
);
// Only count connected — offline players shouldn't block Start. Bots count
// as connected for Start purposes even though their WS is absent.
const activePlayers = computed(() =>
  props.room.players.filter((p) => p.connected || p.isBot),
);
const readyActive = computed(() => activePlayers.value.filter((p) => p.ready));
const canStart = computed(() =>
  activePlayers.value.length >= 2 && readyActive.value.length === activePlayers.value.length,
);
const canAddBot = computed(
  () => {
    // Mirror the server's "viable seat" capacity check (engine.ts
    // addPlayer/addBot) — offline humans inside the 3-min reconnect
    // grace shouldn't visually block the host from filling the
    // remaining seat with a bot.
    if (!isHost.value || !props.onAddBot) return false;
    const seated = props.room.players.filter(
      (p) => p.connected || p.isBot,
    ).length;
    return seated < props.room.maxPlayers;
  },
);


// Empty seats = maxPlayers − current player count (dashed placeholder rows).
const emptySeats = computed(() => {
  const n = props.room.maxPlayers - props.room.players.length;
  return n > 0 ? n : 0;
});

// Map any token id (cap-* / token-*) to its rarity so the Figma-style tile
// can render the correct halo. Legacy / unknown ids fall back to common.
const CAP_BY_ID = new Map(SHOP_CAPS.map((c) => [c.id, c] as const));
function capRarityFor(tokenId: string): Rarity {
  const c = CAP_BY_ID.get(tokenId);
  return c ? c.rarity : "common";
}

const botUsername = (import.meta.env.VITE_BOT_USERNAME as string) || "poly_mini_bot";
const API_URL = (import.meta.env.VITE_API_URL as string) || "";

/** Telegram Mini App startapp-link — opens the bot with room_<id> payload. */
const inviteUrl = computed(
  () => `https://t.me/${botUsername}?startapp=room_${props.room.id}`,
);

const { tg: tgRef, userId, userName } = useTelegram();
const tg = (window as any).Telegram?.WebApp;

// ── Auto-ready host (Figma 110:9441 / 110:9624) ─────────────────────
// The redesigned host view hides the READY/UNREADY pill — host's only
// bottom-bar button is "НАЧАТЬ ПАРТИЮ", so without an implicit ready
// signal canStart could never flip true and the Start CTA would stay
// stuck grey forever. Picking a token IS the ready signal: as soon as
// the host has a cap equipped we send `ready` once, server-side.
// `me.value?.ready` becomes true so the watcher won't fire again.

// ── Invite friends modal state (Figma 133:15368) ────────────────────
const inviteOpen = ref(false);
interface InviteFriend {
  tgUserId: number;
  name: string;
}
const friendsList = ref<InviteFriend[]>([]);
const friendsLoading = ref(false);
const invitedFriendIds = ref<Set<number>>(new Set());
const invitingFriendId = ref<number | null>(null);

async function loadFriendsList() {
  if (!userId.value) return;
  if (friendsLoading.value) return;
  friendsLoading.value = true;
  try {
    const res = await fetch(`${API_URL}/api/users/${userId.value}/coplayers`);
    if (!res.ok) return;
    const data = await res.json();
    friendsList.value = (data.players ?? []).map((p: any) => ({
      tgUserId: Number(p.tgUserId),
      name: p.name || (isRu.value ? "Игрок" : "Player"),
    }));
  } catch {
    // network error — leave list empty, user can still tap "Пригласить ещё"
  } finally {
    friendsLoading.value = false;
  }
}

async function openInvite() {
  // Load co-players first. If the list comes back empty there's nothing
  // to choose from in the modal — it would just show a title and the
  // same "Пригласить ещё" button that already kicked us off, which is
  // what the playtester flagged as redundant («нажимаю пригласить, а
  // там та же кнопка»). Skip the modal entirely and go straight to the
  // Telegram share flow in that case.
  await loadFriendsList();
  if (friendsList.value.length === 0) {
    void share();
    return;
  }
  inviteOpen.value = true;
}
function closeInvite() {
  inviteOpen.value = false;
}

async function inviteFriend(f: InviteFriend) {
  if (invitingFriendId.value === f.tgUserId) return;
  if (invitedFriendIds.value.has(f.tgUserId)) return;
  invitingFriendId.value = f.tgUserId;
  try {
    const res = await fetch(`${API_URL}/api/invites/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tgUserId: f.tgUserId,
        roomId: props.room.id,
        fromName: userName.value || (isRu.value ? "Игрок" : "Player"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      const next = new Set(invitedFriendIds.value);
      next.add(f.tgUserId);
      invitedFriendIds.value = next;
    }
  } catch {
    // swallow — toast not in-scope here
  } finally {
    invitingFriendId.value = null;
  }
}

function uninviteFriend(f: InviteFriend) {
  // Tapping the × on an "Приглашен" pill removes them from the local
  // invited set so the user can re-invite if they tapped by accident.
  // Server-side there's no "uninvite" call — the original DM stays.
  const next = new Set(invitedFriendIds.value);
  next.delete(f.tgUserId);
  invitedFriendIds.value = next;
}

// Stable colour per friend tgUserId — same hash trick FriendsView uses.
function friendColor(id: number): string {
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return ORDERED_PLAYER_COLORS[Math.abs(hash) % ORDERED_PLAYER_COLORS.length];
}

async function copyCode() {
  // Small icon-button next to the room code is clipboard-only — the big
  // green "ПРИГЛАСИТЬ ИГРОКОВ" CTA is the share/Telegram pathway. Decoupling
  // them matches the figma intent: the icon is a quiet "copy receipt", the
  // CTA is the action that opens the friend picker.
  try {
    await navigator.clipboard.writeText(props.room.id);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {}
}

async function share() {
  const tgApp: any = tgRef.value;
  const fromName = userName.value || "Игрок";

  // 1) Лучший UX — Telegram shareMessage (Bot API 7.8+):
  //    показывает нативный пикер чатов, адресату приходит карточка
  //    с превью, описанием и inline-кнопкой «Играть».
  if (tgApp?.shareMessage && userId.value) {
    try {
      const res = await fetch(`${API_URL}/api/invites/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tgUserId: userId.value,
          roomId: props.room.id,
          fromName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data.id) {
        tgApp.shareMessage(data.id);
        return;
      }
    } catch {
      // тихо падаем на legacy-share
    }
  }

  // 2) Legacy — openTelegramLink с t.me/share/url (без карточки, просто текст+ссылка).
  const text = isRu.value
    ? `Го в Minipoly! Игра ${props.room.id}`
    : `Join me in Minipoly! Game ${props.room.id}`;
  if (tg?.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl.value)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(shareUrl);
    return;
  }

  // 3) Mobile-браузер — Web Share API.
  if (navigator.share) {
    try {
      await navigator.share({ title: "Minipoly", text, url: inviteUrl.value });
      return;
    } catch {}
  }

  // 4) Последний шанс — скопировать ссылку в буфер.
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {}
}

// Bilingual labels, mirroring the JSX LobbyScreen strings.
const L = computed(() => isRu.value
  ? {
      roomCode: "Код игры",
      copyLink: "Скопировать ссылку",
      copied: "Скопировано!",
      players: "Игроки",
      yourToken: "Твоя фишка",
      ready: "ГОТОВ",
      notReady: "НЕ ГОТОВ",
      choosing: "Готовится",
      readyStatus: "Готов",
      emptySeat: "Свободное место",
      invitePlayers: "ПРИГЛАСИТЬ ИГРОКОВ",
      start: "НАЧАТЬ ПАРТИЮ",
      minPlayers: "Готовых игроков нужно: 2",
      canStart: "Партию можно начать",
      waitingOthers: "Ожидание других игроков",
      destroy: "Закрыть игру",
      offline: "offline",
      bot: "Бот",
      addBot: "Добавить бота",
      kickBot: "Убрать бота",
      addFriend: "Добавить в друзья",
      friendRequested: "Запрос отправлен",
      alreadyFriend: "Уже в друзьях",
      takenBy: (name: string) => `Занята: ${name}`,
      inviteTitle: "Пригласить игроков",
      inviteSub: "Вы можете пригласить друзей или отправить приглашение в телеграм напрямую",
      inviteFriendsHead: "Друзья",
      inviteFriend: "Пригласить",
      invitedFriend: "Приглашен",
      inviteMore: "ПРИГЛАСИТЬ ЕЩЁ",
    }
  : {
      roomCode: "Game code",
      copyLink: "Copy link",
      copied: "Copied!",
      players: "Players",
      yourToken: "Your token",
      ready: "READY",
      notReady: "NOT READY",
      choosing: "Getting ready",
      readyStatus: "Ready",
      emptySeat: "Empty seat",
      invitePlayers: "INVITE PLAYERS",
      start: "START GAME",
      minPlayers: "Ready players needed: 2",
      canStart: "Ready to start",
      waitingOthers: "Waiting for other players",
      destroy: "Close game",
      offline: "offline",
      bot: "Bot",
      addBot: "Add a bot",
      kickBot: "Remove bot",
      addFriend: "Add as friend",
      friendRequested: "Request sent",
      alreadyFriend: "Already friends",
      takenBy: (name: string) => `Taken: ${name}`,
      inviteTitle: "Invite players",
      inviteSub: "Invite friends or share to Telegram directly",
      inviteFriendsHead: "Friends",
      inviteFriend: "Invite",
      invitedFriend: "Invited",
      inviteMore: "INVITE MORE",
    });
</script>

<template>
  <div class="content lobby">
    <!-- ── Room code (Figma 110:9602) — host only. The redesign drops the
         code + invite block entirely for invited players (133:15617) since
         they joined through a link and their action is "Ready", not "Share".
         The small copy button is intentionally clipboard-only; the green
         CTA below is what opens the friend-picker modal (133:15368). -->
    <div v-if="isHost" class="lobby-section">
      <div class="lobby-section__label">{{ L.roomCode }}</div>
      <div class="lobby-code2">
        <span class="lobby-code2__value">{{ room.id }}</span>
        <button
          class="lobby-code2__copy"
          :aria-label="L.copyLink"
          :title="copied ? L.copied : L.copyLink"
          @click="copyCode"
        >
          <Icon v-if="copied" name="check" :size="16" color="#43c22d" />
          <!-- Figma 110:9611 — vuesax/linear/copy SVG. Designer flagged the
               prior hand-drawn icon as off-spec (#3.6). -->
          <img v-else class="lobby-code2__copy-icon" src="/figma/lobby/icon-copy.svg" alt="" aria-hidden="true"/>
        </button>
      </div>
      <button
        type="button"
        class="lobby-cta lobby-cta--invite"
        @click="openInvite"
      >
        <span class="lobby-cta__text">{{ L.invitePlayers }}</span>
        <svg
          class="lobby-cta__deco"
          viewBox="0 0 98 32.5"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            opacity="0.2"
            d="M98 9.5V32.5C98 32.5 97 6 89.5 4C82 2 0 0 0 0H88.5C96 0 98 3.5 98 9.5Z"
            fill="white"
          />
        </svg>
      </button>
    </div>

    <!-- ── Поле card (Figma 73:3591) ─────────────────────────── -->
    <div class="lobby-section lobby-section--card">
      <div class="lobby-section__label">{{ isRu ? "Поле" : "Map" }}</div>
      <button
        type="button"
        class="lobby-board"
        :disabled="!isHost"
        @click="isHost ? (boardModalOpen = true) : null"
      >
        <div class="lobby-board__art">
          <BoardPreview :board="board" :size="56"/>
        </div>
        <div class="lobby-board__body">
          <div class="lobby-board__name">{{ boardName }}</div>
          <div class="lobby-board__desc">{{ boardDesc }}</div>
        </div>
        <img
          v-if="isHost"
          class="lobby-board__edit"
          src="/figma/create/edit-pencil.svg"
          alt=""
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- ── Players section (Figma 73:3483 — header w/ N/max badge) ── -->
    <div class="players-head">
      <div class="section-label">{{ L.players }}</div>
      <span class="players-count">{{ activePlayers.length }}/{{ room.maxPlayers }}</span>
    </div>
    <div class="players">
      <div
        v-for="(p, idx) in room.players"
        :key="p.id"
        class="player-row"
        :class="{ 'player-row--me': p.id === myPlayerId }"
      >
        <BotAvatar
          v-if="p.isBot"
          class="player-row__avatar"
          :seed="p.name || String(p.id)"
          :size="40"
        />
        <img
          v-else-if="p.avatar"
          class="player-row__avatar player-row__avatar--photo"
          :src="p.avatar"
          :alt="p.name"
          referrerpolicy="no-referrer"
        />
        <Sigil
          v-else
          class="player-row__avatar"
          :name="p.name"
          :color="p.color"
          :size="40"
        />
        <div class="player-row__body">
          <div class="player-row__name">
            {{ p.name }}
            <Icon v-if="room.hostId === p.id" name="crown" :size="12" color="var(--gold)"/>
          </div>
          <div
            class="player-row__status"
            :class="{ 'player-row__status--ready': p.ready, 'player-row__status--off': !p.connected && !p.isBot }"
          >
            <template v-if="!p.connected && !p.isBot">{{ L.offline }}</template>
            <template v-else-if="p.ready">{{ L.readyStatus }}</template>
            <template v-else>{{ L.choosing }}</template>
          </div>
        </div>
        <button
          v-if="p.isBot && isHost && onRemoveBot"
          class="player-row__action player-row__action--kick"
          :title="L.kickBot"
          @click="onRemoveBot(p.id)"
        >
          <Icon name="x" :size="14" color="#000"/>
        </button>
        <!-- In-lobby friend request. Hidden on self / bots. Three pill
             states: idle (green +), pending (grey, awaiting their accept),
             accepted (teal heart, disabled). -->
        <button
          v-else-if="friendStateFor(p) === 'none' && onFriendRequest"
          class="player-row__action player-row__action--addfriend"
          :title="L.addFriend"
          @click="requestFriend(p)"
        >
          <Icon name="plus" :size="14" color="#fff"/>
        </button>
        <span
          v-else-if="friendStateFor(p) === 'pending'"
          class="player-row__action player-row__action--pendingfriend"
          :title="L.friendRequested"
          aria-hidden="true"
        >
          <Icon name="check" :size="12" color="#000"/>
        </span>
        <span
          v-else-if="friendStateFor(p) === 'friend'"
          class="player-row__action player-row__action--isfriend"
          :title="L.alreadyFriend"
          aria-hidden="true"
        >
          ❤
        </span>
        <span
          v-else-if="p.ready"
          class="player-row__action player-row__action--check"
          aria-hidden="true"
        >
          <Icon name="check" :size="14" color="#fff"/>
        </span>
      </div>

      <!-- Empty-seat placeholder rows: host can fill with a bot, others see a dashed slot. -->
      <template v-for="i in emptySeats" :key="'empty-' + i">
        <button
          v-if="i === 1 && canAddBot"
          type="button"
          class="seat-empty seat-empty--addable"
          @click="onAddBot"
        >
          <span class="seat-empty__avatar" aria-hidden="true">
            <Icon name="users" :size="22" color="var(--ink-3)"/>
          </span>
          <span class="seat-empty__name">{{ L.addBot }}</span>
          <span class="seat-empty__plus" aria-hidden="true">
            <Icon name="plus" :size="14" color="#fff"/>
          </span>
        </button>
        <div v-else class="seat-empty">
          <span class="seat-empty__avatar" aria-hidden="true">
            <Icon name="users" :size="22" color="var(--ink-4)"/>
          </span>
          <span class="seat-empty__name seat-empty__name--muted">{{ L.emptySeat }}</span>
        </div>
      </template>
    </div>

    <!-- ── Token picker (Figma 110:9549 — 6 black tiles, green-bordered when
         selected, real cap art with rarity halo behind it). -->
    <div class="section-label">{{ L.yourToken }}</div>
    <div class="rail tokens-rail">
      <button
        v-for="tk in availableTokens"
        :key="tk.id"
        class="token-btn"
        :class="{
          'token-btn--selected': me && me.token === tk.id,
          'token-btn--taken': takenTokens.has(tk.id),
        }"
        :disabled="takenTokens.has(tk.id)"
        :title="takenTokens.get(tk.id) ? L.takenBy(takenTokens.get(tk.id)!) : ''"
        @click="onSelectToken(tk.id)"
      >
        <CosmeticsCaps
          :type="capTypeFor(tk.id)"
          :rarity="capRarityFor(tk.id)"
          :size="48"
        />
      </button>
    </div>

    <!-- ── Actions (Figma 110:9441 / 110:9624 / 133:15617).
         The two views diverge cleanly: host sees only START (greyed when
         !canStart, green when ready); invited player sees only READY/NOT
         READY. The destroy link was removed from the body — that action
         now lives on the topbar's red × which routes through the
         "Распутить партию?" confirm modal in RoomView. -->
    <div class="lobby-actions">
      <p
        class="lobby-hint"
        :class="{ 'lobby-hint--ok': isHost ? canStart : true }"
      >
        {{ isHost ? (canStart ? L.canStart : L.minPlayers) : L.waitingOthers }}
      </p>

      <button
        v-if="!isHost && me"
        type="button"
        class="lobby-cta"
        :class="me.ready ? 'lobby-cta--unready' : 'lobby-cta--ready'"
        @click="onReady"
      >
        <span class="lobby-cta__text">{{ me.ready ? L.notReady : L.ready }}</span>
        <svg
          class="lobby-cta__deco"
          viewBox="0 0 98 32.5"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            opacity="0.2"
            d="M98 9.5V32.5C98 32.5 97 6 89.5 4C82 2 0 0 0 0H88.5C96 0 98 3.5 98 9.5Z"
            fill="white"
          />
        </svg>
      </button>

      <button
        v-if="isHost"
        type="button"
        class="lobby-cta"
        :class="canStart ? 'lobby-cta--start' : 'lobby-cta--start-off'"
        :disabled="!canStart"
        @click="onStart"
      >
        <span class="lobby-cta__text">{{ L.start }}</span>
        <svg
          class="lobby-cta__deco"
          viewBox="0 0 98 32.5"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            opacity="0.2"
            d="M98 9.5V32.5C98 32.5 97 6 89.5 4C82 2 0 0 0 0H88.5C96 0 98 3.5 98 9.5Z"
            fill="white"
          />
        </svg>
      </button>
    </div>

    <BoardSelectModal
      :open="boardModalOpen"
      :selected-id="boardId"
      :is-host="isHost"
      :on-close="() => (boardModalOpen = false)"
      :on-select="(id) => (boardId = id)"
    />

    <!-- ── Invite players modal (Figma 133:15368) ────────────────────
         Friends list comes from /api/users/{id}/coplayers (same source
         FriendsView uses). Each card has Sigil + name + green "Пригласить"
         pill; once we hit the API the pill flips to "Приглашен ×" which
         also lets the user reset their own state if they tapped wrong.
         The blue "ПРИГЛАСИТЬ ЕЩЁ" CTA falls back to the existing share()
         flow (Telegram shareMessage → openTelegramLink → Web Share →
         clipboard) so the user can pull in non-friends. -->
    <transition name="lobby-modal">
      <div
        v-if="inviteOpen"
        class="lobby-modal-backdrop"
        @click.self="closeInvite"
      >
        <div class="lobby-modal lobby-modal--invite">
          <div class="lobby-modal__head">
            <h2 class="lobby-modal__title">{{ L.inviteTitle }}</h2>
            <p class="lobby-modal__subtitle">{{ L.inviteSub }}</p>
          </div>

          <div
            v-if="friendsList.length > 0"
            class="lobby-modal__friends"
          >
            <p class="lobby-modal__friends-head">{{ L.inviteFriendsHead }}</p>
            <div
              v-for="f in friendsList"
              :key="f.tgUserId"
              class="lobby-friend"
            >
              <Sigil
                class="lobby-friend__avatar"
                :name="f.name"
                :color="friendColor(f.tgUserId)"
                :size="40"
              />
              <div class="lobby-friend__name">{{ f.name }}</div>
              <button
                v-if="invitedFriendIds.has(f.tgUserId)"
                type="button"
                class="lobby-friend__pill lobby-friend__pill--invited"
                @click="uninviteFriend(f)"
              >
                <span>{{ L.invitedFriend }}</span>
                <Icon name="x" :size="12" color="#000" />
              </button>
              <button
                v-else
                type="button"
                class="lobby-friend__pill lobby-friend__pill--invite"
                :disabled="invitingFriendId === f.tgUserId"
                @click="inviteFriend(f)"
              >
                {{ L.inviteFriend }}
              </button>
            </div>
          </div>

          <button
            type="button"
            class="lobby-cta lobby-cta--share"
            @click="share"
          >
            <span class="lobby-cta__text">{{ L.inviteMore }}</span>
            <svg
              class="lobby-cta__deco"
              viewBox="0 0 98 32.5"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden="true"
            >
              <path
                opacity="0.2"
                d="M98 9.5V32.5C98 32.5 97 6 89.5 4C82 2 0 0 0 0H88.5C96 0 98 3.5 98 9.5Z"
                fill="white"
              />
            </svg>
          </button>
        </div>
        <button
          type="button"
          class="lobby-modal__close"
          :aria-label="locale === 'ru' ? 'Закрыть' : 'Close'"
          @click="closeInvite"
        >
          <Icon name="x" :size="14" color="#000" />
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/*
  Layout: matches the design-ref LobbyScreen — a padded .content column with
  14px gap. Visuals reuse our design tokens (--card, --primary, --line,
  --emerald, --gold) so we stay consistent with the rest of the app.
*/
.lobby {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: clip;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
/* Flex children of .lobby must not shrink — otherwise the tokens rail gets
   crushed when total content exceeds the viewport. */
.lobby > * { flex-shrink: 0; }

/* ── Figma section labels + cards (73:3483) ── */
.lobby-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lobby-section--card {
  padding: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
}
.lobby-section__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  margin: 0;
}

/* Room code card — Figma 110:9604: code is centred, the small 32×32 white
   copy circle floats at the right edge. Card itself isn't tappable; the
   "ПРИГЛАСИТЬ ИГРОКОВ" CTA below carries the share action. */
.lobby-code2 {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 56px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  text-align: center;
}
.lobby-code2__value {
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 22px;
  line-height: 24px;
  color: #000;
  letter-spacing: 0;
  word-break: break-all;
}
.lobby-code2__copy {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 50%;
  background: #fff;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms, transform 120ms ease;
}
.lobby-code2__copy:hover { background: rgba(0, 0, 0, 0.04); }
.lobby-code2__copy:active { transform: translateY(-50%) scale(0.92); }
.lobby-code2__copy-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  pointer-events: none;
}

.lobby-cta--invite { background: #43c22d; }

/* Field card — mirror of CreateView's board picker. */
.lobby-board {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
.lobby-board:disabled { cursor: default; }
.lobby-board__art {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  background: #f0e9d9;
  flex-shrink: 0;
  line-height: 0;
}
.lobby-board__art :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.lobby-board__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lobby-board__name {
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
}
.lobby-board__desc {
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: #000;
  opacity: 0.85;
}
.lobby-board__edit {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  pointer-events: none;
}
/* ── Section label (Игроки / Твоя фишка below the Figma sections) ── */
.section-label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  margin: 0;
}
.players-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.players-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #000;
}

/* ── Players list (Figma 73:3611 player row) ── */
.players {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
}
.player-row--me { border-color: rgba(0, 0, 0, 0.24); }

.player-row__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.player-row__avatar--photo {
  object-fit: cover;
  background: #f0e9d9;
}
.player-row__avatar :deep(.sigil) {
  width: 40px !important;
  height: 40px !important;
  font-size: 16px !important;
  background: transparent !important;
  box-shadow: none !important;
}

.player-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.player-row__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-row__status {
  font-family: 'Golos Text', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}
.player-row__status--ready { color: #43c22d; }
.player-row__status--off   { color: #b32c2c; }

.player-row__action {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 120ms;
}
.player-row__action:hover { background: rgba(0, 0, 0, 0.04); }
.player-row__action--check {
  background: #43c22d;
  border-color: #43c22d;
  cursor: default;
}
.player-row__action--addfriend {
  background: #2283f3;
  border-color: #2283f3;
}
.player-row__action--addfriend:hover { background: #1a6dc7; }
.player-row__action--pendingfriend {
  background: #d6d6d6;
  border-color: rgba(0, 0, 0, 0.2);
  cursor: default;
}
.player-row__action--isfriend {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.18);
  color: #e84b3e;
  font-size: 14px;
  line-height: 14px;
  cursor: default;
}

/* ── Empty seat / Add bot row (Figma 93:8265) ── */
.seat-empty {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: 1.4px dashed rgba(0, 0, 0, 0.4);
  border-radius: 18px;
  text-align: left;
  font-family: 'Golos Text', sans-serif;
}
.seat-empty--addable {
  cursor: pointer;
  width: 100%;
  transition: background 120ms;
}
.seat-empty--addable:hover { background: rgba(0, 0, 0, 0.03); }
.seat-empty__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f0e9d9;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.seat-empty__name {
  flex: 1;
  min-width: 0;
  font-family: 'Golos Text', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 20px;
  color: #000;
}
.seat-empty__name--muted { color: rgba(0, 0, 0, 0.55); }
.seat-empty__plus {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #43c22d;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
}

/* ── Token picker (Figma 110:9549 — black 56×56 tiles with a 4px inner pad,
   a 12px radius and a 1px black-alpha border. Selected tile swaps that
   border for a 2px green ring; rarity halo on the cap shows through. */
.tokens-rail {
  display: flex;
  gap: 10px;
  padding: 4px 2px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tokens-rail::-webkit-scrollbar { display: none; }
.token-btn {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  /* `box-sizing: border-box` keeps the 56×56 footprint constant whether the
     border is the 1px idle line or the 2px green selected ring — otherwise
     the row jumps when the user picks a new cap. */
  box-sizing: border-box;
  background: #000;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  overflow: hidden;
  transition: transform 80ms ease, border-color 160ms ease;
}
.token-btn:active { transform: translateY(1px); }
.token-btn--selected {
  border: 2px solid #43c22d;
  /* CosmeticsCaps draws a 48px halo + ~57px cap that overflows the 48px
     content box. The tile clips it with overflow: hidden so the cap fits
     visually inside the green ring. */
}
.token-btn--taken { opacity: 0.35; cursor: not-allowed; }

/* ── Action CTAs (Figma 110:9441 / 110:9624 — ГОТОВ / НАЧАТЬ ПАРТИЮ).
   Designer feedback 2026-05-02 #3.10: CTA flows in-document, no sticky
   bottom-band — figma shows the button just below the token rail with
   the parchment lobby bg behind it, no separate fill. Lets the player
   list breathe naturally; the bottom safe-area pad still applies so
   on iPhone the CTA never tucks under the home indicator. */
.lobby-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 0;
  padding-bottom: var(--tg-safe-area-inset-bottom, 0px);
}
.lobby-hint {
  margin: 0;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  /* Figma renders the hint at full ink, not the muted grey we had —
     the prior 0.4 alpha read as too quiet for a status line that
     gates the Start CTA (#3.11). */
  color: rgba(0, 0, 0, 0.6);
}
.lobby-hint--ok { color: #43c22d; }

.lobby-cta {
  position: relative;
  width: 100%;
  height: 56px;
  padding: 0 18px;
  border: 2px solid #000;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease, filter 120ms ease;
}
.lobby-cta:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}
.lobby-cta:disabled { cursor: not-allowed; }

.lobby-cta--ready    { background: #2283f3; }
.lobby-cta--unready  { background: #f34822; }
.lobby-cta--start    { background: #43c22d; }
.lobby-cta--start-off { background: #b5b5b5; }

.lobby-cta__text {
  position: relative;
  z-index: 1;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.01em;
}
.lobby-cta__deco {
  position: absolute;
  top: 4px;
  right: 8px;
  width: 98px;
  height: 32.5px;
  pointer-events: none;
}

/* ── Invite players modal (Figma 133:15368) ─────────────────────────
   Backdrop covers the whole viewport, the modal itself docks to the
   bottom edge with a 76px gap so the "×" close circle (drawn outside
   the card) doesn't get clipped by the safe-area on small screens.
   The sticky lobby-actions bar can still be seen darkened behind the
   backdrop, matching the figma which keeps the lobby visible to remind
   the user where they are. */
.lobby-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 24px 24px calc(76px + var(--tg-safe-area-inset-bottom, 0px));
}
.lobby-modal {
  position: relative;
  width: 100%;
  max-width: 345px;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.lobby-modal__head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}
.lobby-modal__title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #000;
}
.lobby-modal__subtitle {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: #000;
}
.lobby-modal__friends {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lobby-modal__friends-head {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 26px;
  color: #000;
  text-align: center;
}
.lobby-friend {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  padding: 8px;
}
.lobby-friend__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lobby-friend__avatar :deep(.sigil) {
  width: 40px !important;
  height: 40px !important;
  font-size: 16px !important;
  background: transparent !important;
  box-shadow: none !important;
}
.lobby-friend__name {
  flex: 1;
  min-width: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lobby-friend__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 16px;
  color: #000;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 80ms ease, background 120ms ease;
}
.lobby-friend__pill:active { transform: scale(0.96); }
.lobby-friend__pill--invite {
  background: #56e63e;
  border: none;
}
.lobby-friend__pill--invite:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.lobby-friend__pill--invited {
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.lobby-cta--share {
  width: 100%;
  background: #2283f3;
}
.lobby-modal__close {
  margin-top: 12px;
  width: 44px;
  height: 44px;
  padding: 0;
  background: #fff;
  border: 4px solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 80ms ease;
}
.lobby-modal__close:active { transform: scale(0.92); }

/* Modal enter/leave animations */
.lobby-modal-enter-active, .lobby-modal-leave-active {
  transition: opacity 200ms ease;
}
.lobby-modal-enter-active .lobby-modal,
.lobby-modal-leave-active .lobby-modal {
  transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.lobby-modal-enter-from, .lobby-modal-leave-to { opacity: 0; }
.lobby-modal-enter-from .lobby-modal,
.lobby-modal-leave-to .lobby-modal {
  transform: translateY(24px);
}
</style>
