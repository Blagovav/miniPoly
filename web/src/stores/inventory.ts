import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

const STORAGE = "nini.inventory.v1";

interface StoredInventory {
  coins: number;
  owned: string[];
  equipped: { token: string; theme: string };
}

function load(): StoredInventory {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    coins: 10000,
    owned: [
      "token-car", "token-dog", "token-hat", "token-cat", "token-crown", "token-ufo",
      "theme-classic",
    ],
    equipped: { token: "token-car", theme: "theme-classic" },
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
  const owned = computed(() => new Set(state.value.owned));
  const equippedToken = computed(() => state.value.equipped.token);
  const equippedTheme = computed(() => state.value.equipped.theme);

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

  return { coins, owned, equippedToken, equippedTheme, buy, equip, addCoins };
});
