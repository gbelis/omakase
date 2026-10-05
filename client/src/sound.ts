// Tiny WebAudio sound effects — no assets required.
let ctx: AudioContext | null = null;
let muted = typeof localStorage !== "undefined" && localStorage.getItem("omakase.muted") === "1";

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, duration: number, when = 0, type: OscillatorType = "triangle", volume = 0.06): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem("omakase.muted", value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const sfx = {
  click: () => blip(440, 0.06, 0, "triangle", 0.045),
  select: () => blip(600, 0.05, 0, "sine", 0.04),
  swap: () => {
    blip(330, 0.08, 0, "triangle", 0.05);
    blip(494, 0.09, 0.08, "triangle", 0.05);
  },
  action: () => {
    blip(392, 0.07, 0, "square", 0.045);
    blip(587, 0.1, 0.07, "square", 0.045);
  },
  belt: () => blip(240, 0.05, 0, "sine", 0.035),
  check: () => {
    blip(523, 0.12, 0, "triangle", 0.05);
    blip(659, 0.12, 0.1, "triangle", 0.05);
    blip(784, 0.16, 0.2, "triangle", 0.05);
  },
  win: () => {
    blip(523, 0.12, 0, "triangle", 0.06);
    blip(659, 0.12, 0.12, "triangle", 0.06);
    blip(784, 0.12, 0.24, "triangle", 0.06);
    blip(1046, 0.22, 0.36, "triangle", 0.06);
  },
  lose: () => {
    blip(392, 0.16, 0, "sine", 0.05);
    blip(311, 0.24, 0.16, "sine", 0.05);
  },
};
