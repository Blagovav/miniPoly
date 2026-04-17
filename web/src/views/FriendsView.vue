<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { computeRank } from "../utils/rank";

const router = useRouter();
const { userId } = useTelegram();

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

onMounted(load);
</script>

<template>
  <div class="friends">
    <header class="friends__head">
      <button class="btn btn--ghost back" @click="router.back()">←</button>
      <h2 class="title">Друзья</h2>
      <button class="btn btn--ghost refresh" :disabled="loading" @click="load">
        <span :class="{ spin: loading }">🔄</span>
      </button>
    </header>

    <div v-if="myProfile" class="card me-card">
      <div class="me-card__head">Моя статистика</div>
      <div class="me-card__row">
        <div class="stat">
          <span class="stat__label">Игр</span>
          <span class="stat__val">{{ myProfile.gamesPlayed }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Побед</span>
          <span class="stat__val">🏆 {{ myProfile.gamesWon }}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Winrate</span>
          <span class="stat__val">
            {{ myProfile.gamesPlayed > 0
              ? Math.round((myProfile.gamesWon / myProfile.gamesPlayed) * 100)
              : 0 }}%
          </span>
        </div>
      </div>
    </div>

    <div class="section-title">С кем играл</div>
    <div v-if="players.length === 0" class="empty card">
      <div class="empty__icon">👥</div>
      <p>Пока ещё не с кем.<br>Пригласи друзей по ссылке и сыграй партию!</p>
    </div>
    <div v-else class="list">
      <div v-for="p in players" :key="p.tgUserId" class="player-row">
        <div class="player-row__avatar">
          {{ p.name.slice(0, 1).toUpperCase() }}
        </div>
        <div class="player-row__body">
          <div class="player-row__name">
            {{ p.name }}
            <span class="player-row__rank" :style="{ color: computeRank(p.gamesWon).color }">
              {{ computeRank(p.gamesWon).icon }} {{ computeRank(p.gamesWon).label }}
            </span>
          </div>
          <div class="player-row__stats">
            {{ p.gamesPlayed }} игр · 🏆 {{ p.gamesWon }}
          </div>
        </div>
        <div class="player-row__winrate">
          {{ p.gamesPlayed > 0 ? Math.round(p.winRate * 100) : 0 }}%
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.friends {
  padding: 18px;
  max-width: 560px;
  margin: 0 auto;
}
.friends__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.friends__head .title { flex: 1; font-size: 22px; }
.back, .refresh {
  width: 40px; height: 40px; padding: 0; border-radius: 12px;
}
.spin { animation: spin 0.8s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.me-card {
  padding: 14px 16px;
  margin-bottom: 14px;
}
.me-card__head {
  font-size: 11px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}
.me-card__row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stat { display: flex; flex-direction: column; gap: 2px; align-items: center; }
.stat__label { font-size: 11px; color: var(--text-dim); }
.stat__val { font-weight: 800; font-size: 18px; }

.section-title {
  font-size: 12px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0 4px 8px;
}
.empty {
  padding: 32px 18px;
  text-align: center;
  color: var(--text-dim);
}
.empty__icon { font-size: 44px; margin-bottom: 10px; }
.empty p { margin: 0; font-size: 13px; line-height: 1.5; }

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  backdrop-filter: blur(10px);
}
.player-row__avatar {
  width: 40px; height: 40px; border-radius: 12px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--purple), #7e22ce);
  color: #fff;
  font-weight: 800;
}
.player-row__body { flex: 1; }
.player-row__name {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.player-row__rank {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
}
.player-row__stats { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.player-row__winrate {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--neon);
}
</style>
