<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD, GROUP_COLORS } from "../../../shared/board";
import type { Locale, Player, StreetTile } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { capTypeFor } from "../shop/cosmetics";
import Icon from "./Icon.vue";

const props = defineProps<{
  player: Player | null;
  onClose: () => void;
  onOfferTrade?: (playerId: string) => void;
}>();

const { locale } = useI18n();
const loc = computed<Locale>(() => (locale.value === "ru" ? "ru" : "en"));
const isRu = computed(() => locale.value === "ru");
const game = useGameStore();

const ownedList = computed(() => {
  if (!props.player || !game.room) return [];
  const id = props.player.id;
  return Object.values(game.room.properties)
    .filter((x) => x.ownerId === id)
    .map((prop) => ({
      tile: BOARD[prop.tileIndex],
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
  if (t.kind !== "street") return "#484337";
  return GROUP_COLORS[t.group];
}

// Player hex → Russian / English colour name for the chip under the sigil.
// Uses approximate hue buckets so it works for both the legacy medieval hues
// and the bot-auction palette, without hardcoding every seat colour.
function colourName(hex: string): string {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) return isRu.value ? "Игрок" : "Player";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(2 * l - 255));
  if (s < 0.12) return isRu.value ? "Серый" : "Gray";
  let hue = 0;
  const d = max - min || 1;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue = hue * 60;
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 345) return isRu.value ? "Красный" : "Red";
  if (hue < 45) return isRu.value ? "Оранжевый" : "Orange";
  if (hue < 70) return isRu.value ? "Жёлтый" : "Yellow";
  if (hue < 170) return isRu.value ? "Зелёный" : "Green";
  if (hue < 200) return isRu.value ? "Бирюзовый" : "Teal";
  if (hue < 255) return isRu.value ? "Синий" : "Blue";
  if (hue < 290) return isRu.value ? "Фиолетовый" : "Purple";
  return isRu.value ? "Розовый" : "Pink";
}

const L = computed(() => isRu.value
  ? {
      cash: "Монеты",
      worth: "Состояние",
      holdings: "Владения",
      ownedTitle: "Владения игрока",
      empty: "У игрока нет владений",
      trade: "ПРЕДЛОЖИТЬ ОБМЕН",
    }
  : {
      cash: "Coin",
      worth: "Worth",
      holdings: "Holdings",
      ownedTitle: "Player holdings",
      empty: "Player owns nothing yet",
      trade: "PROPOSE A TRADE",
    });
</script>

<template>
  <transition name="profile-fade">
    <div v-if="player" class="profile-scrim" role="dialog" aria-modal="true" @click.self="onClose">
      <div class="profile-stack">
        <div class="profile-card">
          <!-- Head: avatar + name + colour chip. Cap figurine inside the
               player-colour circle is sourced from the player's actual
               equipped token (capTypeFor) so it matches the on-board pawn
               and leaderboard chip rather than a static placeholder. -->
          <div class="profile-head">
            <div
              class="profile-avatar"
              :style="{ background: player.color }"
            >
              <img
                class="profile-avatar__art"
                :src="`/figma/shop/caps/${capTypeFor(player.token)}.webp`"
                alt=""
                aria-hidden="true"
              />
            </div>
            <div class="profile-head__body">
              <div class="profile-name">{{ player.name }}</div>
              <span
                class="profile-color"
                :style="{ background: player.color }"
              >{{ colourName(player.color) }}</span>
            </div>
          </div>

          <!-- 3 green stat cards. Coin/properties figures are figma
               assets (image 25 + Ic24Properies / image 18 from 75:5675–
               75:5688) replacing the prior 💰 emoji + Icon stand-ins. -->
          <div class="profile-stats">
            <div class="profile-stat">
              <div class="profile-stat__label">{{ L.cash }}</div>
              <div class="profile-stat__val">
                <img class="profile-stat__icon" src="/figma/profile-popup/coin.webp" alt="" aria-hidden="true"/>
                <span class="profile-stat__num">{{ player.cash }}</span>
              </div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat__label">{{ L.worth }}</div>
              <div class="profile-stat__val">
                <img class="profile-stat__icon" src="/figma/profile-popup/coin.webp" alt="" aria-hidden="true"/>
                <span class="profile-stat__num">{{ totalWorth }}</span>
              </div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat__label">{{ L.holdings }}</div>
              <div class="profile-stat__val">
                <img class="profile-stat__icon" src="/figma/profile-popup/properties.webp" alt="" aria-hidden="true"/>
                <span class="profile-stat__num">{{ ownedList.length }}</span>
              </div>
            </div>
          </div>

          <!-- Holdings list card (when player owns at least one) -->
          <div v-if="ownedList.length > 0" class="profile-owned">
            <div class="profile-owned__label">{{ L.ownedTitle }}</div>
            <div class="profile-owned__list">
              <div
                v-for="item in ownedList"
                :key="item.tile.index"
                class="profile-owned__row"
              >
                <span
                  class="profile-owned__dot"
                  :style="{ background: bandColor(item.tile.index) }"
                />
                <span class="profile-owned__name">{{ item.tile.name[loc] }}</span>
              </div>
            </div>
          </div>
          <!-- Empty state: dashed placeholder instead of the white card -->
          <div v-else class="profile-owned__empty">
            {{ L.empty }}
          </div>

          <!-- CTA — hidden when this is my own profile. Trading with
               yourself isn't a real action (server rejects it anyway,
               but the empty button confused playtesters who tapped
               their own row in the leaderboard). -->
          <button
            v-if="onOfferTrade && !player.bankrupt && player.id !== game.myPlayerId"
            class="profile-cta"
            @click="onOfferTrade(player.id)"
          >
            {{ L.trade }}
          </button>
        </div>

        <button class="profile-close" @click="onClose" aria-label="close">
          <Icon name="x" :size="20" color="#000"/>
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.profile-scrim {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  /* Designer feedback 2026-05-02 #5.18 — figma 75:5661 anchors popup-info
     at 76px from frame bottom; was 16px, lifting by 60px. */
  padding: 0 24px calc(76px + var(--sab, 0px) + var(--csab, 0px));
}

.profile-fade-enter-active,
.profile-fade-leave-active { transition: opacity 0.2s ease; }
.profile-fade-enter-from,
.profile-fade-leave-to { opacity: 0; }

.profile-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  width: 100%;
  max-width: 345px;
  margin: 0 auto;
}

.profile-card {
  background: var(--card-alt);
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.profile-card::-webkit-scrollbar { width: 3px; }
.profile-card::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 100px;
}

/* ── Head: 56px avatar + name + colour chip ── */
.profile-head {
  display: flex;
  gap: 8px;
  align-items: center;
}
.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: inset 0 2px 2px rgba(255, 255, 255, 0.3),
              inset 0 -2px 2px rgba(0, 0, 0, 0.2);
}
.profile-avatar :deep(.sigil) {
  width: 48px !important;
  height: 48px !important;
  font-size: 22px !important;
  background: transparent !important;
  box-shadow: none !important;
}
.profile-avatar__art {
  width: 48px;
  height: 48px;
  object-fit: contain;
  pointer-events: none;
}
.profile-head__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.profile-name {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 18px;
  color: #000;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.4);
}
.profile-color {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 4px 12px;
  border-radius: 100px;
  color: #fff;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.5);
}

/* ── 3 green stat cards ── */
.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.profile-stat {
  background: #43c22d;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-shadow: inset 0 -4px 0 0 rgba(0, 0, 0, 0.18);
  min-width: 0;
}
.profile-stat__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #fff;
  text-shadow: 0.4px 0.4px 0 rgba(0, 0, 0, 0.5);
}
.profile-stat__val {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.profile-stat__coin {
  font-size: 18px;
  line-height: 1;
  filter: saturate(0.9);
}
.profile-stat__icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
}
.profile-stat__num {
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 18px;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
}

/* ── Holdings card (white rounded) ── */
.profile-owned {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.profile-owned__label {
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
}
.profile-owned__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1.4px dashed rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.6);
}
.profile-owned__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Cap the holdings list so a player with all 22+ properties doesn't
     push the modal off the top of the viewport. ~6 rows fit at 50 px
     each + the gap before the scrollbar kicks in. */
  max-height: 300px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* Inset scrollbar so the rounded white card edge doesn't get cut. */
  padding-right: 4px;
  margin-right: -4px;
}
.profile-owned__list::-webkit-scrollbar { width: 3px; }
.profile-owned__list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 100px;
}
.profile-owned__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
.profile-owned__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.profile-owned__name {
  flex: 1 1 0;
  min-width: 0;
  font-family: 'Golos UI', 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #484337;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── CTA (same style as CreateView) ── */
.profile-cta {
  width: 100%;
  height: 56px;
  padding: 0 18px;
  border: 2px solid #000;
  border-radius: 18px;
  background: #43c22d;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 -6px 0 0 rgba(0, 0, 0, 0.22);
  transition: transform 80ms ease;
  font-family: 'Golos Text', 'Unbounded', sans-serif;
  font-weight: 900;
  font-size: 22px;
  line-height: 26px;
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.6);
  letter-spacing: 0.01em;
}
.profile-cta:active {
  transform: translateY(2px);
  box-shadow: inset 0 -2px 0 0 rgba(0, 0, 0, 0.22);
}

/* ── Close button (44×44 circle under the popup) ── */
.profile-close {
  width: 44px;
  height: 44px;
  align-self: center;
  background: #fff;
  border: 4.125px solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s ease;
  padding: 0;
  margin-top: 4px;
}
.profile-close:active { transform: scale(0.94); }
</style>
