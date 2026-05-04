<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BOARD } from "../../../shared/board";
import type { GameLogEntry } from "../../../shared/types";
import { useGameStore } from "../stores/game";
import { playBuy, playCashIn, playCashOut } from "../composables/useSounds";

// Surfaces a short-lived banner ("Bought X for $140", "-100 → Alex", "+100
// from Slava") whenever a log entry with structured `txn` data arrives that
// involves me as actor or counterparty. Pure cash flips to/from me — no
// generic logs, no noise.
const { locale } = useI18n();
const game = useGameStore();

type Toast = {
  id: string;
  dir: "in" | "out" | "buy" | "forced" | "auction" | "info"; // color/glyph variant
  amount: number;
  tileName: string;
  counterparty: string;
  actorId?: string; // used by auction toast to pick the right SFX for me-vs-other
  // Set for third-party toasts so the title can render "<Actor> bought X"
  // / "<Actor> → <Other>: rent". Empty for me-involved toasts (existing
  // `dir`-keyed labels already encode the perspective).
  actorName?: string;
  // Sub-kind so the "info" dir can pick the right title (a buy and a rent
  // both come through as info, but their wording differs).
  infoKind?: "buy" | "rent";
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
  // Third-party events — playtester wanted "all these logs shown to
  // everyone", not just to the me-actor / me-counterparty. Surface buys
  // and rent transfers as cream-coloured info toasts so spectators see
  // the cash flow happening on the board. Skipped when me is involved
  // because the cases above already render a more specific banner.
  if (t.kind === "buy" && t.actorId !== me) {
    return {
      id: entry.id,
      dir: "info",
      amount: t.amount,
      tileName: tileName(t.tileIndex),
      counterparty: "",
      actorName: playerName(t.actorId),
      infoKind: "buy",
    };
  }
  if (t.kind === "rent" && t.actorId !== me && t.counterpartyId !== me) {
    return {
      id: entry.id,
      dir: "info",
      amount: t.amount,
      tileName: tileName(t.tileIndex),
      counterparty: playerName(t.counterpartyId),
      actorName: playerName(t.actorId),
      infoKind: "rent",
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
        // Defer while dice are tumbling OR token is walking — both
        // mean the visual sequence isn't done yet, and a toast
        // popping mid-roll feels like the state skipped ahead.
        if (game.animatingPlayerId || game.rolling) pendingToast = t;
        else show(t);
        break;
      }
    }
    lastSeenId = entries[entries.length - 1].id;
  },
);

watch(
  () => [game.animatingPlayerId, game.rolling],
  ([id, isRolling]) => {
    if (!id && !isRolling && pendingToast) {
      show(pendingToast);
      pendingToast = null;
    }
  },
);

// Auction wrap-up toast: surfaces "X won Y for $Z" the moment the
// auction modal closes. Server logs the win but doesn't emit structured
// `txn` data for it, so the regular log-watcher path can't pick it up.
// Instead we observe room.auction transitioning from non-null to null
// and synthesize a toast from the prior auction snapshot. Skipped when
// the auction ended without a winner (no bids, or winner went bankrupt
// in the resolve race).
watch(
  () => game.room?.auction,
  (newA, oldA) => {
    if (!oldA || newA) return;
    const winnerId = oldA.highBidderId;
    if (!winnerId) return;
    const winner = game.room?.players.find((pl) => pl.id === winnerId);
    if (!winner || winner.bankrupt) return;
    const t: Toast = {
      id: `auction-${oldA.tileIndex}-${oldA.startedAt}`,
      dir: "auction",
      amount: oldA.highBid,
      tileName: tileName(oldA.tileIndex),
      counterparty: winner.name,
      actorId: winner.id,
    };
    if (game.animatingPlayerId || game.rolling) pendingToast = t;
    else show(t);
  },
);

function show(t: Toast) {
  active.value = t;
  // SFX matched to the toast direction. The toast is the canonical
  // surface for "money just changed hands" so we hook the sound here
  // instead of sprinkling playCash* calls across every action handler.
  if (t.dir === "buy") playBuy();
  else if (t.dir === "out" || t.dir === "forced") playCashOut();
  else if (t.dir === "auction") {
    // Winner gets the cha-ching, everyone else gets the lighter cash-in
    // so they know "someone got something" without it sounding like
    // their own purchase.
    if (t.actorId && t.actorId === game.myPlayerId) playBuy();
    else playCashIn();
  }
  else if (t.dir === "info") {
    // Third-party events (someone else bought / paid rent to someone
    // else) — silent. With 4–6 players, sound on every txn would be a
    // constant drumbeat; the visual toast alone is enough.
  }
  else playCashIn();
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
  if (t.dir === "auction") {
    return {
      title: isRu ? "Аукцион" : "Auction",
      sub: `${t.counterparty} → ${t.tileName}`,
      amount: `◈ ${t.amount}`,
      sign: "" as const,
    };
  }
  if (t.dir === "info") {
    if (t.infoKind === "buy") {
      return {
        title: isRu
          ? `${t.actorName} купил`
          : `${t.actorName} bought`,
        sub: t.tileName,
        amount: `◈ ${t.amount}`,
        sign: "" as const,
      };
    }
    // rent
    return {
      title: isRu
        ? `${t.actorName} → ${t.counterparty}`
        : `${t.actorName} → ${t.counterparty}`,
      sub: t.tileName,
      amount: `◈ ${t.amount}`,
      sign: "" as const,
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
      <span class="txn-toast__badge">{{ label.title }}</span>
      <span v-if="label.sub" class="txn-toast__sub">{{ label.sub }}</span>
      <span class="txn-toast__amt">
        <span class="txn-toast__sign">{{ label.sign }}</span>
        <img class="txn-toast__icon" src="/figma/room/icon-money.webp" alt="" aria-hidden="true"/>
        {{ active.amount }}
      </span>
    </div>
  </transition>
</template>

<style scoped>
/* Figma-style toast (matches CardModal / TileInfoModal language):
   parchment card, Unbounded type, coloured eyebrow badge for the action
   kind, real money icon next to the amount. Same visual family as the
   chest/profile popups so notifications stop looking like a leftover
   from the v0 design. */
.txn-toast {
  position: fixed;
  top: calc(62px + var(--tg-safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  min-width: 240px;
  max-width: min(420px, calc(100% - 24px));
  padding: 10px 14px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 540;
  background: #faf3e2;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 8px 24px rgba(26, 15, 5, 0.22);
  font-family: 'Unbounded', sans-serif;
  color: #000;
}

.txn-toast__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 100px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 12px;
  line-height: 14px;
  color: #fff;
  text-shadow: 0.2px 0.2px 0 rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  flex-shrink: 0;
}
.txn-toast--buy     .txn-toast__badge { background: #43c22d; }
.txn-toast--out     .txn-toast__badge { background: #e84b3e; }
.txn-toast--in      .txn-toast__badge { background: #2283f3; }
.txn-toast--forced  .txn-toast__badge { background: #f97316; }
/* Gold for auction wins — distinct from buy (green) so the player can
   tell at a glance "this is a contested win, not a quiet purchase". */
.txn-toast--auction .txn-toast__badge { background: #d97706; }
/* Slate for third-party events — informational, not me-actionable. The
   greyer hue keeps "someone else paid someone else" from competing with
   the saturated green/red/blue toasts that fire when the player is
   personally involved. */
.txn-toast--info    .txn-toast__badge { background: #6b7280; }

.txn-toast__sub {
  flex: 1 1 0;
  min-width: 0;
  font-family: 'Unbounded', sans-serif;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.txn-toast__amt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  color: #000;
  flex-shrink: 0;
}
.txn-toast--out .txn-toast__amt    { color: #b32c2c; }
.txn-toast--in .txn-toast__amt     { color: #2d7a4f; }
.txn-toast--buy .txn-toast__amt    { color: #2d7a4f; }
.txn-toast--forced .txn-toast__amt { color: #c2410c; }
.txn-toast--auction .txn-toast__amt { color: #b45309; }
.txn-toast--info    .txn-toast__amt { color: #374151; }
.txn-toast__sign {
  font-weight: 900;
}
.txn-toast__icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
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
