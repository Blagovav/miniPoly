import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

const STORAGE = "nini.inventory.v1";

interface StoredInventory {
  coins: number;
  owned: string[];
  equipped: { token: string; theme: string };
  serverUnlocks: string[]; // разблокировано за Stars (подгружается с сервера)
  lastBonusDate: string | null; // yyyy-mm-dd последнего дейли-бонуса
}

function load(): StoredInventory {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredInventory>;
      return {
        coins: parsed.coins ?? 10000,
        owned: parsed.owned ?? [],
        // Spread defaults so a partial `equipped` (e.g. only theme set
        // by a previous schema) doesn't leave token undefined and
        // silently fall back to the knight piece on the board.
        equipped: { token: "token-car", theme: "theme-classic", ...(parsed.equipped ?? {}) },
        serverUnlocks: parsed.serverUnlocks ?? [],
        lastBonusDate: parsed.lastBonusDate ?? null,
      };
    }
  } catch {}
  return {
    coins: 10000,
    owned: [
      "token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo",
      "theme-classic",
    ],
    equipped: { token: "token-car", theme: "theme-classic" },
    serverUnlocks: [],
    lastBonusDate: null,
  };
}

const DAILY_BONUS = 1000;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const useInventoryStore = defineStore("inventory", () => {
  const state = ref<StoredInventory>(load());

  watch(
    state,
    (v) => localStorage.setItem(STORAGE, JSON.stringify(v)),
    { deep: true },
  );

  const coins = computed(() => state.value.coins);
  // Обединяем локально купленные + с сервера (Stars).
  const owned = computed(() => new Set([...state.value.owned, ...state.value.serverUnlocks]));
  const equippedToken = computed(() => state.value.equipped.token);
  const equippedTheme = computed(() => state.value.equipped.theme);

  async function syncServerUnlocks(tgUserId: number | null) {
    if (!tgUserId) return;
    try {
      const base = (import.meta.env.VITE_API_URL as string) || "";
      const res = await fetch(`${base}/api/users/${tgUserId}/purchases`);
      if (!res.ok) return;
      const data = await res.json();
      state.value.serverUnlocks = Array.isArray(data.items) ? data.items : [];
    } catch {}
  }

  function buy(itemId: string, price: number): boolean {
    if (state.value.owned.includes(itemId)) return false;
    if (state.value.coins < price) return false;
    state.value.coins -= price;
    state.value.owned.push(itemId);
    return true;
  }

  function equip(itemId: string, kind: "token" | "theme"): void {
    if (!state.value.owned.includes(itemId)) return;
    state.value.equipped[kind] = itemId;
  }

  function addCoins(n: number) {
    state.value.coins += n;
  }

  /** Даёт ежедневный бонус, если сегодня ещё не получали. Возвращает сумму (0 если уже получал). */
  function claimDailyBonus(): number {
    const today = todayISO();
    if (state.value.lastBonusDate === today) return 0;
    state.value.coins += DAILY_BONUS;
    state.value.lastBonusDate = today;
    return DAILY_BONUS;
  }

  const canClaimDaily = computed(() => state.value.lastBonusDate !== todayISO());

  return {
    coins, owned, equippedToken, equippedTheme,
    buy, equip, addCoins, syncServerUnlocks,
    claimDailyBonus, canClaimDaily,
  };
});
