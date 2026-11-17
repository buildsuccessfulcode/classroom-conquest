"use client";

import { useState } from "react";
import type { Difficulty, PublicQuestion } from "@/lib/types";
import { normalizeAnswer } from "@/lib/game";
import { BoltIcon, CheckIcon, RefreshIcon } from "./icons";

interface QuestionCardProps {
  question: PublicQuestion;
  busy?: boolean;
  readOnly?: boolean;
  attemptsLeft?: number;
  correctAnswer?: string;
  rewardLabel?: string;
  onSubmit: (answer: string) => void;
}

const DIFFICULTY: Record<Difficulty, { label: string; className: string }> = {
  EASY: { label: "Mudah", className: "bg-brand-soft text-brand-dark" },
  MEDIUM: { label: "Sedang", className: "bg-sun-soft text-sun-dark" },
  HARD: { label: "Sulit", className: "bg-cherry-soft text-cherry-dark" },
};

const OPTION_STYLE = [
  { bg: "bg-cherry", border: "border-cherry-dark", label: "A" },
  { bg: "bg-ocean", border: "border-ocean-dark", label: "B" },
  { bg: "bg-mango", border: "border-mango-dark", label: "C" },
  { bg: "bg-brand", border: "border-brand-dark", label: "D" },
];

function OptionShape({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 4 21 19H3L12 4Z" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2 22 12 12 22 2 12 12 2Z" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

export default function QuestionCard({
  question,
  busy = false,
  readOnly = false,
  attemptsLeft,
  correctAnswer,
  rewardLabel,
  onSubmit,
}: QuestionCardProps) {
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const words = question.metadata?.words ?? [];
  const diff = DIFFICULTY[question.difficulty];
  const revealed = readOnly && typeof correctAnswer === "string";
  const normalizedCorrect = revealed ? normalizeAnswer(correctAnswer) : null;
  const answerBanner = revealed ? (
    <div className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-dark">
      Jawaban benar:{" "}
      <span className="font-extrabold">{correctAnswer}</span>
    </div>
  ) : null;

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-extrabold ${diff.className}`}
        >
          {diff.label}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-grape-soft px-3 py-1 text-xs font-extrabold text-grape-dark">
          <BoltIcon className="h-3.5 w-3.5" />
          {rewardLabel ?? `${question.points} XP`}
        </span>
        {typeof attemptsLeft === "number" && !readOnly ? (
          <span className="ml-auto rounded-full bg-snow px-3 py-1 text-xs font-extrabold text-ink-soft">
            Sisa {attemptsLeft} percobaan
          </span>
        ) : null}
      </div>
      <p className="cc-display text-xl font-extrabold leading-snug text-ink sm:text-2xl">
        {question.question_text}
      </p>
    </div>
  );

  if (question.type === "MULTIPLE_CHOICE") {
    const options = question.metadata?.options ?? [];
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option, index) => {
            const style = OPTION_STYLE[index % OPTION_STYLE.length];
            const isSelected = selected === index;
            const isCorrect =
              normalizedCorrect !== null &&
              normalizeAnswer(option) === normalizedCorrect;
            return (
              <button
                key={`${index}-${option}`}
                type="button"
                disabled={busy || readOnly}
                aria-pressed={isSelected}
                onClick={() => setSelected(index)}
                className={[
                  "cc-tile flex items-center gap-3 rounded-2xl border-2 border-b-4 p-4 text-left font-bold text-white transition",
                  style.bg,
                  style.border,
                  isCorrect
                    ? "ring-4 ring-white ring-offset-2 ring-offset-white"
                    : isSelected
                      ? "scale-[1.03] ring-4 ring-white ring-offset-2 ring-offset-white"
                      : selected !== null
                        ? "opacity-50"
                        : "opacity-95 hover:opacity-100",
                  readOnly && !isCorrect ? "opacity-70" : "",
                ].join(" ")}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25">
                  <OptionShape index={index} />
                </span>
                <span className="min-w-0 flex-1">{option}</span>
                {isCorrect || isSelected ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {answerBanner}
        {readOnly ? null : (
          <>
            <p className="text-sm font-extrabold text-ink-soft">
              {selected !== null
                ? `Pilihanmu: ${OPTION_STYLE[selected % OPTION_STYLE.length].label}`
                : "Pilih satu jawaban dulu."}
            </p>
            <button
              type="button"
              disabled={busy || selected === null}
              onClick={() => {
                if (selected !== null) onSubmit(options[selected]);
              }}
              className="cc-btn border-brand-dark bg-brand p-3.5 text-base text-white"
            >
              {busy ? "Memeriksa..." : "Periksa Jawaban"}
            </button>
          </>
        )}
      </div>
    );
  }

  if (question.type === "SHORT_ANSWER") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !readOnly && input.trim()) onSubmit(input);
        }}
      >
        {header}
        {question.metadata?.code_snippet ? (
          <pre className="overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-sm text-brand-light">
            {question.metadata.code_snippet}
          </pre>
        ) : null}
        <input
          type="text"
          value={revealed ? correctAnswer : input}
          disabled={busy || readOnly}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tuliskan jawabanmu di sini..."
          className="w-full rounded-2xl border-2 border-cloud bg-white p-4 text-lg font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
        />
        {answerBanner}
        {readOnly ? null : (
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="cc-btn border-brand-dark bg-brand p-3.5 text-base text-white"
          >
            {busy ? "Memeriksa..." : "Kirim Jawaban"}
          </button>
        )}
      </form>
    );
  }

  const pickedWords = picked.map((index) => words[index]);
  const available = words
    .map((word, index) => ({ word, index }))
    .filter((item) => !picked.includes(item.index));

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-cloud bg-snow p-3">
        {pickedWords.length === 0 ? (
          <span className="text-sm font-semibold text-ink-soft">
            Ketuk kata untuk menyusun jawaban.
          </span>
        ) : (
          pickedWords.map((word, index) => (
            <button
              key={`picked-${index}`}
              type="button"
              disabled={busy || readOnly}
              onClick={() =>
                setPicked((prev) => prev.filter((_, i) => i !== index))
              }
              className="cc-tile rounded-xl border-b-4 border-ocean-dark bg-ocean px-3.5 py-2 text-sm font-extrabold text-white"
            >
              {word}
            </button>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {available.map((item) => (
          <button
            key={`available-${item.index}`}
            type="button"
            disabled={busy || readOnly}
            onClick={() => setPicked((prev) => [...prev, item.index])}
            className="rounded-xl border-2 border-cloud bg-white px-3.5 py-2 text-sm font-extrabold text-ink transition hover:border-ocean hover:bg-ocean-soft disabled:opacity-60"
          >
            {item.word}
          </button>
        ))}
      </div>
      {answerBanner}
      {readOnly ? null : (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy || picked.length === 0}
            onClick={() => setPicked([])}
            className="cc-btn border-cloud bg-white px-4 py-3 text-sm text-ink-soft"
          >
            <RefreshIcon className="h-4 w-4" />
            Ulangi
          </button>
          <button
            type="button"
            disabled={busy || picked.length === 0}
            onClick={() => onSubmit(pickedWords.join(" "))}
            className="cc-btn flex-1 border-brand-dark bg-brand p-3.5 text-base text-white"
          >
            {busy ? "Memeriksa..." : "Kirim Jawaban"}
          </button>
        </div>
      )}
    </div>
  );
}
