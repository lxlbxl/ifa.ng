/**
 * In-app alert sound and vibration for Babalawos.
 *
 * The chime is synthesised with Web Audio, so there is no sound file to cache.
 * Browsers only allow sound after the person has tapped the page once, so
 * unlockAudio() runs on the first tap (and on the Online switch).
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;
const listeners = new Set<() => void>();

function getCtx(): Ctx | null {
  if (ctx) return ctx;
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  ctx.addEventListener?.("statechange", () => listeners.forEach((l) => l()));
  return ctx;
}

export const soundSupported = () => typeof window !== "undefined" && Boolean(
  (window as unknown as { AudioContext?: unknown }).AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
export const vibrationSupported = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
export const audioUnlocked = () => ctx?.state === "running";
export const onAudioStateChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Call from a tap. Plays nothing; just allows later sounds. */
export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
    // A silent blip finishes the unlock on iOS Safari.
    const o = c.createOscillator(); const g = c.createGain();
    g.gain.value = 0; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.01);
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
  return c.state === "running";
}

/** Unlock on the first tap anywhere, once. */
export function unlockOnFirstGesture() {
  const go = () => { unlockAudio(); window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
  window.addEventListener("pointerdown", go, { passive: true });
  window.addEventListener("keydown", go);
  return () => { window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
}

/** A bright two-bell chime, like an agogo: high then low. */
function chime(c: Ctx, at: number, loud: boolean) {
  const notes = [{ f: 1318.5, t: 0 }, { f: 987.8, t: 0.18 }, { f: 1318.5, t: 0.5 }, { f: 987.8, t: 0.68 }];
  const peak = loud ? 0.55 : 0.35;
  for (const n of notes.slice(0, loud ? 4 : 2)) {
    for (const [mult, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.1]] as const) {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = "sine"; o.frequency.value = n.f * mult;
      const s = at + n.t;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(peak * amp, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.55);
      o.connect(g).connect(c.destination); o.start(s); o.stop(s + 0.6);
    }
  }
}

export const VIBRATE_URGENT = [400, 150, 400, 150, 800];
export const VIBRATE_NORMAL = [250, 100, 250];

/**
 * Plays the alert. Urgent alerts (Consult Now) repeat every 2.5 s until stop()
 * or `maxMs`; other alerts chime once. Returns stop().
 */
export function ring(opts: { urgent?: boolean; maxMs?: number } = {}): () => void {
  const urgent = !!opts.urgent;
  const c = getCtx();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const once = () => {
    if (stopped) return;
    if (c && c.state === "running") chime(c, c.currentTime + 0.02, urgent);
    if (vibrationSupported()) navigator.vibrate(urgent ? VIBRATE_URGENT : VIBRATE_NORMAL);
  };
  if (c && c.state !== "running") c.resume().catch(() => {});
  once();
  if (urgent) {
    timer = setInterval(once, 2500);
    setTimeout(() => stop(), opts.maxMs ?? 45_000);
  }
  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    if (vibrationSupported()) navigator.vibrate(0);
  }
  return stop;
}
