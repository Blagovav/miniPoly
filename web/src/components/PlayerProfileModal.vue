<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, Player, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { computeRank, nextRank } from "../utils/rank";
import Icon from "./Icon.vue";
import Sigil from "./Sigil.vue";
import Fleuron from "./Fleuron.vue";

const props = defineProps<{
  player: Player | null;
  onClose: () => void;
  onOfferTrade?: (playerId: string) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const isRu = computed(() => locale.value === "ru");
const game = useGameStore();

const serverStats = ref<{ gamesPlayed: number; gamesWon: number; totalEarned: number } | null>(null);
const rank = computed(() => computeRank(serverStats.value?.gamesWon ?? 0));
const nextR = computed(() => nextRank(serverStats.value?.gamesWon ?? 0));
watch(
  () => props.player?.tgUserId,
  async (id) => {
    serverStats.value = null;
    if (!id) return;
    try {
      const base = (import.meta.env.VITE_API_URL as string) || "";
      const res = await fetch(`${base}/api/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        serverStats.value = data.profile;
      }
    } catch {}
  },
  { immediate: true },
);

const ownedList = computed(() => {
  if (!props.player || !game.room) return [];
  const id = props.player.id;
  return Object.values(game.room.properties)
    .filter((x) => x.ownerId === id)
    .map((prop) => ({
      tile: BOARD[prop.tileIndex],
      houses: prop.houses,
      hotel: prop.hotel,
      mortgaged: prop.mortgaged,
    }))
    .sort((a, b) => a.tile.index - b.tile.index);
});

const totalWorth = computed(() => {
  if (!props.player || !game.room) return 0;
  let sum = props.player.cash;
  for (const prop of Object.values(game.room.properties)) {
    if (prop.ownerId !== props.player.id) continue;
    const tile = BOARD[prop.tileIndex];
    if (tile.kind === "street" || tile.kind === "railroad" || tile.kind === "utility") {
      sum += prop.mortgaged ? Math.floor(tile.price / 2) : tile.price;
    }
    if (tile.kind === "street") {
      sum += prop.houses * (tile as StreetTile).houseCost;
      if (prop.hotel) sum += (tile as StreetTile).houseCost;
    }
  }
  return sum;
});

function bandColor(tileIndex: number): string {
  const t = BOARD[tileIndex];
  if (t.kind !== "street") return "var(--ink-3)";
  return GROUP_COLORS[t.group];
}

const winrate = computed(() => {
  const s = serverStats.value;
  if (!s || s.gamesPlayed === 0) return 0;
  return Math.round((s.gamesWon / s.gamesPlayed) * 100);
});

const L = computed(() => isRu.value
  ? {
      online: "в игре",
      offline: "не в сети",
      bankrupt: "Банкрот",
      cash: "Монеты",
      worth: "Состояние",
      holdings: "Владения",
      games: "Игр",
      wins: "Побед",
      winrate: "Винрейт",
      lifetime: "Послужной список",
      empty: "— владений нет —",
      trade: "Отправить гонца",
      nextRank: (r: string, n: number) => `До «${r}»: ещё ${n}`,
      highestRank: "Высший ранг ✦",
    }
  : {
      online: "online",
      offline: "offline",
      bankrupt: "Bankrupt",
      cash: "Coin",
      worth: "Worth",
      holdings: "Holdings",
      games: "Games",
      wins: "Wins",
      winrate: "Winrate",
      lifetime: "Chronicle",
      empty: "— no holdings —",
      trade: "Send messenger",
      nextRank: (r: string, n: number) => `To «${r}»: ${n} more wins`,
      highestRank: "Highest rank ✦",
    });
</script>

<template>
  <transition name="fade">
    <div v-if="player" class="modal-scrim" @click="onClose">
      <div class="modal-card profile" @click.stop>
        <div class="grab-bar" />

        <!-- Header: sigil + name + rank -->
        <div class="profile-head">
          <Sigil :name="player.name" :color="player.color" :size="56" />
          <div class="profile-head__body">
            <div class="profile-head__name">{{ player.name }}</div>
            <div class="profile-head__eyebrow">
              <template v-if="serverStats">
                <span class="rank-inline" :style="{ color: rank.color }">
                  <span class="rank-inline__icon">{{ rank.icon }}</span>
                  {{ rank.label }}
                </span>
                <span v-if="serverStats.gamesWon > 0" class="rank-inline__sub">
                  · {{ serverStats.gamesWon }} {{ isRu ? "побед" : "wins" }}
                </span>
              </template>
              <template v-else>
                <span class="muted-eyebrow">
                  {{ isRu ? "Лорд за столом" : "Lord at the table" }}
                </span>
              </template>
            </div>
            <div class="profile-head__status">
              <span v-if="player.bankrupt" class="status-chip status-chip--bankrupt">
                <Icon name="x" :size="10" color="var(--accent)" />
                {{ L.bankrupt }}
              </span>
              <span v-else-if="!player.connected" class="status-chip status-chip--offline">
                {{ L.offline }}
              </span>
              <span v-else class="status-chip status-chip--online">
                {{ L.online }}
              </span>
            </div>
          </div>
          <button class="profile-close" :aria-label="'close'" @click="onClose">
            <Icon name="x" :size="14" color="var(--ink-2)" />
          </button>
        </div>

        <!-- Shield stats (cash / worth / holdings) -->
        <div class="stats-grid">
          <div class="stat">
            <div class="stat__label">{{ L.cash }}</div>
            <div class="stat__val stat__val--gold">◈ {{ player.cash }}</div>
          </div>
          <div class="stat">
            <div class="stat__label">{{ L.worth }}</div>
            <div class="stat__val stat__val--gold">◈ {{ totalWorth }}</div>
          </div>
          <div class="stat">
            <div class="stat__label">{{ L.holdings }}</div>
            <div class="stat__val">{{ ownedList.length }}</div>
          </div>
        </div>

        <!-- Next rank hint (progress) -->
        <div v-if="serverStats" class="rank-progress" :style="{ '--rank-clr': rank.color }">
          <div class="rank-progress__badge">
            <span class="rank-progress__icon">{{ rank.icon }}</span>
          </div>
          <div class="rank-progress__body">
            <div class="rank-progress__title">{{ rank.label }}</div>
            <div v-if="nextR" class="rank-progress__next">
              {{ L.nextRank(nextR.label, nextR.minWins - serverStats.gamesWon) }}
            </div>
            <div v-else class="rank-progress__next rank-progress__next--top">
              {{ L.highestRank }}
            </div>
          </div>
        </div>

        <!-- Lifetime stats -->
        <template v-if="serverStats">
          <Fleuron :text="L.lifetime" />
          <div class="stats-grid stats-grid--lifetime">
            <div class="stat">
              <div class="stat__label">{{ L.games }}</div>
              <div class="stat__val">{{ serverStats.gamesPlayed }}</div>
            </div>
            <div class="stat">
              <div class="stat__label">{{ L.wins }}</div>
              <div class="stat__val stat__val--emerald">
                <Icon name="trophy" :size="12" color="var(--emerald)" />
                {{ serverStats.gamesWon }}
              </div>
            </div>
            <div class="stat">
              <div class="stat__label">{{ L.winrate }}</div>
              <div class="stat__val stat__val--gold">{{ winrate }}%</div>
            </div>
          </div>
        </template>

        <!-- Holdings -->
        <Fleuron :text="L.holdings" />
        <div v-if="ownedList.length === 0" class="empty">{{ L.empty }}</div>
        <div v-else class="holdings">
          <div v-for="item in ownedList" :key="item.tile.index" class="holding">
            <div class="holding__band" :style="{ background: bandColor(item.tile.index) }" />
            <div class="holding__name">{{ item.tile.name[loc] }}</div>
            <div class="holding__extras">
              <span v-if="item.hotel" class="holding__icon">♖</span>
              <span v-else-if="item.houses > 0" class="holding__houses">
                <span v-for="n in item.houses" :key="n">⌂</span>
              </span>
              <span v-if="item.mortgaged" class="holding__mortgage" :aria-label="isRu ? 'в залоге' : 'mortgaged'">
                <Icon name="lock" :size="12" color="var(--accent)" />
              </span>
            </div>
          </div>
        </div>

        <button
          v-if="onOfferTrade && !player.bankrupt"
          class="btn btn-primary profile-trade"
          @click="onOfferTrade(player.id)"
        >
          <Icon name="send" :size="14" color="#fff" />
          {{ L.trade }}
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ── Scrim / card base ── */
.modal-scrim {
  position: fixed;
  inset: 0;
  background: rgba(26, 15, 5, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}
.modal-card {
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--card-alt);
  border-top: 3px solid var(--primary);
  border-radius: 16px 16px 0 0;
  padding: 14px 16px calc(20px + var(--tg-safe-area-inset-bottom, 0px));
  animation: scrollUnfurl 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom;
}
.grab-bar {
  width: 40px;
  height: 4px;
  background: var(--line-strong);
  border-radius: 2px;
  margin: -2px auto 12px;
}

/* ── Head ── */
.profile-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  position: relative;
  padding-right: 36px;
}
.profile-head__body {
  flex: 1;
  min-width: 0;
}
.profile-head__name {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--ink);
  line-height: 1.15;
}
.profile-head__eyebrow {
  margin-top: 2px;
  font-size: 11px;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.rank-inline {
  font-family: var(--font-title);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.rank-inline__icon { font-size: 13px; }
.rank-inline__sub { color: var(--ink-3); }
.muted-eyebrow {
  color: var(--ink-3);
  font-family: var(--font-title);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 10px;
}
.profile-head__status {
  margin-top: 6px;
}
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--card);
}
.status-chip--online {
  color: var(--emerald);
  border-color: var(--emerald);
  background: rgba(45, 122, 79, 0.08);
}
.status-chip--offline {
  color: var(--ink-3);
  border-color: var(--line-strong);
}
.status-chip--bankrupt {
  color: var(--accent);
  border-color: rgba(139, 26, 26, 0.4);
  background: rgba(139, 26, 26, 0.08);
}

.profile-close {
  position: absolute;
  top: 0;
  right: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--line);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-close:hover { background: var(--card); }

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stats-grid--lifetime { margin-top: 4px; margin-bottom: 12px; }
.stat {
  padding: 10px 6px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  text-align: center;
}
.stat__label {
  font-size: 9px;
  color: var(--ink-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: var(--font-title);
  font-weight: 600;
}
.stat__val {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stat__val--gold {
  font-family: var(--font-mono);
  color: var(--gold);
  font-weight: 700;
}
.stat__val--emerald { color: var(--emerald); }

/* ── Rank progress ── */
.rank-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--rank-clr, var(--ink-3)) 20%, transparent), transparent);
  border: 1px solid var(--line);
  border-left: 3px solid var(--rank-clr, var(--ink-3));
  border-radius: 8px;
  margin-bottom: 12px;
}
.rank-progress__badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--rank-clr, var(--ink-3));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3), inset 0 -1px 2px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}
.rank-progress__icon { font-size: 18px; }
.rank-progress__body { flex: 1; min-width: 0; }
.rank-progress__title {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
}
.rank-progress__next {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
  font-family: var(--font-body);
}
.rank-progress__next--top {
  color: var(--gold);
  font-family: var(--font-title);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}

/* ── Empty state ── */
.empty {
  color: var(--ink-3);
  font-family: var(--font-display);
  font-size: 13px;
  text-align: center;
  padding: 14px 0;
  font-style: italic;
}

/* ── Holdings list ── */
.holdings {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.holding {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.holding__band {
  width: 3px;
  height: 20px;
  border-radius: 2px;
  flex-shrink: 0;
}
.holding__name {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.holding__extras {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-family: var(--font-display);
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1;
}
.holding__icon { color: var(--gold); }
.holding__houses { letter-spacing: 0.05em; }
.holding__mortgage {
  display: inline-flex;
  align-items: center;
  opacity: 0.75;
}

/* ── Trade CTA ── */
.profile-trade {
  width: 100%;
  margin-top: 14px;
  padding: 12px;
  font-size: 14px;
}

/* ── Animations ── */
@keyframes scrollUnfurl {
  from { transform: scaleY(0.3) translateY(-30px); opacity: 0; }
  to { transform: scaleY(1) translateY(0); opacity: 1; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
