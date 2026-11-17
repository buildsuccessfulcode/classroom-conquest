"use client";

import { useCallback, useState } from "react";
import {
  deleteQuestion,
  deleteQuestionGroup,
  listGroupQuestions,
} from "@/lib/backend";
import type { Question, QuestionGroupSummary } from "@/lib/types";
import { TrashIcon } from "./icons";

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Pilihan ganda",
  SHORT_ANSWER: "Isian",
  REARRANGE_WORDS: "Susun kata",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Mudah",
  MEDIUM: "Sedang",
  HARD: "Sulit",
};

export default function QuestionGroupList({
  groups,
  onChanged,
}: {
  groups: QuestionGroupSummary[];
  onChanged: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question[]>>(
    {},
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (groupId: string) => {
      setError(null);
      if (expandedId === groupId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(groupId);
      if (questions[groupId]) return;
      setLoadingId(groupId);
      try {
        const list = await listGroupQuestions(groupId);
        setQuestions((prev) => ({ ...prev, [groupId]: list }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat soal");
      } finally {
        setLoadingId(null);
      }
    },
    [expandedId, questions],
  );

  const removeGroup = async (groupId: string) => {
    if (!window.confirm("Hapus group beserta seluruh soalnya?")) return;
    setError(null);
    setBusyId(groupId);
    try {
      await deleteQuestionGroup(groupId);
      setQuestions((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      if (expandedId === groupId) setExpandedId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus group");
    } finally {
      setBusyId(null);
    }
  };

  const removeQuestion = async (groupId: string, questionId: string) => {
    if (!window.confirm("Hapus soal ini?")) return;
    setError(null);
    setBusyId(questionId);
    try {
      await deleteQuestion(questionId);
      setQuestions((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((q) => q.id !== questionId),
      }));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus soal");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="cc-card p-5">
      <h2 className="cc-display mb-4 text-xl font-extrabold text-ink">
        Group Soal
      </h2>
      {error ? (
        <p className="mb-3 rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
          {error}
        </p>
      ) : null}
      {groups.length === 0 ? (
        <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
          Belum ada group soal. Impor soal terlebih dahulu.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => {
            const open = expandedId === group.id;
            const list = questions[group.id];
            return (
              <li
                key={group.id}
                className="overflow-hidden rounded-2xl border-2 border-cloud"
              >
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void toggle(group.id)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="truncate text-sm font-extrabold text-ink">
                      {group.name}
                    </span>
                    <span className="truncate text-xs font-semibold text-ink-soft">
                      {group.subject} · {group.question_count} soal ·{" "}
                      {open ? "Tutup" : "Lihat soal"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === group.id}
                    onClick={() => void removeGroup(group.id)}
                    aria-label="Hapus group"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cherry-soft text-cherry-dark transition hover:bg-cherry hover:text-white disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                {open ? (
                  <div className="border-t-2 border-cloud bg-snow px-3 py-3">
                    {loadingId === group.id ? (
                      <p className="text-sm font-bold text-ink-soft">
                        Memuat soal...
                      </p>
                    ) : list && list.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {list.map((question) => (
                          <li
                            key={question.id}
                            className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">
                                {question.question_text}
                              </p>
                              {question.metadata?.code_snippet ? (
                                <pre className="mt-1 overflow-x-auto rounded-lg bg-ink/90 p-2 font-mono text-xs text-white">
                                  {question.metadata.code_snippet}
                                </pre>
                              ) : null}
                              {question.metadata?.options ? (
                                <ul className="mt-1 flex flex-wrap gap-1.5">
                                  {question.metadata.options.map(
                                    (option, optionIndex) => (
                                      <li
                                        key={optionIndex}
                                        className="rounded-lg bg-snow px-2 py-1 text-xs font-semibold text-ink-soft"
                                      >
                                        {option}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              ) : null}
                              {question.metadata?.words ? (
                                <p className="mt-1 text-xs font-semibold text-ink-soft">
                                  Kata: {question.metadata.words.join(", ")}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs font-extrabold text-brand-dark">
                                Jawaban: {question.correct_answer}
                              </p>
                              <p className="text-xs font-semibold text-ink-soft">
                                {TYPE_LABEL[question.type] ?? question.type} ·{" "}
                                {DIFFICULTY_LABEL[question.difficulty] ??
                                  question.difficulty}{" "}
                                · {question.points} XP
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={busyId === question.id}
                              onClick={() =>
                                void removeQuestion(group.id, question.id)
                              }
                              aria-label="Hapus soal"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cherry-soft text-cherry-dark transition hover:bg-cherry hover:text-white disabled:opacity-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm font-bold text-ink-soft">
                        Group ini belum punya soal.
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
