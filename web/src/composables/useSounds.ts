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
  // Use volume=0 (not muted) — iOS Safari sometimes ignores `muted`
  // set right before play() and leaks audible playback for a few ms,
  // which on the long step.mp3 manifests as a "walking sound on
  // game entry" (playtester 2026-05-03).
  const unlock = () => {
    (Object.keys(SRC) as Key[]).forEach((k) => {
      const a = elements[k];
      if (!a) return;
      a.volume = 0;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 0.7;
        }).catch(() => {
          a.volume = 0.7;
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
    // Reuse the preloaded element instead of cloneNode — clone forces
    // the browser through the load + decode pipeline again which adds
    // hundreds of ms of latency on iOS / Telegram WebView (playtester
    // 2026-05-03 "звуки покупок и тд с задержкой адской"). Restarting
    // by setting currentTime=0 + play() fires the sting basically
    // instantly. Trade-off: two rapid calls truncate each other, but
    // game events don't fire faster than ~150ms apart in practice
    // and "last event wins" is fine UX for cash/buy/notify.
    base.volume = volume;
    base.currentTime = 0;
    const p = base.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* ignore */ });
  } catch {
    /* ignore */
  }
}

/** Dice tumble — fires when the visual tumble starts. */
export function playDice(): void {
  fire("dice");
}

/**
 * Length of the dice sting in ms, once the asset has loaded. Returns
 * null while the metadata is still arriving — game.ts uses that as a
 * "fall back to a fixed 900ms" signal so the rolling phase still
 * resolves on cold loads.
 */
export function diceDurationMs(): number | null {
  const a = elements.dice;
  if (!a) return null;
  const d = a.duration;
  if (!isFinite(d) || d <= 0) return null;
  return Math.round(d * 1000);
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

// Token walk SFX is a single continuous mp3 (not a per-tile click), so
// we use a start/stop pair against the preloaded element directly
// instead of cloning. The game store calls startStep() once at the
// beginning of the walk and stopStep() the moment the token lands —
// otherwise the sound trails on past the animation end (~1s+ leftover).
export function startStep(): void {
  if (!shouldPlay()) return;
  const a = preload("step");
  if (!a) return;
  try {
    a.currentTime = 0;
    a.volume = 0.55;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* ignore */ });
  } catch {
    /* ignore */
  }
}

export function stopStep(): void {
  const a = elements.step;
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
  } catch {
    /* ignore */
  }
}
