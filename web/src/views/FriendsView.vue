<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { computeRank } from "../utils/rank";
import Icon from "../components/Icon.vue";
import Sigil from "../components/Sigil.vue";
import { ORDERED_PLAYER_COLORS, PLAYER_COLORS } from "../utils/palette";

const router = useRouter();
const { locale } = useI18n();
const { userId, userName, haptic, notify } = useTelegram();

interface CoPlayer {
  tgUserId: number;
  name: string;
  avatar: string | null;
  gamesPlayed: number;
  gamesWon: number;
  totalEarned: number;
  winRate: number;
}

const players = ref<CoPlayer[]>([]);
const loading = ref(false);
const myProfile = ref<CoPlayer | null>(null);
const activeRoomId = ref<string | null>(null);
const invitingId = ref<number | null>(null);
const toast = ref<{ text: string; kind: "ok" | "err" } | null>(null);

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Друзья",
      subtitle: "Твой список",
      games: "Игр",
      wins: "Побед",
      winrate: "Winrate",
      comrades: "Соперники",
      roomBanner: (id: string) => `Твоя игра: ${id} — зови одним тапом`,
      noRoom: "Создай или войди в игру, чтобы позвать друзей",
      emptyTitle: "Пока никого нет",
      emptySub: "Пригласи друзей по ссылке и сыграй партию!",
      gamesMeta: (n: number) => `${n} игр`,
      invite: "Позвать",
      join: "Присоединиться",
      sending: "…",
      toastInviteNoRoom: "Сначала войди в игру",
      toastInviteOk: (name: string) => `Позвал ${name}`,
      toastNoChat: "Друг ещё не запускал бота",
      toastFail: (reason: string) => `Не вышло: ${reason}`,
      toastServerDown: "Сервер недоступен",
      refresh: "Обновить",
      back: "Назад",
    }
  : {
      title: "Friends",
      subtitle: "Your list",
      games: "Games",
      wins: "Wins",
      winrate: "Winrate",
      comrades: "Opponents",
      roomBanner: (id: string) => `Your game: ${id} — invite with one tap`,
      noRoom: "Create or join a game to invite friends",
      emptyTitle: "No friends yet",
      emptySub: "Invite friends via link and play a match!",
      gamesMeta: (n: number) => `${n} games`,
      invite: "Invite",
      join: "Join",
      sending: "…",
      toastInviteNoRoom: "Join a game first",
      toastInviteOk: (name: string) => `Invited ${name}`,
      toastNoChat: "Friend hasn't opened the bot yet",
      toastFail: (reason: string) => `Failed: ${reason}`,
      toastServerDown: "Server unavailable",
      refresh: "Refresh",
      back: "Back",
    });

function showToast(text: string, kind: "ok" | "err" = "ok") {
  toast.value = { text, kind };
  setTimeout(() => (toast.value = null), 2500);
}

async function load() {
  if (!userId.value) return;
  loading.value = true;
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const [me, friends] = await Promise.all([
      fetch(`${base}/api/users/${userId.value}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${base}/api/users/${userId.value}/coplayers`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    myProfile.value = me?.profile ?? null;
    players.value = friends?.players ?? [];
  } finally {
    loading.value = false;
  }
}

function refreshActiveRoom() {
  try { activeRoomId.value = localStorage.getItem("activeRoomId"); } catch { activeRoomId.value = null; }
}

async function invite(p: CoPlayer) {
  if (!activeRoomId.value) {
    showToast(L.value.toastInviteNoRoom, "err");
    return;
  }
  invitingId.value = p.tgUserId;
  haptic("light");
  try {
    const base = (import.meta.env.VITE_API_URL as string) || "";
    const res = await fetch(`${base}/api/invites/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tgUserId: p.tgUserId,
        roomId: activeRoomId.value,
        fromName: userName.value || "Игрок",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      notify("success");
      showToast(L.value.toastInviteOk(p.name));
    } else {
      notify("warning");
      const reason = data?.reason === "no chat access"
        ? L.value.toastNoChat
        : data?.error || data?.reason || (isRu.value ? "не доставлено" : "not delivered");
      showToast(L.value.toastFail(reason), "err");
    }
  } catch {
    notify("error");
    showToast(L.value.toastServerDown, "err");
  } finally {
    invitingId.value = null;
  }
}

function goBack() {
  haptic("light");
  router.back();
}

// Deterministic color per tgUserId so sigils stay stable.
function colorFor(id: number): string {
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return ORDERED_PLAYER_COLORS[Math.abs(hash) % ORDERED_PLAYER_COLORS.length];
}

function winratePct(p: CoPlayer): number {
  return p.gamesPlayed > 0 ? Math.round(p.winRate * 100) : 0;
}

function myWinratePct(): number {
  const me = myProfile.value;
  if (!me) return 0;
  return me.gamesPlayed > 0 ? Math.round((me.gamesWon / me.gamesPlayed) * 100) : 0;
}

onMounted(() => {
  refreshActiveRoom();
  load();
});
</script>

<template>
  <div class="app friends">
    <!-- Topbar -->
    <div class="topbar">
      <button class="icon-btn" :aria-label="L.back" @click="goBack">
        <Icon name="back" :size="18"/>
      </button>
      <div class="title">
        <h1>{{ L.title }}</h1>
        <div class="sub">{{ L.subtitle }}</div>
      </div>
      <button
        class="icon-btn"
        :aria-label="L.refresh"
        :disabled="loading"
        @click="load"
      >
        <span :class="{ spin: loading }" style="display: flex;">
          <Icon name="search" :size="18"/>
        </span>
      </button>
    </div>

    <div class="content">
      <!-- My stats card (ported from Vue ref: Sigil + name/rank + 3 shield stats) -->
      <div v-if="myProfile" class="card me-card">
        <div class="row" style="gap: 12px; margin-bottom: 12px;">
          <Sigil
            :name="userName || 'You'"
            :color="PLAYER_COLORS.you"
            :size="48"
          />
          <div style="flex: 1; min-width: 0;">
            <div class="me-card__name">
              {{ userName || (isRu ? "Игрок" : "Player") }}
            </div>
            <div
              class="me-card__rank"
              :style="{ color: computeRank(myProfile.gamesWon).color }"
            >
              {{ computeRank(myProfile.gamesWon).icon }}
              {{ computeRank(myProfile.gamesWon).label }}
            </div>
          </div>
        </div>
        <div class="stat-grid">
          <div class="shield-stat" style="--accent: var(--primary)">
            <div class="shield-stat__val">{{ myProfile.gamesPlayed }}</div>
            <div class="shield-stat__label">{{ L.games }}</div>
          </div>
          <div class="shield-stat" style="--accent: var(--emerald)">
            <div class="shield-stat__val">{{ myProfile.gamesWon }}</div>
            <div class="shield-stat__label">{{ L.wins }}</div>
          </div>
          <div class="shield-stat" style="--accent: var(--gold)">
            <div class="shield-stat__val">{{ myWinratePct() }}%</div>
            <div class="shield-stat__label">{{ L.winrate }}</div>
          </div>
        </div>
      </div>

      <!-- Active room banner / empty prompt -->
      <div v-if="activeRoomId" class="room-banner">
        <span class="room-banner__dot"/>
        <Icon name="send" :size="14" color="#f7eeda"/>
        <span class="room-banner__text">{{ L.roomBanner(activeRoomId) }}</span>
      </div>
      <div v-else class="card room-banner room-banner--muted">
        <Icon name="shield" :size="14" color="var(--ink-3)"/>
        <span>{{ L.noRoom }}</span>
      </div>

      <!-- Fleuron section divider (ported from Vue ref) -->
      <div class="fleuron">
        <div class="fleuron__line fleuron__line--l"/>
        <span class="fleuron__text">{{ L.comrades }}</span>
        <div class="fleuron__line fleuron__line--r"/>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && players.length === 0" class="card empty">
        <div class="empty__icon">
          <Icon name="users" :size="28" color="var(--ink-3)"/>
        </div>
        <div class="empty__title">{{ L.emptyTitle }}</div>
        <p>{{ L.emptySub }}</p>
      </div>

      <!-- Comrades list (Sigil + online dot per Vue ref) -->
      <div v-else class="comrades">
        <div
          v-for="p in players"
          :key="p.tgUserId"
          class="comrade"
        >
          <div class="comrade__avatar">
            <Sigil :name="p.name" :color="colorFor(p.tgUserId)" :size="36"/>
            <!-- status dot: online-proxy by gamesPlayed; kept subtle since we have no live presence. -->
            <div
              class="comrade__dot-ind"
              :style="{ background: p.gamesPlayed > 0 ? 'var(--gold)' : 'var(--ink-4)' }"
            />
          </div>
          <div class="comrade__body">
            <div class="comrade__name">{{ p.name }}</div>
            <div class="comrade__meta">
              <span
                class="comrade__rank"
                :style="{ color: computeRank(p.gamesWon).color }"
              >
                {{ computeRank(p.gamesWon).icon }}
                {{ computeRank(p.gamesWon).label }}
              </span>
              <span class="comrade__dot">·</span>
              <span>{{ L.gamesMeta(p.gamesPlayed) }}</span>
              <span class="comrade__dot">·</span>
              <span class="comrade__trophy">
                <Icon name="trophy" :size="11" color="var(--gold)"/>
                {{ p.gamesWon }}
              </span>
              <span class="comrade__dot">·</span>
              <span>{{ winratePct(p) }}%</span>
            </div>
          </div>
          <button
            class="btn btn-primary comrade__btn"
            :disabled="!activeRoomId || invitingId === p.tgUserId"
            @click="invite(p)"
          >
            <span v-if="invitingId === p.tgUserId">{{ L.sending }}</span>
            <template v-else>
              <Icon name="send" :size="12" color="#fff"/>
              <span>{{ L.invite }}</span>
            </template>
          </button>
        </div>
      </div>
    </div>

    <transition name="toast">
      <div v-if="toast" class="toast" :class="`toast--${toast.kind}`">
        <Icon
          :name="toast.kind === 'ok' ? 'check' : 'x'"
          :size="14"
          :color="toast.kind === 'ok' ? '#fff' : '#fff'"
        />
        <span>{{ toast.text }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--bg);
}

.icon-btn :deep(svg) { color: var(--ink-2); }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* My stats card */
.me-card {
  margin-bottom: 14px;
  padding: 14px;
}
.me-card__name {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.me-card__rank {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  margin-top: 2px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.shield-stat {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.shield-stat::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
}
.shield-stat__val {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--ink);
  font-weight: 400;
  letter-spacing: 0.02em;
}
.shield-stat__label {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 2px;
}

/* Active room banner */
.room-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--line);
  font-family: var(--font-body);
  font-size: 13px;
  color: #f7eeda;
  background:
    radial-gradient(ellipse at 85% 15%, rgba(184, 137, 46, 0.22) 0%, transparent 55%),
    linear-gradient(135deg, #4a2e82 0%, #2d1a5a 100%);
  box-shadow: 0 2px 6px rgba(62, 34, 114, 0.25);
  position: relative;
  overflow: hidden;
  animation: banner-pulse 2.4s ease-in-out infinite;
}
.room-banner__text {
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}
.room-banner__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold-soft);
  animation: pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}
.room-banner--muted {
  color: var(--ink-3);
  background: var(--card);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  animation: none;
  justify-content: center;
  text-align: center;
  font-size: 12px;
}
@keyframes pulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
@keyframes banner-pulse {
  0%, 100% { box-shadow: 0 2px 6px rgba(62, 34, 114, 0.25); }
  50%      { box-shadow: 0 2px 12px rgba(62, 34, 114, 0.45); }
}

/* Fleuron divider */
.fleuron {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  color: var(--ink-3);
}
.fleuron__line {
  flex: 1;
  height: 1px;
}
.fleuron__line--l {
  background: linear-gradient(90deg, transparent, var(--line-strong));
}
.fleuron__line--r {
  background: linear-gradient(90deg, var(--line-strong), transparent);
}
.fleuron__text {
  font-size: 12px;
  font-family: var(--font-title);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

/* Empty state */
.empty {
  padding: 28px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(90, 58, 24, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty__title {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
}
.empty p {
  color: var(--ink-3);
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
}

/* Comrades list */
.comrades {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.comrade {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  font-family: var(--font-body);
  color: var(--ink);
  transition: transform 80ms, border-color 160ms;
}
.comrade:hover { border-color: var(--line-strong); }
.comrade__avatar {
  position: relative;
  flex-shrink: 0;
}
.comrade__dot-ind {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--card);
}
.comrade__body {
  flex: 1;
  min-width: 0;
}
.comrade__name {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.comrade__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}
.comrade__rank {
  font-weight: 600;
  letter-spacing: 0.03em;
}
.comrade__dot {
  color: var(--ink-4);
}
.comrade__trophy {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--gold);
}
.comrade__btn {
  padding: 6px 12px;
  font-size: 11px;
  flex-shrink: 0;
}

/* Toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(80px + var(--tg-safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body);
  color: #fff;
  box-shadow: 0 8px 24px rgba(42, 29, 16, 0.25);
  z-index: 100;
  max-width: calc(100% - 36px);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast--ok {
  background: linear-gradient(180deg, var(--emerald-soft), var(--emerald));
  border: 1px solid var(--emerald);
}
.toast--err {
  background: linear-gradient(180deg, var(--accent-soft), var(--accent));
  border: 1px solid var(--accent);
}
.toast-enter-active, .toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
