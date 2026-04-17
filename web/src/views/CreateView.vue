<script setup lang="ts">
import { computed, ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useTelegram } from "../composables/useTelegram";
import { useWs } from "../composables/useWs";
import { useGameStore } from "../stores/game";
import Icon from "../components/Icon.vue";

const { locale } = useI18n();
const router = useRouter();
const { initData, userName, haptic } = useTelegram();

// Access: design-ref uses `isPrivate`; we keep our existing `isPublic` wiring (negated in template).
const isPublic = ref(true);
const maxPlayers = ref(4);
const loading = ref(false);
// Realm name — display-only for now (server doesn't support room names yet).
const realmName = ref("Dunholm Keep");

const ws = useWs();
const game = useGameStore();

const off = ws.onMessage((m) => {
  game.applyMessage(m);
  if (m.type === "joined") {
    router.replace({ name: "room", params: { id: m.roomId } });
  }
});
onUnmounted(off);

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "Новая комната",
      sub: "Палата писаря",
      nameLabel: "Название",
      access: "Доступ",
      public: "Публичная",
      private: "Приватная",
      players: "Игроков",
      playersHint: "От 2 до 6 лордов",
      rules: "Правила",
      ruleCash: "Стартовый капитал",
      ruleAuctions: "Аукционы",
      ruleAuctionsVal: "Вкл",
      rulePace: "Скорость",
      rulePaceVal: "Обычная",
      ruleEntry: "Ставка",
      create: "Созвать совет",
      back: "Назад",
    }
  : {
      title: "New Room",
      sub: "Scribe’s Chamber",
      nameLabel: "Realm name",
      access: "Access",
      public: "Public",
      private: "Private",
      players: "Players",
      playersHint: "From 2 to 6 lords",
      rules: "Rules",
      ruleCash: "Starting cash",
      ruleAuctions: "Auctions",
      ruleAuctionsVal: "On",
      rulePace: "Pace",
      rulePaceVal: "Normal",
      ruleEntry: "Entry",
      create: "Open the Hall",
      back: "Back",
    });

function createRoom() {
  if (loading.value) return;
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

function goBack() {
  haptic("light");
  router.back();
}
</script>

<template>
  <div class="app create">
    <div class="topbar">
      <button class="icon-btn" aria-label="Back" @click="goBack">
        <Icon name="back" :size="18"/>
      </button>
      <div class="title">
        <h1 :style="{ fontFamily: 'var(--font-title)', fontSize: '22px', letterSpacing: '0.08em' }">
          {{ L.title }}
        </h1>
        <div class="sub">{{ L.sub }}</div>
      </div>
      <button class="icon-btn" aria-label="scroll">
        <Icon name="scroll" :size="18"/>
      </button>
    </div>

    <div class="content">
      <!-- Realm name (display-only for now) -->
      <div class="field">
        <label class="field__label">{{ L.nameLabel }}</label>
        <input
          v-model="realmName"
          class="realm-input"
          maxlength="32"
        />
      </div>

      <!-- Access: Public / Private -->
      <div class="field">
        <label class="field__label">{{ L.access }}</label>
        <div class="access-grid">
          <button
            type="button"
            :class="['access-btn', isPublic && 'active']"
            @click="isPublic = true"
          >
            <Icon name="unlock" :size="16" :color="isPublic ? '#fff' : 'var(--ink-2)'"/>
            <span>{{ L.public }}</span>
          </button>
          <button
            type="button"
            :class="['access-btn', !isPublic && 'active']"
            @click="isPublic = false"
          >
            <Icon name="lock" :size="16" :color="!isPublic ? '#fff' : 'var(--ink-2)'"/>
            <span>{{ L.private }}</span>
          </button>
        </div>
      </div>

      <!-- Players -->
      <div class="field">
        <div class="row between">
          <label class="field__label">{{ L.players }}</label>
          <div class="players-count">{{ maxPlayers }}</div>
        </div>
        <div class="players-grid">
          <button
            v-for="n in [2, 3, 4, 5, 6]"
            :key="n"
            type="button"
            :class="['player-btn', maxPlayers === n && 'active']"
            @click="maxPlayers = n"
          >
            {{ n }}
          </button>
        </div>
        <div class="field__hint">
          <Icon name="users" :size="12" color="var(--ink-3)"/>
          <span>{{ L.playersHint }}</span>
        </div>
      </div>

      <!-- Rules (display-only summary) -->
      <div class="field">
        <label class="field__label">{{ L.rules }}</label>
        <div class="card rules-card">
          <div class="rule-row">
            <span>{{ L.ruleCash }}</span>
            <span class="rule-val">◈ 1 500</span>
          </div>
          <div class="rule-row">
            <span>{{ L.ruleAuctions }}</span>
            <span class="rule-val">{{ L.ruleAuctionsVal }}</span>
          </div>
          <div class="rule-row">
            <span>{{ L.rulePace }}</span>
            <span class="rule-val">{{ L.rulePaceVal }}</span>
          </div>
          <div class="rule-row last">
            <span>{{ L.ruleEntry }}</span>
            <span class="rule-val">◈ 100</span>
          </div>
        </div>
      </div>

      <!-- Primary action -->
      <button
        class="btn btn-primary create-btn"
        :disabled="loading"
        @click="createRoom"
      >
        <Icon name="check" :size="16" color="#fff"/>
        {{ L.create }}
      </button>
    </div>
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

.field {
  margin-bottom: 14px;
}
.field__label {
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 500;
}
.field__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--ink-3);
}

.realm-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 17px;
  color: var(--ink);
  margin-top: 6px;
  outline: none;
}
.realm-input:focus { border-color: var(--primary); }

.access-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 6px;
}
.access-btn {
  padding: 12px;
  background: var(--card);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 120ms, border-color 120ms, color 120ms;
}
.access-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.players-count {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--primary);
}
.players-grid {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  justify-content: space-between;
}
.player-btn {
  flex: 1;
  padding: 12px 0;
  background: var(--card);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 16px;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms;
}
.player-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.rules-card {
  margin-top: 6px;
  padding: 0;
}
.rule-row {
  padding: 12px 14px;
  border-bottom: 1px solid var(--divider);
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--ink);
}
.rule-row.last {
  border-bottom: none;
}
.rule-val {
  color: var(--ink-2);
  font-weight: 500;
}

.create-btn {
  width: 100%;
  padding: 14px 20px;
  font-size: 15px;
  margin-top: 4px;
}
.create-btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
