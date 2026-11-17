"use client";

import { useEffect, useState } from "react";
import type { EarnedBadge } from "@/lib/gamification";
import BadgeIcon from "./BadgeIcon";
import Mascot from "./Mascot";
import { FlameIcon, SparkleIcon } from "./icons";

interface AnswerFeedbackProps {
  variant: "correct" | "wrong";
  xp?: number;
  unit?: string;
  streak?: number;
  badge?: EarnedBadge | null;
  levelUp?: boolean;
  level?: number;
  message?: string;
  detail?: string;
  onDismiss?: () => void;
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
  { left: 2, delay: 0, duration: 2.0, color: "#58cc02", size: 10, round: false },
  { left: 8, delay: 0.35, duration: 2.4, color: "#ffc800", size: 8, round: true },
  { left: 15, delay: 0.1, duration: 1.9, color: "#1cb0f6", size: 12, round: false },
  { left: 21, delay: 0.55, duration: 2.3, color: "#ff4b4b", size: 9, round: true },
  { left: 28, delay: 0.2, duration: 2.1, color: "#ce82ff", size: 11, round: false },
  { left: 34, delay: 0.7, duration: 2.5, color: "#ff9600", size: 8, round: true },
  { left: 40, delay: 0.05, duration: 2.0, color: "#89e219", size: 10, round: false },
  { left: 46, delay: 0.45, duration: 2.2, color: "#58cc02", size: 9, round: true },
  { left: 52, delay: 0.15, duration: 2.4, color: "#1cb0f6", size: 12, round: false },
  { left: 58, delay: 0.6, duration: 2.0, color: "#ffc800", size: 8, round: true },
  { left: 64, delay: 0.25, duration: 2.3, color: "#ff4b4b", size: 11, round: false },
  { left: 70, delay: 0.8, duration: 2.5, color: "#ce82ff", size: 9, round: true },
  { left: 76, delay: 0.3, duration: 2.1, color: "#ff9600", size: 10, round: false },
  { left: 82, delay: 0.5, duration: 2.2, color: "#89e219", size: 8, round: true },
  { left: 88, delay: 0.12, duration: 2.4, color: "#58cc02", size: 12, round: false },
  { left: 94, delay: 0.65, duration: 2.0, color: "#1cb0f6", size: 9, round: true },
  { left: 5, delay: 0.9, duration: 2.6, color: "#ff4b4b", size: 10, round: false },
  { left: 12, delay: 1.05, duration: 2.3, color: "#ffc800", size: 8, round: true },
  { left: 19, delay: 0.75, duration: 2.5, color: "#ce82ff", size: 11, round: false },
  { left: 25, delay: 1.15, duration: 2.2, color: "#ff9600", size: 9, round: true },
  { left: 31, delay: 0.95, duration: 2.4, color: "#89e219", size: 10, round: false },
  { left: 37, delay: 1.25, duration: 2.1, color: "#58cc02", size: 8, round: true },
  { left: 43, delay: 0.85, duration: 2.6, color: "#1cb0f6", size: 12, round: false },
  { left: 49, delay: 1.35, duration: 2.3, color: "#ff4b4b", size: 9, round: true },
  { left: 55, delay: 1.0, duration: 2.0, color: "#ce82ff", size: 10, round: false },
  { left: 61, delay: 1.45, duration: 2.5, color: "#ffc800", size: 11, round: false },
  { left: 67, delay: 1.1, duration: 2.2, color: "#ff9600", size: 8, round: true },
  { left: 73, delay: 1.55, duration: 2.4, color: "#89e219", size: 10, round: false },
  { left: 79, delay: 1.2, duration: 2.1, color: "#58cc02", size: 9, round: true },
  { left: 85, delay: 1.6, duration: 2.6, color: "#1cb0f6", size: 11, round: false },
  { left: 91, delay: 1.3, duration: 2.3, color: "#ff4b4b", size: 8, round: true },
  { left: 97, delay: 1.7, duration: 2.5, color: "#ce82ff", size: 10, round: false },
];

export default function AnswerFeedback({
  variant,
  xp = 0,
  unit = "XP",
  streak = 0,
  badge = null,
  levelUp = false,
  level,
  message,
  detail,
  onDismiss,
}: AnswerFeedbackProps) {
  const correct = variant === "correct";
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!correct) return;
    let frame = 0;
    const total = 26;
    const id = window.setInterval(() => {
      frame += 1;
      setShown(Math.round((xp * frame) / total));
      if (frame >= total) window.clearInterval(id);
    }, 26);
    return () => window.clearInterval(id);
  }, [correct, xp]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
      onClick={onDismiss}
      role={onDismiss ? "button" : undefined}
      tabIndex={onDismiss ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onDismiss) return;
        if (event.key === "Enter" || event.key === " ") onDismiss();
      }}
    >
      <div
        className={[
          "absolute inset-0 backdrop-blur-sm",
          correct ? "bg-emerald-950/60" : "bg-slate-900/70",
        ].join(" ")}
      />

      {correct
        ? CONFETTI.map((piece, index) => (
            <span
              key={index}
              className="cc-confetti absolute top-[-10%] block"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.round ? piece.size : piece.size * 0.5,
                backgroundColor: piece.color,
                borderRadius: piece.round ? "9999px" : "2px",
                animationDelay: `${piece.delay * 0.35}s`,
                animationDuration: `${Math.min(piece.duration, 1.1)}s`,
              }}
            />
          ))
        : null}

      <div
        className={[
          "relative flex w-full max-w-sm flex-col items-center gap-3 px-6 text-center",
          correct ? "" : "cc-shake",
        ].join(" ")}
      >
        {correct ? (
          <span className="cc-ring absolute left-1/2 top-24 h-44 w-44 rounded-full border-4 border-brand-light" />
        ) : null}

        <div className="cc-pop">
          <Mascot
            mood={correct ? "cheer" : "think"}
            size={150}
            float={!correct}
          />
        </div>

        {correct ? (
          <>
            <p className="cc-display cc-pop text-6xl font-extrabold text-white drop-shadow-lg">
              +{shown} {unit}
            </p>
            <p
              className="cc-rise text-sm font-bold text-brand-soft"
              style={{ animationDelay: "0.15s" }}
            >
              {detail || "Jawaban benar!"}
            </p>

            {streak >= 2 ? (
              <span
                className="cc-bounce-in flex items-center gap-1.5 rounded-full bg-mango px-4 py-1.5 text-sm font-extrabold text-white shadow-lg"
                style={{ animationDelay: "0.25s" }}
              >
                <FlameIcon className="cc-flame h-5 w-5" />
                Streak {streak}
              </span>
            ) : null}

            {levelUp ? (
              <span
                className="cc-bounce-in flex items-center gap-1.5 rounded-full bg-grape px-4 py-1.5 text-sm font-extrabold text-white shadow-lg"
                style={{ animationDelay: "0.35s" }}
              >
                <SparkleIcon className="h-5 w-5" />
                Naik ke Level {level}!
              </span>
            ) : null}

            {badge ? (
              <div
                className="cc-bounce-in mt-1 flex items-center gap-3 rounded-2xl border-b-4 border-black/15 bg-white px-4 py-3 text-left shadow-xl"
                style={{ animationDelay: "0.45s" }}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-grape text-white">
                  <BadgeIcon id={badge.id} className="h-7 w-7" />
                </span>
                <span>
                  <span className="block text-[11px] font-extrabold uppercase tracking-wide text-grape-dark">
                    Badge baru
                  </span>
                  <span className="block text-base font-extrabold text-ink">
                    {badge.label}
                  </span>
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="cc-display cc-pop text-4xl font-extrabold text-white drop-shadow-lg">
              Belum tepat
            </p>
            <p
              className="cc-rise max-w-xs text-sm font-bold text-slate-100"
              style={{ animationDelay: "0.15s" }}
            >
              {message || "Tidak ada pengurangan poin. Kamu masih bisa mencoba."}
            </p>
            <span className="cc-rise rounded-full bg-white/15 px-4 py-1.5 text-xs font-extrabold text-white">
              Tarik napas, lalu pilih nomor lain
            </span>
          </>
        )}

        {onDismiss ? (
          <span
            className="cc-rise mt-1 text-xs font-extrabold uppercase tracking-widest text-white/70"
            style={{ animationDelay: "0.3s" }}
          >
            Ketuk untuk lanjut
          </span>
        ) : null}
      </div>
    </div>
  );
}
