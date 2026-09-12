"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { logoutTeacher } from "@/app/actions";
import ActivityLog from "@/components/ActivityLog";
import CountdownTimer from "@/components/CountdownTimer";
import Leaderboard from "@/components/Leaderboard";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import QuestionBankImporter from "@/components/QuestionBankImporter";
import QuestionBoard from "@/components/QuestionBoard";
import QuestionGroupList from "@/components/QuestionGroupList";
import TimeWarningBanner from "@/components/TimeWarningBanner";
import {
  ArrowLeftIcon,
  LogOutIcon,
  PlayIcon,
  RefreshIcon,
  StopIcon,
  TrashIcon,
} from "@/components/icons";
import { useGameState } from "@/hooks/useGameState";
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
import { formatDateTime } from "@/lib/format";
import type { QuestionGroupSummary, Session } from "@/lib/types";

const TEACHER_CODE_KEY = "classroom-conquest:teacher:code";

const STATUS_LABEL: Record<string, string> = {
  LOBBY: "Menunggu",
  PLAYING: "Berjalan",
  ENDED: "Berakhir",
};

const STATUS_STYLE: Record<string, string> = {
  LOBBY: "bg-sun-soft text-sun-dark",
  PLAYING: "bg-brand-soft text-brand-dark",
  ENDED: "bg-cloud text-ink-soft",
};

export default function TeacherDashboard() {
  const router = useRouter();
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

  const handleLogout = () => {
    void (async () => {
      await logoutTeacher();
      router.refresh();
    })();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mascot mood="happy" size={56} />
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-ocean-dark"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Beranda
            </Link>
            <h1 className="cc-display text-3xl font-extrabold text-ink">
              Dashboard Guru
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge />
          <button
            type="button"
            onClick={handleLogout}
            className="cc-btn border-cloud bg-white px-3 py-2 text-xs text-ink-soft"
          >
            <LogOutIcon className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </header>

      {message ? (
        <p className="rounded-2xl border-2 border-brand-soft bg-brand-soft/50 px-4 py-2 text-sm font-bold text-brand-dark">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border-2 border-cherry-soft bg-cherry-soft/50 px-4 py-2 text-sm font-bold text-cherry-dark">
          {error}
        </p>
      ) : null}

      {state ? <TimeWarningBanner session={state.session} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-6">
          <section className="cc-card p-5">
            <h2 className="cc-display mb-4 text-xl font-extrabold text-ink">
              Buat Sesi Baru
            </h2>
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                Group Soal
                <select
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                  className="rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
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
              <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                Durasi (menit)
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                />
              </label>
              <p className="text-xs font-semibold text-ink-soft">
                Nomor soal mengikuti seluruh soal dalam group, dibuat otomatis
                saat sesi dibuat.
              </p>
              {groups.length === 0 ? (
                <p className="rounded-2xl bg-sun-soft px-3 py-2 text-xs font-bold text-sun-dark">
                  Belum ada group soal. Impor soal terlebih dahulu.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || groups.length === 0}
                className="cc-btn border-brand-dark bg-brand p-3.5 text-white"
              >
                Buat Sesi
              </button>
            </form>
          </section>

          <QuestionBankImporter onImported={refreshGroups} />

          <QuestionGroupList groups={groups} onChanged={refreshGroups} />

          <section className="cc-card p-5">
            <h2 className="cc-display mb-4 text-xl font-extrabold text-ink">
              Sesi Terbaru
            </h2>
            <ul className="flex flex-col gap-2">
              {sessions.length === 0 ? (
                <li className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
                  Belum ada sesi.
                </li>
              ) : (
                sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCode(session.session_code)}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-3 py-2.5 text-left text-sm transition",
                        selectedCode === session.session_code
                          ? "border-ocean bg-ocean-soft"
                          : "border-cloud bg-white hover:border-ocean/60",
                      ].join(" ")}
                    >
                      <span className="font-mono font-extrabold text-ink">
                        {session.session_code}
                      </span>
                      <span className="truncate font-semibold text-ink-soft">
                        {session.subject_name}
                      </span>
                      <span className="text-xs font-bold text-ink-soft">
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
          <section className="cc-card p-5">
            {!selectedCode ? (
              <p className="rounded-2xl bg-snow px-4 py-10 text-center text-sm font-bold text-ink-soft">
                Pilih atau buat sesi untuk mulai memantau.
              </p>
            ) : loading && !state ? (
              <p className="text-sm font-bold text-ink-soft">Memuat sesi...</p>
            ) : stateError || !state ? (
              <p className="text-sm font-bold text-cherry-dark">
                {stateError ?? "Sesi tidak ditemukan"}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                      Kode Sesi
                    </p>
                    <p className="cc-display font-mono text-4xl font-extrabold tracking-[0.2em] text-ocean-dark">
                      {state.session.session_code}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
                        STATUS_STYLE[state.session.status] ?? "bg-cloud text-ink-soft"
                      }`}
                    >
                      {STATUS_LABEL[state.session.status] ?? state.session.status}
                    </span>
                    <CountdownTimer
                      session={state.session}
                      size="md"
                      onExpire={() => void reload()}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || state.session.status === "PLAYING"}
                    onClick={() => handleSessionAction("start")}
                    className="cc-btn border-brand-dark bg-brand px-4 py-2.5 text-sm text-white"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Mulai
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSessionAction("reset")}
                    className="cc-btn border-mango-dark bg-mango px-4 py-2.5 text-sm text-white"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={busy || state.session.status === "ENDED"}
                    onClick={() => handleSessionAction("end")}
                    className="cc-btn border-cloud bg-white px-4 py-2.5 text-sm text-ink-soft"
                  >
                    <StopIcon className="h-4 w-4" />
                    Akhiri
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSessionAction("delete")}
                    className="cc-btn border-cherry-dark bg-cherry px-4 py-2.5 text-sm text-white"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Hapus
                  </button>
                </div>

                {state.slots.length === 0 ? (
                  <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
                    Nomor soal akan dibuat otomatis saat Anda menekan
                    &ldquo;Mulai&rdquo;.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                    <div>
                      <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
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
                        <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                          Peringkat
                        </h3>
                        <Leaderboard
                          teams={state.teams}
                          answers={state.answers}
                          totalSlots={state.slots.length}
                          variant="list"
                        />
                      </div>
                      <div>
                        <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
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
