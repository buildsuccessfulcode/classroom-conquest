let context: AudioContext | null = null;

export const SOUND_STORAGE_KEY = "classroom-conquest:sound";

export type FeedbackKind =
  | "sent"
  | "correct"
  | "wrong"
  | "start"
  | "end"
  | "leave";

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!ctor) return null;
  context = new ctor();
  return context;
}

export function haptic(pattern: number | number[] = 12): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    return;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
}

export function unlockAudio(): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    return;
  }
}

interface Tone {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

const PATTERNS: Record<FeedbackKind, Tone[]> = {
  sent: [{ freq: 520, at: 0, dur: 0.08, type: "sine", gain: 0.08 }],
  correct: [
    { freq: 523.25, at: 0, dur: 0.2, type: "triangle" },
    { freq: 659.25, at: 0.09, dur: 0.2, type: "triangle" },
    { freq: 783.99, at: 0.18, dur: 0.28, type: "triangle" },
  ],
  wrong: [
    { freq: 320, at: 0, dur: 0.18, type: "sawtooth", gain: 0.09, slideTo: 240 },
    { freq: 200, at: 0.16, dur: 0.24, type: "sawtooth", gain: 0.09, slideTo: 150 },
  ],
  start: [
    { freq: 392, at: 0, dur: 0.22, type: "triangle" },
    { freq: 523.25, at: 0.1, dur: 0.22, type: "triangle" },
    { freq: 659.25, at: 0.2, dur: 0.22, type: "triangle" },
    { freq: 783.99, at: 0.3, dur: 0.34, type: "triangle" },
  ],
  end: [
    { freq: 659.25, at: 0, dur: 0.28, type: "triangle" },
    { freq: 523.25, at: 0.14, dur: 0.28, type: "triangle" },
    { freq: 392, at: 0.28, dur: 0.28, type: "triangle" },
    { freq: 261.63, at: 0.42, dur: 0.42, type: "triangle" },
  ],
  leave: [
    { freq: 880, at: 0, dur: 0.14, type: "square", gain: 0.08 },
    { freq: 660, at: 0.18, dur: 0.18, type: "square", gain: 0.08 },
  ],
};

function playTone(ctx: AudioContext, tone: Tone, base: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = tone.type ?? "sine";
  const startAt = base + tone.at;
  const peak = tone.gain ?? 0.12;
  oscillator.frequency.setValueAtTime(tone.freq, startAt);
  if (tone.slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      tone.slideTo,
      startAt + tone.dur,
    );
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.dur);
  oscillator.start(startAt);
  oscillator.stop(startAt + tone.dur + 0.03);
}

export function playFeedback(kind: FeedbackKind): void {
  if (!isSoundEnabled()) return;
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const base = ctx.currentTime + 0.01;
  for (const tone of PATTERNS[kind]) playTone(ctx, tone, base);
}
