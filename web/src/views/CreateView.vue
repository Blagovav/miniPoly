<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { useWs } from "../composables/useWs";
import { useGameStore } from "../stores/game";

const { t } = useI18n();
const router = useRouter();
const { initData, userName, haptic } = useTelegram();

const isPublic = ref(true);
const maxPlayers = ref(4);
const loading = ref(false);

const ws = useWs();
const game = useGameStore();

const off = ws.onMessage((m) => {
  game.applyMessage(m);
  if (m.type === "joined") {
    router.replace({ name: "room", params: { id: m.roomId } });
  }
});
onUnmounted(off);

function create() {
  haptic("medium");
  loading.value = true;
  ws.send({
    type: "create",
    tgInitData: initData.value,
    name: userName.value,
    isPublic: isPublic.value,
    maxPlayers: maxPlayers.value,
  });
}
</script>

<template>
  <div class="create">
    <header class="create__head">
      <button class="btn btn--ghost back" @click="router.back()">←</button>
      <h2 class="title">{{ t("home.create") }}</h2>
    </header>

    <div class="card form">
      <div class="asname">
        <span class="asname__label">{{ t("home.yourName") }}</span>
        <span class="asname__value">{{ userName }}</span>
        <button class="btn btn--ghost asname__edit" @click="router.push({ name: 'home' })">
          ✏️
        </button>
      </div>

      <div class="toggle">
        <button
          :class="['toggle__btn', isPublic && 'active']"
          @click="isPublic = true"
        >
          🌐 {{ t("home.public") }}
        </button>
        <button
          :class="['toggle__btn', !isPublic && 'active']"
          @click="isPublic = false"
        >
          🔒 {{ t("home.private") }}
        </button>
      </div>

      <div class="players-field">
        <div class="players-field__head">
          <span>Игроков в комнате</span>
          <span class="players-field__val">{{ maxPlayers }}</span>
        </div>
        <div class="players-field__row">
          <button
            v-for="n in [2, 3, 4, 5, 6]"
            :key="n"
            :class="['players-field__btn', maxPlayers === n && 'active']"
            @click="maxPlayers = n"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <button class="btn btn--primary big" :disabled="loading" @click="create">
        ✨ {{ t("home.create") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.create {
  padding: 18px;
  max-width: 480px;
  margin: 0 auto;
}
.create__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.back {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 12px;
}
.form {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.asname {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.asname__label {
  font-size: 11px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.asname__value {
  flex: 1;
  font-weight: 700;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asname__edit {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 10px;
  font-size: 14px;
}
.toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 14px;
  border: 1px solid var(--border);
}
.toggle__btn {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  color: var(--text-dim);
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}
.toggle__btn.active {
  background: linear-gradient(135deg, var(--purple), #7e22ce);
  color: #fff;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
}
.big {
  padding: 16px;
  font-size: 16px;
}
.players-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.players-field__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-dim);
}
.players-field__val {
  font-weight: 800;
  font-size: 18px;
  color: var(--gold);
}
.players-field__row {
  display: flex;
  gap: 6px;
}
.players-field__btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-weight: 700;
  font-size: 15px;
  transition: all 0.2s ease;
}
.players-field__btn.active {
  background: linear-gradient(135deg, var(--purple), #7e22ce);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);
}
</style>
