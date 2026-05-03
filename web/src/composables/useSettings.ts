import { ref, watch } from "vue";

interface Settings {
  sound: boolean;
  vibration: boolean;
  motion: boolean;
  /** Schema version. Bump to trigger a one-shot migration that resets
   *  fields whose defaults changed without clobbering user choices. */
  _v?: number;
}

const STORAGE_KEY = "settings";
const SCHEMA_VERSION = 2;
const defaults: Settings = { sound: true, vibration: true, motion: true, _v: SCHEMA_VERSION };

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const stored = JSON.parse(raw) as Partial<Settings>;
    // Migration v1 → v2 (2026-05-03) — sound default flipped from
    // false to true. Users who saved settings before the flip got
    // stuck with sound: false because spread overrode the new
    // default. Reset sound to true on first load with the new
    // schema; subsequent toggles persist as the user expects.
    if ((stored._v ?? 1) < SCHEMA_VERSION) {
      return { ...defaults, ...stored, sound: true, _v: SCHEMA_VERSION };
    }
    return { ...defaults, ...stored };
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
