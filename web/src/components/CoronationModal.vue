<script setup lang="ts">
/**
 * End-of-game results modal — Figma 132:1746 / 133:2189 / 133:2566 /
 * 133:2940 / 133:3573 (rank 1 / 2 / 3 / 4 / scrolled list).
 *
 * Renders one of four rank states for the local player:
 *   - rank 1 → "Победа" (gold)        + trophy hero
 *   - rank 2 → "2 место" (silver)     + trophy hero
 *   - rank 3 → "3 место" (bronze)     + trophy hero
 *   - rank 4+ → "N место" (grey)      + four-monopoly hero
 *
 * Player cards are sorted by cash desc (bankrupt last) and tinted by rank
 * (gold/silver/bronze + neutral for 4+). Bottom sticky CTAs route back to
 * the menu or kick a rematch.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { OwnedProperty, Player } from "../../../shared/types";
import { capTypeFor, SHOP_CAPS } from "../shop/cosmetics";
import type { Rarity } from "./RarityGlow.vue";
import CosmeticsCaps from "./CosmeticsCaps.vue";

const props = defineProps<{
  open: boolean;
  players: readonly Player[];
  myId: string | null;
  hostId?: string | null;
  properties: Record<number, OwnedProperty>;
  onClose: () => void;
  onPlayAgain?: () => void;
  onConfigure?: () => void;
  onReadyToggle?: () => void;
  // Friend integration (Figma 166:3320 / 166:3792 / 166:4212 / 166:4614).
  // Optional so the modal stays renderable in storybook-style previews
  // without the live store. When `onFriendRequest` is omitted, the
  // per-row "+" / check pills hide entirely.
  friendIds?: Set<number>;
  sentFriendRequests?: Set<number>;
  onFriendRequest?: (toUserId: number) => void;
  // Tapping a player row opens their full profile (assets, history,
  // etc.). When omitted, the row stays inert — same fallback as the
  // friend pill above so storybook previews keep working.
  onProfileOpen?: (player: Player) => void;
}>();

const { locale } = useI18n();
const isRu = computed(() => locale.value === "ru");

// Cash desc, bankrupt last — bankrupts can't outrank anyone alive even if
// their stale `cash` snapshot is higher than a live player who just paid rent.
type Ranked = { player: Player; rank: number; propertyCount: number };

const CAP_RARITY = new Map<string, Rarity>(
  SHOP_CAPS.map((c) => [c.id, c.rarity] as const),
);

const ranked = computed<Ranked[]>(() => {
  const propsByOwner = new Map<string, number>();
  for (const op of Object.values(props.properties)) {
    propsByOwner.set(op.ownerId, (propsByOwner.get(op.ownerId) ?? 0) + 1);
  }
  const sorted = [...props.players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return b.cash - a.cash;
  });
  return sorted.map((player, i) => ({
    player,
    rank: i + 1,
    propertyCount: propsByOwner.get(player.id) ?? 0,
  }));
});

const myRank = computed(() => {
  if (!props.myId) return 1;
  const found = ranked.value.find((r) => r.player.id === props.myId);
  return found?.rank ?? ranked.value.length;
});

// One illustration per rank (Figma 132:1746 / 133:2189 / 133:2566 / 133:2940).
// Rank 1-3 each get a distinct mascot+trophy combo (gold/silver/bronze cup);
// rank 4+ shares the four-mascot defeat scene since that's a single shared
// "you didn't podium" state in the design — the panel tint + place number
// already differentiates 4th from 5th, no need for separate art.
const heroSrc = computed(() => {
  const r = myRank.value;
  if (r === 1) return "/figma/coronation/v2/hero-1.webp";
  if (r === 2) return "/figma/coronation/v2/hero-2.webp";
  if (r === 3) return "/figma/coronation/v2/hero-3.webp";
  return "/figma/coronation/v2/hero-4.webp";
});

const titleText = computed(() => {
  const r = myRank.value;
  if (r === 1) return isRu.value ? "Победа" : "Victory";
  return isRu.value ? `${r} место` : `${ordinal(r)} place`;
});

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Reward decays by rank — the engine doesn't track per-place crowns yet, so
// we derive a display-only number from the leaderboard. Tweak if/when the
// server starts handing out rank-based rewards.
const myReward = computed(() => {
  const r = myRank.value;
  if (r === 1) return 2412;
  if (r === 2) return 911;
  if (r === 3) return 242;
  return Math.max(5, Math.round(60 / (r - 2)));
});

// Per-row trophy icon — figma uses 3 distinct cup illustrations on the
// gold/silver/bronze rows; 4th+ rows fall back to the "N" number badge
// rendered by the template.
function trophyArt(rank: number): string | null {
  if (rank === 1) return "/figma/coronation/v2/trophy-gold.webp";
  if (rank === 2) return "/figma/coronation/v2/trophy-silver.webp";
  if (rank === 3) return "/figma/coronation/v2/trophy-bronze.webp";
  return null;
}

function capRarityFor(token: string | undefined): Rarity {
  if (!token) return "common";
  return CAP_RARITY.get(token) ?? "common";
}

function fmt(n: number): string {
  // Figma shows numbers without thousand separators ("4223" / "+2412"); the
  // game's actual cash values rarely exceed 5 digits so the lack of grouping
  // doesn't hurt readability.
  return String(n);
}

function onCloseClick() {
  props.onClose();
}

// ── Restart flow (Figma 133:3980 / 133:4390 / 133:4794 / 133:5203) ──────
// Host taps "СЫГРАТЬ СНОВА" → modal flips straight into a "ready check"
// state mirroring the lobby's readiness UX (green check pill per ready
// player + grey/green НАЧАТЬ button). When every player has flipped
// ready=true, the host sees an extra "Партия готова" prompt overlaid on
// top (Figma 133:5203 / popup-info 133:5597) offering two routes:
//   - НАСТРОИТЬ ИГРУ → bounces to /create so the host can change rules
//   - НАЧАТЬ СРАЗУ   → forwards onPlayAgain (same as the underlying НАЧАТЬ)
// The prompt is gated on all-ready because reconfiguration invalidates
// the readiness pass anyway, so showing it earlier just adds a click.
// Server protocol for an in-place restart isn't wired up yet — actions
// emit upward and the parent decides where to route.
type UiState = "results" | "ready-check";
const uiState = ref<UiState>("results");

watch(
  () => props.open,
  (open) => {
    if (!open) uiState.value = "results";
  },
);

// "Партия готова" overlay visibility — auto-shown the moment all players
// have toggled ready while the host is in ready-check. The host can
// dismiss it (tap outside) and still use the underlying НАЧАТЬ button;
// if anyone un-readies and then everyone re-readies, it pops back up.
const allReadyPromptShown = ref(false);
const allReadyPromptDismissed = ref(false);

const isHost = computed(() =>
  !!props.hostId && !!props.myId && props.hostId === props.myId,
);

const readyCount = computed(
  () => props.players.filter((p) => p.ready).length,
);
const totalCount = computed(() => props.players.length);
const allReady = computed(
  () => totalCount.value > 0 && readyCount.value === totalCount.value,
);
const remainingReady = computed(
  () => Math.max(0, totalCount.value - readyCount.value),
);
const me = computed(
  () => props.players.find((p) => p.id === props.myId) ?? null,
);

const readyHint = computed(() => {
  if (!isHost.value) {
    if (me.value?.ready) {
      return isRu.value ? "Ожидаем других игроков" : "Waiting for others";
    }
    return isRu.value ? "Подтвердите готовность" : "Confirm you're ready";
  }
  if (allReady.value) {
    return isRu.value ? "Все игроки готовы" : "All players are ready";
  }
  return isRu.value
    ? `Ждём готовности: ещё ${remainingReady.value}`
    : `Waiting for ${remainingReady.value} more`;
});

function onPlayAgainClick() {
  // Host's "СЫГРАТЬ СНОВА" jumps straight into ready-check. The choice
  // popup ("Партия готова") only matters once everyone is ready — see
  // the watcher below. Non-host falls back to the legacy onPlayAgain
  // emit so the existing /rooms route still fires for them.
  if (isHost.value) {
    allReadyPromptDismissed.value = false;
    allReadyPromptShown.value = false;
    uiState.value = "ready-check";
    return;
  }
  if (props.onPlayAgain) props.onPlayAgain();
  else props.onClose();
}

function onChoiceConfigure() {
  allReadyPromptShown.value = false;
  // "Настроить игру" — host wants to tweak settings. Parent gets to pick
  // the destination (typically /create) so we don't hardcode router here.
  if (props.onConfigure) props.onConfigure();
  else if (props.onPlayAgain) props.onPlayAgain();
  else props.onClose();
}
function onChoiceStartNow() {
  // Identical to the underlying НАЧАТЬ — forwards onPlayAgain so the
  // parent can swap room.phase back to "lobby" / kick a fresh round.
  allReadyPromptShown.value = false;
  if (props.onPlayAgain) props.onPlayAgain();
  else props.onClose();
}
function onChoiceDismiss() {
  // User tapped the scrim. Don't re-show on the same all-ready streak;
  // they'll trigger it again if anyone un-readies and re-readies.
  allReadyPromptShown.value = false;
  allReadyPromptDismissed.value = true;
}
function onCancelRestart() {
  uiState.value = "results";
  allReadyPromptShown.value = false;
  allReadyPromptDismissed.value = false;
}
function onStartGame() {
  // "НАЧАТЬ" — host commits to launching the next match. Forwarded to the
  // existing onPlayAgain handler since that's the closest semantic match
  // until a real restart RPC exists.
  if (props.onPlayAgain) props.onPlayAgain();
  else props.onClose();
}
function onReadyToggleClick() {
  if (props.onReadyToggle) props.onReadyToggle();
}

// ── In-game friend invite (Figma 166:3320 / 166:3792 / 166:4212) ───
// Per-row "+" / check pill. Mirrors Lobby.vue's friendStateFor so the
// state machine stays in one canonical shape across both surfaces.
type FriendState = "self" | "bot" | "friend" | "pending" | "none";
function friendStateFor(p: Player): FriendState {
  if (p.isBot) return "bot";
  if (p.id === props.myId) return "self";
  if (props.friendIds?.has(p.tgUserId)) return "friend";
  if (props.sentFriendRequests?.has(p.tgUserId)) return "pending";
  return "none";
}

// Sender confirmation popup (Figma 166:3792). Tapping "+" opens it; the
// invite isn't fired until the user confirms with «ПРИГЛАСИТЬ» — the
// designer wants this to be a deliberate action, not a tap-and-regret
// like the lobby's instant-send button.
const inviteTarget = ref<Player | null>(null);
function startInvite(p: Player) {
  if (!props.onFriendRequest) return;
  inviteTarget.value = p;
}
function cancelInvite() {
  inviteTarget.value = null;
}
function confirmInvite() {
  const p = inviteTarget.value;
  if (!p || !props.onFriendRequest) {
    inviteTarget.value = null;
    return;
  }
  props.onFriendRequest(p.tgUserId);
  inviteTarget.value = null;
}

// Tapping a row's avatar/name opens the existing PlayerProfileModal.
// Bots have no real profile — and tapping yourself just to see your own
// stats reads as noise — so both are no-ops.
function openRowProfile(p: Player) {
  if (!props.onProfileOpen) return;
  if (p.isBot) return;
  if (p.id === props.myId) return;
  props.onProfileOpen(p);
}

// Auto-surface the "Партия готова" prompt once everyone's ready. Reset
// the dismissed flag the moment readiness drops, so the prompt re-fires
// on the next clean all-ready streak. Only the host ever sees it.
watch(
  () => [uiState.value, isHost.value, allReady.value] as const,
  ([state, host, ready]) => {
    if (state !== "ready-check" || !host) {
      allReadyPromptShown.value = false;
      return;
    }
    if (!ready) {
      allReadyPromptShown.value = false;
      allReadyPromptDismissed.value = false;
      return;
    }
    if (!allReadyPromptDismissed.value) allReadyPromptShown.value = true;
  },
);
</script>

<template>
  <transition name="cor-fade">
    <div v-if="open" class="cor-overlay">
      <div class="cor-card" :class="`cor-card--rank-${Math.min(myRank, 4)}`">
        <!-- Hero illustration peeking out of the top of the card -->
        <div class="cor-hero">
          <img :src="heroSrc" alt="" class="cor-hero__img" draggable="false"/>
        </div>

        <!-- Title block -->
        <div class="cor-title">
          <p class="cor-title__eyebrow">
            {{ isRu ? "Партия завершена" : "Game over" }}
          </p>
          <p class="cor-title__rank">{{ titleText }}</p>
        </div>

        <!-- Reward chip -->
        <div class="cor-reward">
          <img src="/figma/coronation/v2/crown.webp" alt="" class="cor-reward__icon"/>
          <span class="cor-reward__amount">+{{ fmt(myReward) }}</span>
        </div>

        <!-- Players leaderboard (scrolls when the list is taller than the panel) -->
        <div class="cor-leaders">
          <div class="cor-leaders__scroll">
            <div
              v-for="entry in ranked"
              :key="entry.player.id"
              class="cor-row"
              :class="[
                `cor-row--rank-${Math.min(entry.rank, 4)}`,
                { 'cor-row--me': entry.player.id === myId },
              ]"
            >
              <!-- Rank trophy / "N" badge -->
              <div class="cor-row__trophy">
                <img v-if="trophyArt(entry.rank)" :src="trophyArt(entry.rank)!" alt=""/>
                <span v-else class="cor-row__trophy-num">{{ entry.rank }}</span>
              </div>

              <!-- Tap target — cap + name + stats. Wrapped in a button so
                   tapping the avatar/name opens the player's profile while
                   the trophy column and the right-side friend pill keep
                   their own click semantics. Inert for bots / self. -->
              <button
                type="button"
                class="cor-row__main"
                :class="{ 'cor-row__main--inert': !onProfileOpen || entry.player.isBot || entry.player.id === myId }"
                :disabled="!onProfileOpen || entry.player.isBot || entry.player.id === myId"
                :aria-label="isRu ? `Профиль ${entry.player.name}` : `${entry.player.name}'s profile`"
                @click="openRowProfile(entry.player)"
              >
                <!-- Token (cap) -->
                <div class="cor-row__cap">
                  <CosmeticsCaps
                    :type="capTypeFor(entry.player.token)"
                    :rarity="capRarityFor(entry.player.token)"
                    :size="32"
                  />
                </div>

                <!-- Name + stats -->
                <div class="cor-row__text">
                  <p class="cor-row__name">{{ entry.player.name }}</p>
                  <div class="cor-row__stats">
                    <span class="cor-row__stat">
                      <img src="/figma/room/icon-money.webp" alt=""/>
                      {{ fmt(entry.player.cash) }}
                    </span>
                    <span class="cor-row__stat">
                      <img src="/figma/room/icon-chair.webp" alt=""/>
                      {{ entry.propertyCount }}
                    </span>
                  </div>
                </div>
              </button>

              <!-- Ready check pill — only visible during the host's restart
                   ready-check state (Figma 133:3980 / 133:4390 / 133:4794). -->
              <span
                v-if="uiState === 'ready-check' && entry.player.ready"
                class="cor-row__ready"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                  <path
                    d="M5 12.5l4.2 4.2L19 7"
                    stroke="#fff"
                    stroke-width="2.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>

              <!-- Friend invite pill — Figma 166:3320 / 166:4212.
                   Hidden during ready-check so the readiness check doesn't
                   compete with the invite control. Three states:
                     none   → "+" tap-target, opens the invite confirm
                     pending→ small check (request sent, awaiting accept)
                     friend → green check (already friends) -->
              <template v-if="uiState !== 'ready-check' && onFriendRequest">
                <button
                  v-if="friendStateFor(entry.player) === 'none'"
                  type="button"
                  class="cor-row__friend cor-row__friend--add"
                  :aria-label="isRu ? 'Пригласить в друзья' : 'Send friend request'"
                  @click="startInvite(entry.player)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="#000"
                      stroke-width="2.4"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
                <span
                  v-else-if="friendStateFor(entry.player) === 'pending'"
                  class="cor-row__friend cor-row__friend--pending"
                  :aria-label="isRu ? 'Заявка отправлена' : 'Request pending'"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                    <path
                      d="M5 12.5l4.2 4.2L19 7"
                      stroke="#000"
                      stroke-width="2.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span
                  v-else-if="friendStateFor(entry.player) === 'friend'"
                  class="cor-row__friend cor-row__friend--ok"
                  :aria-label="isRu ? 'Уже в друзьях' : 'Already friends'"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                    <path
                      d="M5 12.5l4.2 4.2L19 7"
                      stroke="#fff"
                      stroke-width="2.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              </template>
            </div>
          </div>
        </div>

        <!-- ── Sticky CTAs.
             results state    → ВЫЙТИ В МЕНЮ + СЫГРАТЬ СНОВА (host) / ПОВТОРИТЬ (guest)
             ready-check host → ВЫЙТИ В МЕНЮ + НАЧАТЬ (grey/green) + close ×
             ready-check guest → ГОТОВ / НЕ ГОТОВ
             A "ready hint" line appears under the CTAs in ready-check mode
             so the user knows whether the bar's stuck on someone else. -->
        <div class="cor-cta">
          <template v-if="uiState !== 'ready-check'">
            <button class="cor-btn cor-btn--menu" @click="onCloseClick">
              {{ isRu ? "ВЫЙТИ В МЕНЮ" : "BACK TO MENU" }}
            </button>
            <button class="cor-btn cor-btn--again" @click="onPlayAgainClick">
              {{ isRu ? "СЫГРАТЬ СНОВА" : "PLAY AGAIN" }}
            </button>
          </template>

          <template v-else-if="isHost">
            <button class="cor-btn cor-btn--menu" @click="onCloseClick">
              {{ isRu ? "ВЫЙТИ В МЕНЮ" : "BACK TO MENU" }}
            </button>
            <div class="cor-cta__row">
              <button
                class="cor-btn cor-btn--start"
                :class="{ 'cor-btn--start-off': !allReady }"
                :disabled="!allReady"
                @click="onStartGame"
              >
                {{ isRu ? "НАЧАТЬ" : "START" }}
              </button>
              <button
                class="cor-btn cor-btn--cancel-restart"
                :aria-label="isRu ? 'Отменить' : 'Cancel'"
                @click="onCancelRestart"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="#fff"
                    stroke-width="2.4"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <p class="cor-cta__hint" :class="{ 'cor-cta__hint--ok': allReady }">
              {{ readyHint }}
            </p>
          </template>

          <template v-else>
            <button class="cor-btn cor-btn--menu" @click="onCloseClick">
              {{ isRu ? "ВЫЙТИ В МЕНЮ" : "BACK TO MENU" }}
            </button>
            <button
              class="cor-btn"
              :class="me?.ready ? 'cor-btn--unready' : 'cor-btn--ready'"
              @click="onReadyToggleClick"
            >
              {{ me?.ready ? (isRu ? "НЕ ГОТОВ" : "NOT READY") : (isRu ? "ГОТОВ" : "READY") }}
            </button>
            <p class="cor-cta__hint cor-cta__hint--ok">{{ readyHint }}</p>
          </template>
        </div>

        <!-- ── "Пригласить игрока в друзья?" sender confirm (Figma
             166:3792). Same bottom-sheet language as the ready-check
             prompt — the user explicitly confirms before the friend
             request fires, so an accidental tap on the per-row "+"
             can be cancelled. -->
        <transition name="cor-choice">
          <div
            v-if="inviteTarget"
            class="cor-choice-backdrop"
            @click.self="cancelInvite"
          >
            <div class="cor-choice-card">
              <div class="cor-choice-text">
                <h3 class="cor-choice-title">
                  {{ isRu ? "Пригласить игрока в друзья?" : "Send friend request?" }}
                </h3>
                <p class="cor-choice-sub">
                  {{
                    isRu
                      ? "Игрок, принявший приглашение, будет отображаться в вашем списке друзей. Приглашать игрока в вашу партию тоже станет проще"
                      : "Once the player accepts, they'll appear in your friend list and inviting them to future matches gets easier."
                  }}
                </p>
              </div>
              <div class="cor-choice-buttons">
                <button class="cor-btn cor-btn--cancel-invite" @click="cancelInvite">
                  {{ isRu ? "ОТМЕНА" : "CANCEL" }}
                </button>
                <button class="cor-btn cor-btn--again" @click="confirmInvite">
                  {{ isRu ? "ПРИГЛАСИТЬ" : "INVITE" }}
                </button>
              </div>
            </div>
          </div>
        </transition>

        <!-- ── "Партия готова" choice popup (Figma 133:5203 / popup-info
             133:5597). Bottom-anchored card overlaid on the ready-check
             once every player has flipped ready. Host can tap outside to
             dismiss and use the underlying НАЧАТЬ instead. -->
        <transition name="cor-choice">
          <div
            v-if="allReadyPromptShown"
            class="cor-choice-backdrop"
            @click.self="onChoiceDismiss"
          >
            <div class="cor-choice-card">
              <div class="cor-choice-text">
                <h3 class="cor-choice-title">
                  {{ isRu ? "Партия готова" : "Match is ready" }}
                </h3>
                <p class="cor-choice-sub">
                  {{
                    isRu
                      ? "Вы можете начать партию сразу, либо изменить настройки"
                      : "Start the match immediately, or change the settings first"
                  }}
                </p>
              </div>
              <div class="cor-choice-buttons">
                <button class="cor-btn cor-btn--menu" @click="onChoiceConfigure">
                  {{ isRu ? "НАСТРОИТЬ ИГРУ" : "CONFIGURE" }}
                </button>
                <button class="cor-btn cor-btn--again" @click="onChoiceStartNow">
                  {{ isRu ? "НАЧАТЬ СРАЗУ" : "START NOW" }}
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cor-overlay {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  padding-bottom: calc(24px + var(--tg-safe-area-inset-bottom, 0px));
  overflow: hidden;
}

.cor-card {
  position: relative;
  width: 100%;
  max-width: 345px;
  height: 100%;
  max-height: 744px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: linear-gradient(
      180deg,
      rgba(225, 201, 42, 0.2) 0%,
      rgba(225, 201, 42, 0) 60%
    ),
    #000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Rank-tinted glow at the top of the panel — gold by default, silver for
   rank 2, bronze for rank 3, neutral grey for 4+. */
.cor-card--rank-2 {
  background: linear-gradient(
      180deg,
      rgba(195, 214, 237, 0.22) 0%,
      rgba(195, 214, 237, 0) 60%
    ),
    #000;
}
.cor-card--rank-3 {
  background: linear-gradient(
      180deg,
      rgba(205, 127, 50, 0.22) 0%,
      rgba(205, 127, 50, 0) 60%
    ),
    #000;
}
.cor-card--rank-4 {
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0) 60%
    ),
    #000;
}

/* ─── Hero illustration ─── */
.cor-hero {
  position: relative;
  flex-shrink: 0;
  height: 220px;
  margin: 0 -8px -32px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.cor-hero__img {
  width: 100%;
  max-width: 320px;
  height: 100%;
  object-fit: contain;
}

/* ─── Title block ─── */
.cor-title {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  text-align: center;
}
.cor-title__eyebrow {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #fffdf5;
}
.cor-title__rank {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 40px;
  line-height: 42px;
  color: #fcc101;
}
.cor-card--rank-2 .cor-title__rank {
  color: #c3d6ed;
}
.cor-card--rank-3 .cor-title__rank {
  color: #cd7f32;
}
.cor-card--rank-4 .cor-title__rank {
  color: #d8d8d8;
}

/* ─── Reward (crown + +N) ─── */
.cor-reward {
  flex-shrink: 0;
  margin: 16px auto 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cor-reward__icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
.cor-reward__amount {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 26px;
  color: #fffdf5;
}

/* ─── Leaderboard ─── */
.cor-leaders {
  flex: 1;
  min-height: 0;
  margin: 0 24px;
  display: flex;
  flex-direction: column;
}
.cor-leaders__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}
.cor-leaders__scroll::-webkit-scrollbar { width: 2px; }
.cor-leaders__scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.4);
  border-radius: 2px;
}

/* ─── Player row ─── */
.cor-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  position: relative;
}
.cor-row--rank-1 {
  background: linear-gradient(
    180deg,
    #fcc101 0%,
    rgba(255, 242, 199, 0.6) 50%,
    #fcc101 50.4%,
    #fcc101 100%
  );
}
.cor-row--rank-2 {
  background: linear-gradient(
    180deg,
    #c3d6ed 0%,
    rgba(255, 255, 255, 0.6) 50%,
    #c3d6ed 50.4%,
    #c3d6ed 100%
  );
}
.cor-row--rank-3 {
  background: linear-gradient(
    180deg,
    #cd7f32 0%,
    rgba(255, 255, 255, 0.4) 50%,
    #cd7f32 50.4%,
    #cd7f32 100%
  );
}
.cor-row--rank-4 {
  background: linear-gradient(
    180deg,
    #4a4a52 0%,
    rgba(255, 255, 255, 0.18) 50%,
    #4a4a52 50.4%,
    #4a4a52 100%
  );
}
.cor-row--me {
  outline: 2px solid #fff;
  outline-offset: -1px;
}

.cor-row__trophy {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cor-row__trophy img {
  width: 50px;
  height: 50px;
  object-fit: contain;
  margin-top: -2px;
}
.cor-row__trophy-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  color: #fff;
}

/* Clickable avatar+name area. Strips the default <button> chrome so it
   reads as plain row content, then re-introduces a subtle press
   feedback when the row is actually interactive (not self / bot). */
.cor-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 80ms ease, filter 120ms ease;
}
.cor-row__main:not(.cor-row__main--inert):active {
  transform: translateY(1px);
  filter: brightness(0.95);
}
.cor-row__main--inert {
  cursor: default;
}

.cor-row__cap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cor-row__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cor-row__name {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cor-row__stats {
  display: flex;
  gap: 8px;
}
.cor-row__stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #000;
}
.cor-row__stat img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
/* On the dark "rank 4+" row the inverted-black stat text disappears, so
   flip the colour back to white. */
.cor-row--rank-4 .cor-row__stat {
  color: #fff;
}

/* ─── Sticky CTAs at the bottom of the card ─── */
.cor-cta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
}
.cor-btn {
  position: relative;
  height: 56px;
  border-radius: 18px;
  border: 2px solid #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  cursor: pointer;
  /* Inset bottom shadow on buttons is intentional: it's the 3D press
     affordance (lighter on press), not a decorative shadow. Kept on
     purpose alongside the deshadowing of the rest of the modal. */
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.2);
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}
.cor-btn:active {
  transform: translateY(2px);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}
.cor-btn--menu  { background: #a322f3; }
.cor-btn--again { background: #43c22d; }

/* ── Restart ready-check styling (Figma 133:3980 / 133:4390 / 133:4794) ── */
.cor-cta__row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.cor-btn--start {
  flex: 1;
  background: #43c22d;
}
.cor-btn--start-off {
  background: #b5b5b5;
  cursor: not-allowed;
}
.cor-btn--cancel-restart {
  flex-shrink: 0;
  width: 56px;
  background: #f34822;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cor-btn--ready   { background: #2283f3; }
.cor-btn--unready { background: #f34822; }

.cor-cta__hint {
  margin: -4px 0 0;
  text-align: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.55);
}
.cor-cta__hint--ok { color: #43c22d; }

.cor-row {
  /* allow the ready check pill to stay flush right without being clipped */
  position: relative;
}
.cor-row__ready {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #43c22d;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.2);
}

/* Friend invite pill (Figma 166:3320). Three visual states sharing the
   same 24px circular footprint so the row height never jumps as the
   button morphs between idle/pending/accepted. */
.cor-row__friend {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}
.cor-row__friend--add {
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: transform 80ms ease, background 120ms ease;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
}
.cor-row__friend--add:active {
  transform: translateY(1px);
  background: #fff;
}
.cor-row__friend--pending {
  background: rgba(255, 255, 255, 0.6);
}
.cor-row__friend--ok {
  background: #43c22d;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.2);
}

.cor-btn--cancel-invite {
  background: #f34822;
}

/* ── "Партия готова" choice popup (Figma 133:5203) — bottom-anchored card
   that overlays the results with a 40% scrim. Same parchment language as
   the lobby's other modals so the host reads it as part of the chrome. */
.cor-choice-backdrop {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 16px;
  border-radius: inherit;
}
.cor-choice-card {
  width: 100%;
  background: #faf3e2;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.cor-choice-text {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}
.cor-choice-title {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 24px;
  color: #000;
}
.cor-choice-sub {
  margin: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  color: #000;
}
.cor-choice-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cor-choice-buttons .cor-btn {
  width: 100%;
  border: 2px solid #000;
}
.cor-choice-enter-active, .cor-choice-leave-active {
  transition: opacity 200ms ease;
}
.cor-choice-enter-active .cor-choice-card,
.cor-choice-leave-active .cor-choice-card {
  transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.cor-choice-enter-from, .cor-choice-leave-to { opacity: 0; }
.cor-choice-enter-from .cor-choice-card,
.cor-choice-leave-to .cor-choice-card {
  transform: translateY(24px);
}

.cor-fade-enter-active,
.cor-fade-leave-active { transition: opacity 320ms ease; }
.cor-fade-enter-from,
.cor-fade-leave-to { opacity: 0; }
</style>
