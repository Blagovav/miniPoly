<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { PublicRoomSummary } from "../../../shared/types";
import { useTelegram } from "../composables/useTelegram";

const { t } = useI18n();
const router = useRouter();
const { haptic } = useTelegram();

const rooms = ref<PublicRoomSummary[]>([]);
const loading = ref(false);

const API_URL = (import.meta.env.VITE_API_URL as string) || "";

async function load() {
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/api/rooms/public`);
    const data = await res.json();
    rooms.value = data.rooms ?? [];
  } finally {
    loading.value = false;
  }
}

function join(id: string) {
  haptic("medium");
  router.push({ name: "room", params: { id } });
}

onMounted(load);
</script>

<template>
  <div class="rooms">
    <header class="rooms__head">
      <button class="btn btn--ghost back" @click="router.back()">←</button>
      <h2 class="title">{{ t("rooms.title") }}</h2>
      <button class="btn btn--ghost refresh" :disabled="loading" @click="load">
        <span :class="{ spin: loading }">🔄</span>
      </button>
    </header>

    <div v-if="rooms.length === 0" class="empty card">
      <div class="empty__icon">🎲</div>
      <p>{{ t("rooms.empty") }}</p>
      <button class="btn btn--primary" @click="router.push({ name: 'create' })">
        ✨ {{ t("home.create") }}
      </button>
    </div>

    <div v-else class="rooms__list">
      <button
        v-for="r in rooms"
        :key="r.id"
        class="room-card"
        @click="join(r.id)"
      >
        <div class="room-card__left">
          <div class="room-card__code">{{ r.id }}</div>
          <div class="room-card__host">👤 {{ r.hostName }}</div>
        </div>
        <div class="room-card__right">
          <div class="room-card__players">
            {{ r.playerCount }} / {{ r.maxPlayers }}
          </div>
          <div class="room-card__cta">{{ t("rooms.join") }} →</div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rooms {
  padding: 18px;
  max-width: 560px;
  margin: 0 auto;
}
.rooms__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.rooms__head .title { flex: 1; font-size: 22px; }
.back, .refresh {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 12px;
}
.spin { animation: spin 0.8s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.empty {
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}
.empty__icon { font-size: 48px; }
.empty p { color: var(--text-dim); margin: 0; }

.rooms__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.room-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  text-align: left;
  transition: all 0.2s ease;
  backdrop-filter: blur(12px);
}
.room-card:hover {
  border-color: var(--neon);
  box-shadow: 0 0 0 1px var(--neon), 0 8px 24px -10px rgba(34, 197, 94, 0.45);
  transform: translateY(-1px);
}
.room-card__code {
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #fff, var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.room-card__host { color: var(--text-dim); font-size: 13px; margin-top: 2px; }
.room-card__right { text-align: right; }
.room-card__players {
  font-weight: 700;
  color: var(--neon);
}
.room-card__cta { color: var(--text-mute); font-size: 12px; margin-top: 2px; }
</style>
