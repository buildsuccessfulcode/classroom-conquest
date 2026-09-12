"use client";

interface AnswerCelebrationProps {
  points: number;
  questionPoints: number;
}

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  round: boolean;
}

const CONFETTI: ConfettiPiece[] = [
  { left: 2, delay: 0, duration: 2.0, color: "#6366f1", size: 10, round: false },
  { left: 8, delay: 0.35, duration: 2.4, color: "#f59e0b", size: 8, round: true },
  { left: 15, delay: 0.1, duration: 1.9, color: "#10b981", size: 12, round: false },
  { left: 21, delay: 0.55, duration: 2.3, color: "#f43f5e", size: 9, round: true },
  { left: 28, delay: 0.2, duration: 2.1, color: "#0ea5e9", size: 11, round: false },
  { left: 34, delay: 0.7, duration: 2.5, color: "#8b5cf6", size: 8, round: true },
  { left: 40, delay: 0.05, duration: 2.0, color: "#eab308", size: 10, round: false },
  { left: 46, delay: 0.45, duration: 2.2, color: "#6366f1", size: 9, round: true },
  { left: 52, delay: 0.15, duration: 2.4, color: "#10b981", size: 12, round: false },
  { left: 58, delay: 0.6, duration: 2.0, color: "#f59e0b", size: 8, round: true },
  { left: 64, delay: 0.25, duration: 2.3, color: "#f43f5e", size: 11, round: false },
  { left: 70, delay: 0.8, duration: 2.5, color: "#0ea5e9", size: 9, round: true },
  { left: 76, delay: 0.3, duration: 2.1, color: "#8b5cf6", size: 10, round: false },
  { left: 82, delay: 0.5, duration: 2.2, color: "#eab308", size: 8, round: true },
  { left: 88, delay: 0.12, duration: 2.4, color: "#6366f1", size: 12, round: false },
  { left: 94, delay: 0.65, duration: 2.0, color: "#10b981", size: 9, round: true },
  { left: 5, delay: 0.9, duration: 2.6, color: "#f43f5e", size: 10, round: false },
  { left: 12, delay: 1.05, duration: 2.3, color: "#f59e0b", size: 8, round: true },
  { left: 19, delay: 0.75, duration: 2.5, color: "#0ea5e9", size: 11, round: false },
  { left: 25, delay: 1.15, duration: 2.2, color: "#8b5cf6", size: 9, round: true },
  { left: 31, delay: 0.95, duration: 2.4, color: "#eab308", size: 10, round: false },
  { left: 37, delay: 1.25, duration: 2.1, color: "#6366f1", size: 8, round: true },
  { left: 43, delay: 0.85, duration: 2.6, color: "#10b981", size: 12, round: false },
  { left: 49, delay: 1.35, duration: 2.3, color: "#f43f5e", size: 9, round: true },
  { left: 55, delay: 1.0, duration: 2.0, color: "#0ea5e9", size: 10, round: false },
  { left: 61, delay: 1.45, duration: 2.5, color: "#f59e0b", size: 11, round: false },
  { left: 67, delay: 1.1, duration: 2.2, color: "#8b5cf6", size: 8, round: true },
  { left: 73, delay: 1.55, duration: 2.4, color: "#eab308", size: 10, round: false },
  { left: 79, delay: 1.2, duration: 2.1, color: "#6366f1", size: 9, round: true },
  { left: 85, delay: 1.6, duration: 2.6, color: "#10b981", size: 11, round: false },
  { left: 91, delay: 1.3, duration: 2.3, color: "#f43f5e", size: 8, round: true },
  { left: 97, delay: 1.7, duration: 2.5, color: "#0ea5e9", size: 10, round: false },
];

export default function AnswerCelebration({
  points,
  questionPoints,
}: AnswerCelebrationProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className="cc-confetti absolute top-[-10%] block"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.5,
            backgroundColor: piece.color,
            borderRadius: piece.round ? "9999px" : "2px",
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-1 px-6 text-center">
        <span className="cc-ring absolute h-44 w-44 rounded-full border-4 border-emerald-400" />
        <div className="cc-pop flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-11 w-11"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p
          className="cc-pop text-7xl font-black text-white drop-shadow-lg"
          style={{ animationDelay: "0.08s" }}
        >
          +{points}
        </p>
        <p
          className="cc-rise text-2xl font-black uppercase tracking-widest text-emerald-300"
          style={{ animationDelay: "0.2s" }}
        >
          Poin
        </p>
        <p
          className="cc-rise text-sm font-semibold text-slate-200"
          style={{ animationDelay: "0.32s" }}
        >
          Soal ini bernilai {questionPoints} poin
        </p>
      </div>
    </div>
  );
}
