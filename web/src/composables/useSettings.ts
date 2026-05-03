import { ref, watch } from "vue";

interface Settings {
  sound: boolean;
  vibration: boolean;
  motion: boolean;
}

const STORAGE_KEY = "settings";
const defaults: Settings = { sound: true, vibration: true, motion: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

const state = ref<Settings>(load());

watch(
  state,
  (v) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {}
  },
  { deep: true },
);

export function useSettings() {
  return state;
}
