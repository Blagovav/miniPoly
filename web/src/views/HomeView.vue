<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { setLocale } from "../i18n";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";

const { t, locale } = useI18n();
const router = useRouter();
const inv = useInventoryStore();
const { haptic, notify, userName, setUserName, tg } = useTelegram();

const bonusAmount = ref<number>(0);
const bonusToast = ref(false);

onMounted(() => {
  // Даём ежедневный бонус автоматически при открытии, если сегодня ещё не получал.
  const got = inv.claimDailyBonus();
  if (got > 0) {
    bonusAmount.value = got;
    bonusToast.value = true;
    notify("success");
    setTimeout(() => (bonusToast.value = false), 3500);
  }
});

const editingName = ref(false);
const nameDraft = ref(userName.value);

const { close: closeMiniApp } = useTelegram();

function closeApp() {
  closeMiniApp();
}

function go(name: string) {
  haptic("light");
  router.push({ name });
}

function toggleLocale() {
  setLocale(locale.value === "ru" ? "en" : "ru");
}

function startEditName() {
  nameDraft.value = userName.value;
  editingName.value = true;
}

function saveName() {
  setUserName(nameDraft.value);
  editingName.value = false;
}
</script>

<template>
  <div class="home">
    <header class="home__header">
      <div class="home__brand">
        <div class="logo">🎲</div>
        <div>
          <h1 class="title">{{ t("app.title") }}</h1>
          <p class="subtitle">{{ t("app.subtitle") }}</p>
        </div>
      </div>
      <div class="home__meta">
        <button class="chip" @click="toggleLocale">
          🌐 {{ locale === "ru" ? "RU" : "EN" }}
        </button>
        <div class="chip coins-chip">
          🪙 <span class="money">{{ inv.coins }}</span>
        </div>
      </div>
    </header>

    <div v-if="!tg" class="name-bar card">
      <template v-if="!editingName">
        <div class="name-bar__left">
          <span class="name-bar__label">{{ t("home.yourName") }}</span>
          <span class="name-bar__value">{{ userName }}</span>
        </div>
        <button class="btn btn--ghost name-bar__edit" @click="startEditName">✏️</button>
      </template>
      <template v-else>
        <input
          v-model="nameDraft"
          class="name-bar__input"
          maxlength="24"
          autofocus
          @keydown.enter="saveName"
        />
        <button class="btn btn--primary name-bar__save" @click="saveName">✓</button>
      </template>
    </div>

    <main class="home__menu">
      <button class="tile tile--play" @click="go('rooms')">
        <div class="tile__icon">🎯</div>
        <div class="tile__body">
          <div class="tile__title">{{ t("home.play") }}</div>
          <div class="tile__sub">{{ t("home.playHint") }}</div>
        </div>
        <div class="tile__arrow">→</div>
      </button>

      <button class="tile tile--create" @click="go('create')">
        <div class="tile__icon">✨</div>
        <div class="tile__body">
          <div class="tile__title">{{ t("home.create") }}</div>
          <div class="tile__sub">{{ t("home.createHint") }}</div>
        </div>
        <div class="tile__arrow">→</div>
      </button>

      <button class="tile tile--shop" @click="go('shop')">
        <div class="tile__icon">🛍️</div>
        <div class="tile__body">
          <div class="tile__title">{{ t("home.shop") }}</div>
          <div class="tile__sub">{{ t("home.shopHint") }}</div>
        </div>
        <div class="tile__arrow">→</div>
      </button>

      <button class="tile tile--friends" @click="go('friends')">
        <div class="tile__icon">👥</div>
        <div class="tile__body">
          <div class="tile__title">Друзья</div>
          <div class="tile__sub">Статистика и соигроки</div>
        </div>
        <div class="tile__arrow">→</div>
      </button>
    </main>

    <footer class="home__footer">
      <p>{{ t("home.hint") }}</p>
      <button v-if="tg" class="btn btn--ghost close-app" @click="closeApp">
        🚪 {{ locale === "ru" ? "Закрыть" : "Close Mini App" }}
      </button>
    </footer>

    <transition name="bonus">
      <div v-if="bonusToast" class="bonus-toast">
        <div class="bonus-toast__icon">🎁</div>
        <div>
          <div class="bonus-toast__title">Ежедневный бонус</div>
          <div class="bonus-toast__val">+{{ bonusAmount }} 🪙</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.home {
  min-height: 100dvh;
  padding: 24px 18px 40px;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}
.home__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}
.home__brand {
  display: flex;
  gap: 12px;
  align-items: center;
}
.logo {
  font-size: 36px;
  filter: drop-shadow(0 4px 10px rgba(168, 85, 247, 0.5));
}
.home__meta {
  display: flex;
  gap: 8px;
  flex-direction: column;
  align-items: flex-end;
}
.coins-chip {
  font-weight: 600;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05));
  border-color: rgba(251, 191, 36, 0.3);
}
.home__menu {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.tile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 18px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  backdrop-filter: blur(20px);
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}
.tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, currentColor 140%);
  opacity: 0.1;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.tile:hover::before { opacity: 0.18; }
.tile:active { transform: scale(0.98); }
.tile--play { color: var(--neon); }
.tile--create { color: var(--purple); }
.tile--shop { color: var(--gold); }
.tile--friends { color: #06b6d4; }
.tile__icon {
  font-size: 34px;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
}
.tile__body { flex: 1; }
.tile__title {
  color: var(--text);
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 2px;
}
.tile__sub {
  color: var(--text-dim);
  font-size: 13px;
}
.tile__arrow {
  font-size: 22px;
  color: var(--text-mute);
}
.home__footer {
  margin-top: 24px;
  text-align: center;
  color: var(--text-mute);
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.close-app {
  font-size: 13px;
  padding: 10px 20px;
  margin-top: 8px;
}
.bonus-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), var(--surface-strong));
  border: 1px solid var(--gold);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  z-index: 90;
  box-shadow: 0 20px 50px -15px rgba(251, 191, 36, 0.5);
}
.bonus-toast__icon { font-size: 28px; }
.bonus-toast__title { font-size: 11px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.1em; }
.bonus-toast__val { font-weight: 800; font-size: 18px; color: var(--gold); margin-top: 2px; }
.bonus-enter-active, .bonus-leave-active { transition: transform 0.3s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.2s; }
.bonus-enter-from, .bonus-leave-to { transform: translate(-50%, -30px); opacity: 0; }

.name-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
}
.name-bar__left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.name-bar__label {
  font-size: 10px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.name-bar__value {
  font-weight: 700;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-bar__edit, .name-bar__save {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 10px;
  font-size: 16px;
}
.name-bar__input {
  flex: 1;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  outline: none;
}
.name-bar__input:focus { border-color: var(--purple); }
</style>
