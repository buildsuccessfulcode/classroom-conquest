"use client";

import { useState } from "react";
import type { PublicQuestion } from "@/lib/types";

interface QuestionCardProps {
  question: PublicQuestion;
  busy?: boolean;
  readOnly?: boolean;
  attemptsLeft?: number;
  onSubmit: (answer: string) => void;
}

export default function QuestionCard({
  question,
  busy = false,
  readOnly = false,
  attemptsLeft,
  onSubmit,
}: QuestionCardProps) {
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const words = question.metadata?.words ?? [];

  const header = (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
        {question.difficulty} · {question.points} poin
      </span>
      {typeof attemptsLeft === "number" && !readOnly ? (
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          Sisa percobaan: {attemptsLeft}
        </span>
      ) : null}
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        {question.question_text}
      </p>
    </div>
  );

  if (question.type === "MULTIPLE_CHOICE") {
    const options = question.metadata?.options ?? [];
    return (
      <div className="flex flex-col gap-3">
        {header}
        <div className="flex flex-col gap-2">
          {options.map((option, index) => (
            <button
              key={`${index}-${option}`}
              type="button"
              disabled={busy || readOnly}
              onClick={() => onSubmit(option)}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "SHORT_ANSWER") {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !readOnly && input.trim()) onSubmit(input);
        }}
      >
        {header}
        {question.metadata?.code_snippet ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-sm text-green-400">
            {question.metadata.code_snippet}
          </pre>
        ) : null}
        <input
          type="text"
          value={input}
          disabled={busy || readOnly}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tuliskan jawaban di sini..."
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {readOnly ? null : (
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
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
    <div className="flex flex-col gap-3">
      {header}
      <div className="flex min-h-14 flex-wrap gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800">
        {pickedWords.length === 0 ? (
          <span className="text-sm text-slate-400">
            Klik kata untuk menyusun jawaban.
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
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
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
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {item.word}
          </button>
        ))}
      </div>
      {readOnly ? null : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || picked.length === 0}
            onClick={() => setPicked([])}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
          >
            Ulangi
          </button>
          <button
            type="button"
            disabled={busy || picked.length === 0}
            onClick={() => onSubmit(pickedWords.join(" "))}
            className="flex-1 rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Memeriksa..." : "Kirim Jawaban"}
          </button>
        </div>
      )}
    </div>
  );
}
