"use client";

import { useCallback, useState } from "react";
import {
  deleteQuestion,
  deleteQuestionGroup,
  listGroupQuestions,
} from "@/lib/backend";
import type { PublicQuestion, QuestionGroupSummary } from "@/lib/types";

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
  const [questions, setQuestions] = useState<Record<string, PublicQuestion[]>>(
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold">Group Soal</h2>
      {error ? (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">
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
                className="rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void toggle(group.id)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="truncate text-sm font-bold">
                      {group.name}
                    </span>
                    <span className="truncate text-xs text-slate-500">
                      {group.subject} · {group.question_count} soal ·{" "}
                      {open ? "Tutup" : "Lihat soal"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === group.id}
                    onClick={() => void removeGroup(group.id)}
                    className="rounded-lg border border-red-400 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-slate-800"
                  >
                    Hapus
                  </button>
                </div>
                {open ? (
                  <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
                    {loadingId === group.id ? (
                      <p className="text-sm text-slate-500">Memuat soal...</p>
                    ) : list && list.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {list.map((question) => (
                          <li
                            key={question.id}
                            className="flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm">{question.question_text}</p>
                              <p className="text-xs text-slate-500">
                                {TYPE_LABEL[question.type] ?? question.type} ·{" "}
                                {DIFFICULTY_LABEL[question.difficulty] ??
                                  question.difficulty}{" "}
                                · {question.points} poin
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={busyId === question.id}
                              onClick={() =>
                                void removeQuestion(group.id, question.id)
                              }
                              className="shrink-0 rounded-lg border border-red-300 px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-slate-800"
                            >
                              Hapus
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">
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
