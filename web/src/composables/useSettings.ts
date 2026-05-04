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
const SCHEMA_VERSION = 3;
/* motion defaults to false — shake-to-roll requires DeviceMotion
 * permission on iOS, and surprising the user with that prompt on the
 * first roll click scares people off. Now opt-in via Settings. */
const defaults: Settings = { sound: true, vibration: true, motion: false, _v: SCHEMA_VERSION };

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const stored = JSON.parse(raw) as Partial<Settings>;
    // Migrations:
    //   v1 → v2 (2026-05-03): sound default flipped false → true.
    //   v2 → v3 (2026-05-04): motion default flipped true → false so
    //     iOS doesn't get an unsolicited DeviceMotion permission prompt
    //     on the very first roll. Anyone who never saw the prompt won't
    //     notice; anyone who'd already granted will need to opt in
    //     again, which is fine — that's the explicit consent we want.
    if ((stored._v ?? 1) < SCHEMA_VERSION) {
      return { ...defaults, ...stored, sound: true, motion: false, _v: SCHEMA_VERSION };
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
