<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD } from "../../../shared/board";
import type { GameLogEntry } from "../../../shared/types";
import { useGameStore } from "../stores/game";

// Surfaces a short-lived banner ("Bought X for $140", "-100 → Alex", "+100
// from Slava") whenever a log entry with structured `txn` data arrives that
// involves me as actor or counterparty. Pure cash flips to/from me — no
// generic logs, no noise.
const { locale } = useI18n();
const game = useGameStore();

type Toast = {
  id: string;
  dir: "in" | "out" | "buy" | "forced"; // color/glyph variant
  amount: number;
  tileName: string;
  counterparty: string;
};

const active = ref<Toast | null>(null);
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastSeenId = "";

function playerName(id?: string): string {
  if (!id) return "";
  return game.room?.players.find((p) => p.id === id)?.name ?? "";
}

function tileName(idx?: number): string {
  if (idx == null) return "";
  const t = BOARD[idx];
  return t?.name[locale.value as "en" | "ru"] ?? "";
}

function entryToToast(entry: GameLogEntry): Toast | null {
  const t = entry.txn;
  if (!t) return null;
  const me = game.myPlayerId;
  if (!me) return null;

  if (t.kind === "buy" && t.actorId === me) {
    return {
      id: entry.id,
      dir: "buy",
      amount: t.amount,
      tileName: tileName(t.tileIndex),
      counterparty: "",
    };
  }
  if (t.kind === "rent" && t.actorId === me) {
    return {
      id: entry.id,
      dir: "out",
      amount: t.amount,
      tileName: tileName(t.tileIndex),
      counterparty: playerName(t.counterpartyId),
    };
  }
  if (t.kind === "rent" && t.counterpartyId === me) {
    return {
      id: entry.id,
      dir: "in",
      amount: t.amount,
      tileName: tileName(t.tileIndex),
      counterparty: playerName(t.actorId),
    };
  }
  // Forced sale / mortgage on the player's own property — surface as a
  // clear toast so the user understands why their houses or properties
  // suddenly changed state. Without it, players read "my houses just
  // disappeared" instead of "the engine had to liquidate to cover rent".
  if (t.kind === "liquidation" && t.actorId === me) {
    return {
      id: entry.id,
      dir: "forced",
      amount: t.amount,
      tileName: tileName(t.tileIndex),
      counterparty: "",
    };
  }
  return null;
}

// On initial room state, skip the backlog — only animate NEW entries that
// arrive during play. Without this, reconnecting mid-match would explode a
// stack of stale toasts.
// Also: buffer the toast while a token is mid-hop. The server logs the
// txn the moment it resolves, but the client walk is still playing — if
// we show "−200" before the piece lands on the tile it feels like a
// desync. Flush the buffer when the animation ends.
let pendingToast: Toast | null = null;
watch(
  () => game.room?.log.length,
  (len) => {
    if (!len) return;
    const entries = game.room?.log ?? [];
    // First non-empty render: mark last id as "already seen".
    if (!lastSeenId) {
      lastSeenId = entries[entries.length - 1].id;
      return;
    }
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.id === lastSeenId) break;
      const t = entryToToast(e);
      if (t) {
        if (game.animatingPlayerId) pendingToast = t;
        else show(t);
        break;
      }
    }
    lastSeenId = entries[entries.length - 1].id;
  },
);

watch(
  () => game.animatingPlayerId,
  (id) => {
    if (!id && pendingToast) {
      show(pendingToast);
      pendingToast = null;
    }
  },
);

function show(t: Toast) {
  active.value = t;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    active.value = null;
  }, 2600);
}

const label = computed(() => {
  const t = active.value;
  if (!t) return null;
  const isRu = locale.value === "ru";
  if (t.dir === "buy") {
    return {
      title: isRu ? "Куплено" : "Bought",
      sub: t.tileName,
      amount: `◈ ${t.amount}`,
      sign: "-" as const,
    };
  }
  if (t.dir === "out") {
    return {
      title: isRu ? `Аренда → ${t.counterparty}` : `Rent → ${t.counterparty}`,
      sub: t.tileName,
      amount: `◈ ${t.amount}`,
      sign: "-" as const,
    };
  }
  if (t.dir === "forced") {
    return {
      title: isRu ? "Принудительная продажа" : "Forced sale",
      sub: t.tileName,
      amount: `◈ ${t.amount}`,
      sign: "+" as const,
    };
  }
  return {
    title: isRu ? `Аренда ← ${t.counterparty}` : `Rent ← ${t.counterparty}`,
    sub: t.tileName,
    amount: `◈ ${t.amount}`,
    sign: "+" as const,
  };
});
</script>

<template>
  <transition name="txn-pop">
    <div
      v-if="active && label"
      class="txn-toast"
      :class="[`txn-toast--${active.dir}`]"
      role="status"
      aria-live="polite"
    >
      <div class="txn-toast__body">
        <div class="txn-toast__title">{{ label.title }}</div>
        <div class="txn-toast__sub">{{ label.sub }}</div>
      </div>
      <div class="txn-toast__amt">
        <span class="txn-toast__sign">{{ label.sign }}</span>
        {{ label.amount }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.txn-toast {
  position: fixed;
  top: calc(12px + var(--tg-safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  min-width: 240px;
  max-width: min(420px, calc(100% - 24px));
  padding: 10px 14px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 540;
  background: var(--card-alt);
  border: 1px solid var(--line);
  box-shadow: 0 8px 24px rgba(26, 15, 5, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  font-family: var(--font-display);
}
.txn-toast--buy {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), 0 8px 24px rgba(90, 58, 154, 0.28);
}
.txn-toast--out {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 8px 24px rgba(139, 26, 26, 0.28);
}
.txn-toast--in {
  border-color: var(--emerald);
  box-shadow: 0 0 0 1px var(--emerald), 0 8px 24px rgba(45, 122, 79, 0.28);
}
.txn-toast--forced {
  border-color: #f97316;
  box-shadow: 0 0 0 1px #f97316, 0 8px 24px rgba(249, 115, 22, 0.28);
}
.txn-toast__body {
  flex: 1;
  min-width: 0;
}
.txn-toast__title {
  font-size: 13px;
  color: var(--ink);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.txn-toast--buy .txn-toast__title { color: var(--primary); }
.txn-toast--out .txn-toast__title { color: var(--accent); }
.txn-toast--in .txn-toast__title { color: var(--emerald); }
.txn-toast--forced .txn-toast__title { color: #c2410c; }

.txn-toast__sub {
  font-size: 11px;
  color: var(--ink-3);
  font-style: italic;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.txn-toast__amt {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  flex-shrink: 0;
}
.txn-toast--buy .txn-toast__amt { color: var(--primary); }
.txn-toast--out .txn-toast__amt { color: var(--accent); }
.txn-toast--in .txn-toast__amt  { color: var(--emerald); }
.txn-toast__sign {
  font-size: 15px;
  opacity: 0.9;
}

.txn-pop-enter-active {
  transition: opacity 0.25s ease, transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.txn-pop-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.txn-pop-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-14px);
}
.txn-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
