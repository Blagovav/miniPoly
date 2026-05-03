// SFX playback layer — wraps a small set of mp3 assets shipped under
// /audio. Each helper plays a fresh clone of the preloaded Audio so
// overlapping triggers (rapid cash-out + buy on the same turn, walk
// step + dice landing, etc.) don't cut each other off.
//
// iOS Safari / Telegram WebView gate `audio.play()` outside a user
// gesture: the very first call from a watcher (e.g. dice tumble fires
// from `watch(rolling)`) would otherwise reject and stay silent for the
// whole session. We install a one-time pointerdown/touchstart/click
// listener at module load that "primes" each preloaded element by
// loading + playing it muted; afterwards play() works from any context.
//
// Each play is a no-op when settings.sound is off or the asset failed
// to load. Errors are swallowed so audio failures never block gameplay.
import { useSettings } from "./useSettings";

const SRC = {
  dice: "/audio/dice.mp3",
  payment: "/audio/payment.mp3",
  cashOut: "/audio/cash-out.mp3",
  notify: "/audio/notify.mp3",
  step: "/audio/step.mp3",
} as const;

type Key = keyof typeof SRC;

const elements: Partial<Record<Key, HTMLAudioElement>> = {};

function preload(key: Key): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const cached = elements[key];
  if (cached) return cached;
  try {
    const a = new Audio(SRC[key]);
    a.preload = "auto";
    a.volume = 0.7;
    elements[key] = a;
    return a;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  // Pre-warm audio elements at module load so the first play() doesn't
  // pay for a network round-trip mid-roll.
  (Object.keys(SRC) as Key[]).forEach(preload);

  // Unlock all preloaded elements on the first user gesture. Without
  // this, mobile Safari rejects play() that fires from a watcher
  // (dice tumble, your-turn watcher) and the session stays silent.
  const unlock = () => {
    (Object.keys(SRC) as Key[]).forEach((k) => {
      const a = elements[k];
      if (!a) return;
      const wasMuted = a.muted;
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = wasMuted;
        }).catch(() => {
          a.muted = wasMuted;
        });
      }
    });
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("click", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  window.addEventListener("click", unlock, { once: true, passive: true });
}

function shouldPlay(): boolean {
  return !!useSettings().value.sound;
}

function fire(key: Key, volume = 0.7): void {
  if (!shouldPlay()) return;
  const base = preload(key);
  if (!base) return;
  try {
    // Clone the preloaded element so overlapping triggers (e.g. step +
    // step on consecutive frames) don't restart each other mid-clip.
    const clone = base.cloneNode(true) as HTMLAudioElement;
    clone.volume = volume;
    const p = clone.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* ignore */ });
  } catch {
    /* ignore */
  }
}

/** Dice tumble — fires when the visual tumble starts. */
export function playDice(): void {
  fire("dice");
}

/** Property purchase — incoming buy / received rent / sold a property. */
export function playBuy(): void {
  fire("payment");
}
export function playCashIn(): void {
  fire("payment");
}

/** Cash deduction — paying rent, forced sale, tax. */
export function playCashOut(): void {
  fire("cashOut");
}

/** "Your turn" chime, paired with a Telegram haptic at the call site. */
export function playYourTurn(): void {
  fire("notify");
}

/** Token step — fires per tile during the walk animation. */
export function playStep(): void {
  // Lower volume — steps fire 2-12 times in quick succession, full
  // volume gets oppressive. The base mp3 is already short.
  fire("step", 0.4);
}
