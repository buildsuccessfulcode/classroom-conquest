"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ActivityLog from "@/components/ActivityLog";
import Leaderboard from "@/components/Leaderboard";
import ModeBadge from "@/components/ModeBadge";
import QuestionBankImporter from "@/components/QuestionBankImporter";
import QuestionBoard from "@/components/QuestionBoard";
import QuestionGroupList from "@/components/QuestionGroupList";
import { useGameState } from "@/hooks/useGameState";
import { useNow } from "@/hooks/useNow";
import { useStoredValue, writeStoredValue } from "@/hooks/useLocalStorage";
import {
  createSession,
  deleteSession,
  endSession,
  listQuestionGroups,
  listSessions,
  resetSession,
  startSession,
} from "@/lib/backend";
import { formatClock, remainingSeconds } from "@/lib/game";
import { formatDateTime } from "@/lib/format";
import type { QuestionGroupSummary, Session } from "@/lib/types";

const TEACHER_CODE_KEY = "classroom-conquest:teacher:code";

const STATUS_LABEL: Record<string, string> = {
  LOBBY: "Menunggu",
  PLAYING: "Berjalan",
  ENDED: "Berakhir",
};

export default function TeacherPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const selectedCode = useStoredValue(TEACHER_CODE_KEY);
  const setSelectedCode = useCallback((code: string | null) => {
    writeStoredValue(TEACHER_CODE_KEY, code);
  }, []);
  const [duration, setDuration] = useState(30);
  const [groups, setGroups] = useState<QuestionGroupSummary[]>([]);
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { state, loading, error: stateError, reload } = useGameState(selectedCode);
  const now = useNow();

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    }
  }, []);

  const refreshGroups = useCallback(async () => {
    try {
      setGroups(await listQuestionGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat group soal");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setSessions(await listSessions());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat sesi");
      }
      try {
        setGroups(await listQuestionGroups());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat group soal");
      }
    })();
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { code } = await createSession({
        groupId,
        durationMinutes: duration,
      });
      setSelectedCode(code);
      setMessage(`Sesi ${code} berhasil dibuat.`);
      await refreshSessions();
    });
  };

  const handleSessionAction = (
    action: "start" | "reset" | "end" | "delete",
  ) => {
    if (!selectedCode) return;
    void run(async () => {
      if (action === "start") await startSession(selectedCode);
      if (action === "reset") await resetSession(selectedCode);
      if (action === "end") await endSession(selectedCode);
      if (action === "delete") {
        await deleteSession(selectedCode);
        setSelectedCode(null);
      }
      await refreshSessions();
      await reload();
    });
  };

  const seconds = state ? remainingSeconds(state.session, now) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            ← Beranda
          </Link>
          <h1 className="text-3xl font-black">Dashboard Guru</h1>
        </div>
        <ModeBadge />
      </header>

      {message ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-bold">Buat Sesi Baru</h2>
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Group Soal
                <select
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white p-2 font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  required
                >
                  <option value="" disabled>
                    Pilih group soal
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.subject}) · {group.question_count} soal
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Durasi (menit)
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 bg-white p-2 font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <p className="text-xs text-slate-500">
                Nomor soal mengikuti seluruh soal dalam group, dibuat otomatis
                saat sesi dibuat.
              </p>
              {groups.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Belum ada group soal. Impor soal terlebih dahulu.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || groups.length === 0}
                className="rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                Buat Sesi
              </button>
            </form>
          </section>

          <QuestionBankImporter onImported={refreshGroups} />

          <QuestionGroupList groups={groups} onChanged={refreshGroups} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-bold">Sesi Terbaru</h2>
            <ul className="flex flex-col gap-2">
              {sessions.length === 0 ? (
                <li className="text-sm text-slate-500">Belum ada sesi.</li>
              ) : (
                sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCode(session.session_code)}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
                        selectedCode === session.session_code
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-slate-800"
                          : "border-slate-200 hover:border-indigo-300 dark:border-slate-700",
                      ].join(" ")}
                    >
                      <span className="font-mono font-bold">
                        {session.session_code}
                      </span>
                      <span className="truncate text-slate-500">
                        {session.subject_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(session.created_at)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            {!selectedCode ? (
              <p className="text-sm text-slate-500">
                Pilih atau buat sesi untuk mulai memantau.
              </p>
            ) : loading && !state ? (
              <p className="text-sm text-slate-500">Memuat sesi...</p>
            ) : stateError || !state ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {stateError ?? "Sesi tidak ditemukan"}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Kode Sesi
                    </p>
                    <p className="font-mono text-4xl font-black tracking-widest text-indigo-600 dark:text-indigo-400">
                      {state.session.session_code}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </p>
                    <p className="text-lg font-bold">
                      {STATUS_LABEL[state.session.status] ?? state.session.status}
                    </p>
                    {seconds !== null ? (
                      <p className="font-mono text-2xl font-black">
                        {formatClock(seconds)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || state.session.status === "PLAYING"}
                    onClick={() => handleSessionAction("start")}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Mulai
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSessionAction("reset")}
                    className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-bold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-slate-800"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={busy || state.session.status === "ENDED"}
                    onClick={() => handleSessionAction("end")}
                    className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Akhiri
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSessionAction("delete")}
                    className="rounded-lg border border-red-400 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-slate-800"
                  >
                    Hapus
                  </button>
                </div>

                {state.slots.length === 0 ? (
                  <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Nomor soal akan dibuat otomatis saat Anda menekan &ldquo;Mulai&rdquo;.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                    <div>
                      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                        Papan Nomor ({state.slots.length} soal)
                      </h3>
                      <QuestionBoard
                        mode="display"
                        totalSlots={state.slots.length}
                        teams={state.teams}
                        answers={state.answers}
                      />
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                          Peringkat
                        </h3>
                        <Leaderboard
                          teams={state.teams}
                          answers={state.answers}
                          totalSlots={state.slots.length}
                        />
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                          Aktivitas
                        </h3>
                        <ActivityLog logs={state.logs} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
