import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

const STORAGE = "nini.inventory.v1";

interface StoredInventory {
  coins: number;
  owned: string[];
  equipped: { token: string; theme: string };
  serverUnlocks: string[]; // разблокировано за Stars (подгружается с сервера)
}

function load(): StoredInventory {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredInventory>;
      return {
        coins: parsed.coins ?? 10000,
        owned: parsed.owned ?? [],
        equipped: parsed.equipped ?? { token: "token-car", theme: "theme-classic" },
        serverUnlocks: parsed.serverUnlocks ?? [],
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
  };
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

  return { coins, owned, equippedToken, equippedTheme, buy, equip, addCoins, syncServerUnlocks };
});
