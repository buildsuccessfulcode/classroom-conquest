let context: AudioContext | null = null;

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

export function playFeedback(kind: "sent" | "correct" | "wrong"): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = "sine";

  const base = kind === "correct" ? 660 : kind === "wrong" ? 200 : 440;
  oscillator.frequency.setValueAtTime(base, now);
  if (kind === "correct") {
    oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.12);
  } else if (kind === "wrong") {
    oscillator.frequency.exponentialRampToValueAtTime(140, now + 0.18);
  }

  const duration = kind === "sent" ? 0.09 : kind === "correct" ? 0.22 : 0.2;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}
