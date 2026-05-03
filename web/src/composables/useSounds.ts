// Tiny Web-Audio synth for game-feel SFX. We don't ship audio assets — the
// stings here are short bursts of oscillator + noise that work everywhere
// without an asset budget. The shared AudioContext is lazy-initialised on
// the first play so iOS Safari (which gates AC creation behind a user
// gesture) doesn't choke during boot.
//
// Each play is a no-op when settings.sound is off or the AC can't be
// created (very old browsers). Errors are swallowed so audio failures
// never block gameplay.
import { useSettings } from "./useSettings";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

function shouldPlay(): boolean {
  return !!useSettings().value.sound;
}

function envelope(
  ac: AudioContext,
  node: AudioNode,
  attack: number,
  release: number,
  peak = 0.18,
): GainNode {
  const g = ac.createGain();
  const t0 = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  node.connect(g);
  g.connect(ac.destination);
  return g;
}

/** Dice tumble — short white-noise burst with a low click on tail. */
export function playDice(): void {
  if (!shouldPlay()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    const dur = 0.35;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // Decay-shaped noise — feels like dice tumbling onto felt.
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * 0.8;
    }
    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    const filt = ac.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1800;
    filt.Q.value = 0.6;
    noise.connect(filt);
    envelope(ac, filt, 0.01, dur, 0.22);
    noise.start();
    noise.stop(ac.currentTime + dur + 0.05);

    // Tail click — settles the tumble, like cubes locking.
    setTimeout(() => {
      const click = ac.createOscillator();
      click.type = "square";
      click.frequency.value = 220;
      envelope(ac, click, 0.005, 0.08, 0.12);
      click.start();
      click.stop(ac.currentTime + 0.1);
    }, 280);
  } catch { /* ignore */ }
}

/** Property purchase — three-tone arpeggio, major triad up. */
export function playBuy(): void {
  if (!shouldPlay()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        envelope(ac, osc, 0.01, 0.18, 0.15);
        osc.start();
        osc.stop(ac.currentTime + 0.2);
      }, i * 80);
    });
  } catch { /* ignore */ }
}

/** Cash deduction — short descending two-tone, "ka-ching but sad". */
export function playCashOut(): void {
  if (!shouldPlay()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    [659.25, 392.00].forEach((freq, i) => {
      setTimeout(() => {
        const osc = ac.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        const filt = ac.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = 1200;
        osc.connect(filt);
        envelope(ac, filt, 0.005, 0.16, 0.14);
        osc.start();
        osc.stop(ac.currentTime + 0.18);
      }, i * 70);
    });
  } catch { /* ignore */ }
}

/** Cash gain — bright single chime. */
export function playCashIn(): void {
  if (!shouldPlay()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.frequency.exponentialRampToValueAtTime(1320, ac.currentTime + 0.18);
    envelope(ac, osc, 0.005, 0.22, 0.16);
    osc.start();
    osc.stop(ac.currentTime + 0.25);
  } catch { /* ignore */ }
}

/** Subtle "your turn" chime. Paired with a Telegram haptic at the call site. */
export function playYourTurn(): void {
  if (!shouldPlay()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    [523.25, 783.99].forEach((freq, i) => {
      setTimeout(() => {
        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        envelope(ac, osc, 0.01, 0.22, 0.13);
        osc.start();
        osc.stop(ac.currentTime + 0.24);
      }, i * 110);
    });
  } catch { /* ignore */ }
}
