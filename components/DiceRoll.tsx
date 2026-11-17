"use client";

import { useEffect, useState } from "react";
import { stepRangeFor } from "@/lib/game";
import type { Difficulty } from "@/lib/types";

export const DICE_ROLL_MS = 1800;

const SPIN_MS = 950;
const TICK_MS = 90;

const DIFFICULTY_STYLE: Record<
  Difficulty,
  { label: string; className: string }
> = {
  EASY: { label: "Soal Mudah", className: "bg-brand-soft text-brand-dark" },
  MEDIUM: { label: "Soal Sedang", className: "bg-sun-soft text-sun-dark" },
  HARD: { label: "Soal Sulit", className: "bg-cherry-soft text-cherry-dark" },
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function splitDice(total: number): [number, number] {
  const low = Math.max(1, total - 6);
  const high = Math.min(6, total - 1);
  const first = low + Math.floor(Math.random() * (high - low + 1));
  return [first, total - first];
}

function randomDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  const pips = PIPS[value] ?? [];
  return (
    <div
      className={[
        "grid h-20 w-20 grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-4 border-cloud bg-white p-2 shadow-lg",
        rolling ? "cc-dice-roll" : "cc-pop",
      ].join(" ")}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={[
            "h-full w-full rounded-full",
            pips.includes(index) ? "bg-ink" : "bg-transparent",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export default function DiceRoll({
  value,
  difficulty,
}: {
  value: number;
  difficulty: Difficulty;
}) {
  const total = Math.max(2, Math.min(12, value || 0));
  const [dice, setDice] = useState<[number, number]>([1, 1]);
  const [settled, setSettled] = useState(false);
  const style = DIFFICULTY_STYLE[difficulty] ?? DIFFICULTY_STYLE.EASY;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDice([randomDie(), randomDie()]);
    }, TICK_MS);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDice(splitDice(total));
      setSettled(true);
    }, SPIN_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [total]);

  const range = stepRangeFor(difficulty);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="cc-bounce-in flex flex-col items-center gap-4 rounded-[2rem] bg-white px-8 py-6 text-center shadow-2xl">
        <span
          className={`rounded-full px-3 py-1 text-xs font-extrabold ${style.className}`}
        >
          {style.label} · {range.min}-{range.max} petak
        </span>
        <div className="flex items-center gap-3">
          <DieFace value={dice[0]} rolling={!settled} />
          <DieFace value={dice[1]} rolling={!settled} />
        </div>
        <div>
          <p className="cc-display text-2xl font-extrabold text-ink">
            {settled ? `Maju ${total} petak!` : "Dadu berputar..."}
          </p>
          <p className="mt-1 text-sm font-bold text-ink-soft">
            {settled
              ? "Bidak bergerak sesuai hasil dadu."
              : "Tunggu dadu berhenti."}
          </p>
        </div>
      </div>
    </div>
  );
}
