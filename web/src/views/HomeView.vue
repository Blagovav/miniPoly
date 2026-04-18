<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { setLocale } from "../i18n";
import { useInventoryStore } from "../stores/inventory";
import { useTelegram } from "../composables/useTelegram";
import Icon from "../components/Icon.vue";
import Sigil from "../components/Sigil.vue";
import { PLAYER_COLORS } from "../utils/palette";

const { locale } = useI18n();
const router = useRouter();
const inv = useInventoryStore();
const { haptic, notify, userName, setUserName, tg } = useTelegram();

const isRu = computed(() => locale.value === "ru");
const L = computed(() => isRu.value
  ? {
      title: "MINI · POLY",
      sub: "Королевство торговли",
      hero: `Добро пожаловать, ${userName.value || "лорд"}`,
      retinue: "Ваша свита ждёт приказаний.",
      play: "Играть",
      tavernT: "Таверна", tavernS: "Найти игру",
      scribeT: "Писарь",  scribeS: "Новая комната",
      shopT: "Ярмарка",   shopS: "Товары и гербы",
      friendsT: "Друзья", friendsS: "Свиток союзников",
      lastMatch: "Последняя игра",
      alliesInPlay: "Союзники в игре",
      closeApp: "Закрыть",
      daily: "Ежедневный бонус",
      yourName: "Твоё имя",
      rejoinEyebrow: "Активная партия",
      rejoinMsg: "Ты не попрощался с партией — вернуться в комнату?",
      rejoinBtn: "Вернуться",
      rejoinForget: "Забыть",
    }
  : {
      title: "MINI · POLY",
      sub: "The Realm of Commerce",
      hero: `Welcome, ${userName.value || "my lord"}`,
      retinue: "Your retinue awaits your command.",
      play: "Play",
      tavernT: "The Tavern", tavernS: "Find a game",
      scribeT: "Scribe",     scribeS: "New room",
      shopT: "Bazaar",       shopS: "Tokens & crests",
      friendsT: "Friends",   friendsS: "Scroll of allies",
      lastMatch: "Recent match",
      alliesInPlay: "Allies in play",
      closeApp: "Close",
      daily: "Daily bonus",
      yourName: "Your name",
      rejoinEyebrow: "Active match",
      rejoinMsg: "You never said farewell — return to the hall?",
      rejoinBtn: "Return",
      rejoinForget: "Forget",
    });

const bonusAmount = ref(0);
const bonusToast = ref(false);
// Rejoin banner — shows when a roomId was saved in localStorage during a previous
// session. Lets the user return to (or forget) an accidentally-closed game.
const activeRoomId = ref<string | null>(null);
onMounted(() => {
  const got = inv.claimDailyBonus();
  if (got > 0) {
    bonusAmount.value = got;
    bonusToast.value = true;
    notify("success");
    setTimeout(() => (bonusToast.value = false), 3500);
  }
  try { activeRoomId.value = localStorage.getItem("activeRoomId"); } catch {}
});

function rejoinRoom() {
  if (!activeRoomId.value) return;
  haptic("medium");
  router.push({ name: "room", params: { id: activeRoomId.value } });
}
function forgetRoom() {
  haptic("light");
  try { localStorage.removeItem("activeRoomId"); } catch {}
  activeRoomId.value = null;
}

const editingName = ref(false);
const nameDraft = ref(userName.value);
function startEditName() { nameDraft.value = userName.value; editingName.value = true; }
function saveName() { setUserName(nameDraft.value); editingName.value = false; }

function go(name: string) { haptic("light"); router.push({ name }); }
function toggleLocale() { setLocale(isRu.value ? "en" : "ru"); }

// Демо-данные для «Последняя игра» и «Союзники в игре» — временно, пока
// серверные endpoints для last-match/online-friends не поднимем.
// TODO: заменить на реальные данные (GET /api/users/:id/last-match, и friends.status).
const allies = computed(() => [
  { n: "Elara",  c: PLAYER_COLORS.elara,  s: "Playing" },
  { n: "Magnus", c: PLAYER_COLORS.magnus, s: "Online" },
  { n: "Finn",   c: PLAYER_COLORS.finn,   s: "Lobby" },
  { n: "Oren",   c: PLAYER_COLORS.oren,   s: "Idle" },
  { n: "Lady",   c: PLAYER_COLORS.lady,   s: "Online" },
]);

function allyDotColor(status: string): string {
  if (status === "Playing") return "var(--emerald)";
  if (status === "Online") return "var(--gold)";
  return "var(--ink-4)";
}

const avatarInitial = computed(() => (userName.value?.[0] ?? "L").toUpperCase());
</script>

<template>
  <div class="app home">
    <div class="topbar">
      <button class="avatar-btn" @click="startEditName">{{ avatarInitial }}</button>
      <div class="title">
        <h1 :style="{ fontFamily: 'var(--font-title)', fontSize: '22px', letterSpacing: '0.08em' }">{{ L.title }}</h1>
        <div class="sub">{{ L.sub }}</div>
      </div>
      <button class="icon-btn" aria-label="notifications"><Icon name="bell" :size="18"/></button>
      <button class="icon-btn" aria-label="language" @click="toggleLocale">
        <Icon name="globe" :size="18"/>
      </button>
    </div>

    <div class="content">
      <!-- Rejoin card: surfaces an accidentally-closed game so the player
           can hop back in (or dismiss it). -->
      <transition name="rejoin-fade">
        <div v-if="activeRoomId" class="rejoin-card">
          <div class="rejoin-card__pulse">
            <Icon name="dice" :size="20" color="#fff"/>
          </div>
          <div class="rejoin-card__body">
            <div class="rejoin-card__eyebrow">{{ L.rejoinEyebrow }} · {{ activeRoomId }}</div>
            <div class="rejoin-card__msg">{{ L.rejoinMsg }}</div>
          </div>
          <div class="rejoin-card__actions">
            <button class="btn btn-primary rejoin-card__go" @click="rejoinRoom">
              {{ L.rejoinBtn }}
            </button>
            <button class="rejoin-card__forget" @click="forgetRoom" :aria-label="L.rejoinForget">
              <Icon name="x" :size="12" color="var(--ink-3)"/>
            </button>
          </div>
        </div>
      </transition>

      <!-- Name edit input (inline, dev-mode когда нет реального tg-профиля) -->
      <div v-if="!tg && editingName" class="card" style="margin-bottom: 10px; padding: 10px; display: flex; gap: 8px;">
        <input
          v-model="nameDraft"
          class="name-input"
          maxlength="24"
          autofocus
          @keydown.enter="saveName"
        />
        <button class="btn btn-primary" @click="saveName">✓</button>
      </div>

      <!-- Hero banner -->
      <div class="hero">
        <svg viewBox="0 0 80 40" class="hero__crown">
          <path d="M5 30 L12 10 L25 22 L40 5 L55 22 L68 10 L75 30 Z" fill="#d4a84a"/>
          <circle cx="12" cy="10" r="2" fill="#d4a84a"/>
          <circle cx="40" cy="5" r="2" fill="#d4a84a"/>
          <circle cx="68" cy="10" r="2" fill="#d4a84a"/>
        </svg>
        <div class="hero__year">Anno MMXXVI</div>
        <div class="hero__title">{{ L.hero }}</div>
        <div class="hero__sub">{{ L.retinue }}</div>
        <div class="hero__cta">
          <button
            class="btn btn-primary hero__play"
            @click="go('rooms')"
          >
            <Icon name="dice" :size="16" color="#2a1d10"/>
            {{ L.play }}
          </button>
          <button
            class="btn btn-ghost hero__create"
            @click="go('create')"
            aria-label="Create"
          >
            <Icon name="plus" :size="16" color="#f7eeda"/>
          </button>
          <div class="hero__coins chip">
            <Icon name="coin" :size="14" color="var(--gold-soft)"/>
            <span class="money">{{ inv.coins }}</span>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="quick-grid">
        <button class="home-tile" @click="go('rooms')">
          <div class="home-tile__icon"><Icon name="users" :size="17" color="var(--primary)"/></div>
          <div>
            <div class="home-tile__title">{{ L.tavernT }}</div>
            <div class="home-tile__sub">{{ L.tavernS }}</div>
          </div>
        </button>
        <button class="home-tile" @click="go('create')">
          <div class="home-tile__icon"><Icon name="scroll" :size="17" color="var(--primary)"/></div>
          <div>
            <div class="home-tile__title">{{ L.scribeT }}</div>
            <div class="home-tile__sub">{{ L.scribeS }}</div>
          </div>
        </button>
        <button class="home-tile" @click="go('shop')">
          <div class="home-tile__icon"><Icon name="bag" :size="17" color="var(--primary)"/></div>
          <div>
            <div class="home-tile__title">{{ L.shopT }}</div>
            <div class="home-tile__sub">{{ L.shopS }}</div>
          </div>
        </button>
        <button class="home-tile" @click="go('friends')">
          <div class="home-tile__icon"><Icon name="shield" :size="17" color="var(--primary)"/></div>
          <div>
            <div class="home-tile__title">{{ L.friendsT }}</div>
            <div class="home-tile__sub">{{ L.friendsS }}</div>
          </div>
        </button>
      </div>

      <!-- Last match -->
      <div class="card last-match">
        <div class="row between" style="margin-bottom: 8px;">
          <div class="section-label">{{ L.lastMatch }}</div>
          <div class="last-match__delta">+ 1 240 ◈</div>
        </div>
        <div class="row" style="gap: 8px;">
          <Sigil :name="userName || 'Eldmark'" :color="PLAYER_COLORS.you" :size="32"/>
          <div style="flex: 1;">
            <div style="font-family: var(--font-display); font-size: 15px;">
              {{ isRu ? "Эльдмарк Вейл" : "Eldmark Vale" }}
            </div>
            <div style="font-size: 11px; color: var(--ink-3);">
              {{ isRu ? "4 игрока · 28 раундов · победа" : "4 players · 28 rounds · won" }}
            </div>
          </div>
          <div class="rank-badge">1st</div>
        </div>
      </div>

      <!-- Allies in play -->
      <div class="section-label" style="margin-bottom: 6px; text-align: center;">{{ L.alliesInPlay }}</div>
      <div class="rail allies-rail" style="padding-bottom: 4px; justify-content: center;">
        <div v-for="f in allies" :key="f.n" class="ally">
          <div class="ally__wrap">
            <Sigil :name="f.n" :color="f.c" :size="44"/>
            <div
              class="ally__dot"
              :style="{ background: allyDotColor(f.s) }"
            />
          </div>
          <div class="ally__name">{{ f.n }}</div>
        </div>
      </div>
    </div>

    <transition name="bonus">
      <div v-if="bonusToast" class="bonus-toast">
        <div class="bonus-toast__icon">🎁</div>
        <div>
          <div class="bonus-toast__title">{{ L.daily }}</div>
          <div class="bonus-toast__val">+{{ bonusAmount }} ◈</div>
        </div>
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

/* ── Rejoin card (active-match banner) ── */
.rejoin-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: linear-gradient(180deg, rgba(184, 137, 46, 0.12) 0%, rgba(184, 137, 46, 0.05) 100%);
  border: 1px solid var(--gold);
  border-radius: var(--r-md);
  box-shadow: 0 2px 8px rgba(184, 137, 46, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.rejoin-card__pulse {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold));
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4), 0 2px 6px rgba(139, 105, 20, 0.35);
  animation: rejoin-pulse 1.6s ease-in-out infinite;
}
.rejoin-card__body { flex: 1; min-width: 0; line-height: 1.25; }
.rejoin-card__eyebrow {
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--gold);
  text-transform: uppercase;
  font-weight: 600;
}
.rejoin-card__msg {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink);
  margin-top: 2px;
  font-style: italic;
}
.rejoin-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.rejoin-card__go {
  padding: 8px 14px;
  font-size: 13px;
}
.rejoin-card__forget {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
.rejoin-card__forget:hover { background: var(--card-alt); }
@keyframes rejoin-pulse {
  0%, 100% { box-shadow: inset 0 1px 2px rgba(255,255,255,0.4), 0 2px 6px rgba(139,105,20,0.35); }
  50%      { box-shadow: inset 0 1px 2px rgba(255,255,255,0.4), 0 2px 14px rgba(212,168,74,0.6); }
}
.rejoin-fade-enter-active, .rejoin-fade-leave-active { transition: opacity 220ms ease, transform 220ms ease; }
.rejoin-fade-enter-from, .rejoin-fade-leave-to { opacity: 0; transform: translateY(-6px); }

.hero {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  background:
    radial-gradient(ellipse at 80% 20%, rgba(184, 137, 46, 0.25) 0%, transparent 50%),
    linear-gradient(140deg, #4a2e82 0%, #2d1a5a 100%);
  padding: 14px 14px 12px;
  color: #f0e4c8;
  margin-bottom: 10px;
}
.hero__crown {
  position: absolute;
  right: 10px;
  top: 8px;
  width: 56px;
  opacity: 0.35;
}
.hero__year {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: #d4a84a;
  text-transform: uppercase;
}
.hero__title {
  font-family: var(--font-display);
  font-size: 20px;
  margin-top: 2px;
  color: #f7eeda;
}
.hero__sub {
  font-size: 11px;
  color: #c9b88e;
  margin-top: 2px;
  line-height: 1.3;
}
.hero__cta {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.hero__play {
  background: linear-gradient(180deg, #d4a84a 0%, #b8892e 100%);
  color: #2a1d10;
  flex: 1;
  padding: 10px;
}
.hero__create {
  background: rgba(247, 238, 218, 0.12);
  color: #f7eeda;
  border: 1px solid rgba(212, 168, 74, 0.4);
  padding: 10px 14px;
}
.hero__coins {
  background: rgba(247, 238, 218, 0.1);
  border-color: rgba(212, 168, 74, 0.3);
  color: #f7eeda;
  padding: 6px 10px;
}
.hero__coins .money { color: #f7eeda; }

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.home-tile {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 12px;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-body);
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 78px;
}
.home-tile__icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: rgba(90, 58, 154, 0.1);
  color: var(--primary);
  display: flex; align-items: center; justify-content: center;
}
.home-tile__title {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
}
.home-tile__sub {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 1px;
}

.last-match { padding: 12px; margin-bottom: 10px; }
.last-match__delta {
  font-size: 11px;
  color: var(--emerald);
  font-weight: 600;
}
.section-label {
  font-size: 10px;
  color: var(--ink-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.rank-badge {
  padding: 3px 9px;
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font-size: 10px;
  font-family: var(--font-title);
  letter-spacing: 0.12em;
}

.ally {
  text-align: center;
  width: 64px;
  flex-shrink: 0;
}
.ally__wrap {
  position: relative;
  width: 44px; height: 44px;
  margin: 0 auto;
}
.ally__dot {
  position: absolute;
  bottom: 0; right: 0;
  width: 11px; height: 11px;
  border-radius: 50%;
  border: 2px solid var(--bg);
}
.ally__name {
  font-size: 11px;
  margin-top: 6px;
  color: var(--ink);
  font-family: var(--font-display);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name-input {
  flex: 1;
  padding: 8px 10px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ink);
  font-size: 14px;
  font-family: var(--font-body);
  outline: none;
}
.name-input:focus { border-color: var(--primary); }

.bonus-toast {
  position: fixed;
  top: calc(12px + var(--tg-safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background: var(--card);
  border: 1px solid var(--gold);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(42, 29, 16, 0.25);
  z-index: 90;
}
.bonus-toast__icon { font-size: 28px; }
.bonus-toast__title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--ink-3);
  letter-spacing: 0.1em;
}
.bonus-toast__val {
  font-weight: 700;
  font-size: 18px;
  color: var(--gold);
  margin-top: 2px;
  font-family: var(--font-mono);
}
.bonus-enter-active, .bonus-leave-active { transition: transform 0.3s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.2s; }
.bonus-enter-from, .bonus-leave-to { transform: translate(-50%, -30px); opacity: 0; }
</style>
