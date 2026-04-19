import { onUnmounted, ref } from "vue";

// Detects a deliberate phone shake (like rolling dice).
// Computes acceleration magnitude on each DeviceMotionEvent and fires the
// callback once magnitude clears a threshold, with a debounce so a single
// physical shake doesn't trigger multiple rolls.
//
// iOS 13+ requires DeviceMotionEvent.requestPermission() called from a user
// gesture — start() must be invoked inside a click handler on those devices,
// otherwise the permission prompt is rejected silently.
export function useShake() {
  const SHAKE_THRESHOLD = 16; // m/s^2 above gravity baseline
  const DEBOUNCE_MS = 900;
  const enabled = ref(false);
  let lastShakeAt = 0;
  let listener: ((e: DeviceMotionEvent) => void) | null = null;
  let onShake: (() => void) | null = null;

  function handleMotion(e: DeviceMotionEvent) {
    const a = e.acceleration ?? e.accelerationIncludingGravity;
    if (!a) return;
    const x = a.x ?? 0;
    const y = a.y ?? 0;
    const z = a.z ?? 0;
    let mag = Math.sqrt(x * x + y * y + z * z);
    // accelerationIncludingGravity sits near 9.81 at rest — subtract the
    // baseline so only real motion above gravity is measured.
    if (!e.acceleration && e.accelerationIncludingGravity) mag = Math.abs(mag - 9.81);
    if (mag < SHAKE_THRESHOLD) return;
    const now = Date.now();
    if (now - lastShakeAt < DEBOUNCE_MS) return;
    lastShakeAt = now;
    onShake?.();
  }

  async function start(cb: () => void): Promise<boolean> {
    onShake = cb;
    const DM: any = (window as any).DeviceMotionEvent;
    if (typeof DM?.requestPermission === "function") {
      try {
        const state = await DM.requestPermission();
        if (state !== "granted") return false;
      } catch {
        return false;
      }
    }
    if (!listener) {
      listener = handleMotion;
      try {
        window.addEventListener("devicemotion", listener);
      } catch {
        return false;
      }
    }
    enabled.value = true;
    return true;
  }

  function stop() {
    if (listener) {
      try { window.removeEventListener("devicemotion", listener); } catch {}
      listener = null;
    }
    onShake = null;
    enabled.value = false;
  }

  function setCallback(cb: (() => void) | null) {
    onShake = cb;
  }

  onUnmounted(stop);
  return { start, stop, enabled, setCallback };
}
