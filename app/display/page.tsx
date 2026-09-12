"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ActivityLog from "@/components/ActivityLog";
import Leaderboard from "@/components/Leaderboard";
import ModeBadge from "@/components/ModeBadge";
import QuestionBoard from "@/components/QuestionBoard";
import { useGameState } from "@/hooks/useGameState";
import { useNow } from "@/hooks/useNow";
import { buildLeaderboard, formatClock, remainingSeconds } from "@/lib/game";

const STATUS_LABEL: Record<string, string> = {
  LOBBY: "Menunggu peserta",
  PLAYING: "Berlangsung",
  ENDED: "Berakhir",
};

function DisplayInner() {
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get("code") ?? "").toUpperCase();
  const [inputCode, setInputCode] = useState(initialCode);
  const [activeCode, setActiveCode] = useState<string | null>(
    initialCode || null,
  );
  const { state, loading, error } = useGameState(activeCode);
  const now = useNow();

  if (!activeCode) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400"
          >
            ← Beranda
          </Link>
          <ModeBadge />
        </header>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h1 className="mb-1 text-2xl font-black">Papan Proyektor</h1>
          <p className="mb-5 text-sm text-slate-500">
            Masukkan kode sesi untuk menampilkan permainan.
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setActiveCode(inputCode.trim().toUpperCase());
            }}
          >
            <input
              value={inputCode}
              onChange={(event) => setInputCode(event.target.value.toUpperCase())}
              maxLength={6}
              required
              className="rounded-lg border border-slate-300 bg-white p-3 text-center font-mono text-3xl font-black tracking-widest text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="K3LH01"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700"
            >
              Tampilkan
            </button>
          </form>
        </div>
      </main>
    );
  }

  const totalSlots = state?.slots.length ?? 0;
  const seconds = state ? remainingSeconds(state.session, now) : null;
  const champion =
    state && totalSlots > 0
      ? buildLeaderboard(state.teams, state.answers, totalSlots)[0]
      : undefined;

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="font-mono text-4xl font-black tracking-widest text-indigo-600 dark:text-indigo-400">
            {activeCode}
          </span>
          {state ? (
            <div className="text-sm text-slate-500">
              <p className="font-bold text-slate-700 dark:text-slate-200">
                {state.session.subject_name}
              </p>
              <p>
                {totalSlots} soal ·{" "}
                {STATUS_LABEL[state.session.status] ?? state.session.status}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {seconds !== null ? (
            <span className="font-mono text-4xl font-black tabular-nums">
              {formatClock(seconds)}
            </span>
          ) : null}
          <ModeBadge />
          <button
            type="button"
            onClick={() => setActiveCode(null)}
            className="text-sm font-semibold text-slate-500 underline"
          >
            Ganti Kode
          </button>
        </div>
      </header>

      {loading && !state ? (
        <p className="text-sm text-slate-500">Memuat permainan...</p>
      ) : error || !state ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error ?? "Sesi tidak ditemukan"}
        </p>
      ) : (
        <div className="grid flex-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
          <section className="flex flex-col gap-4">
            {state.session.status === "ENDED" && champion ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-700 dark:bg-amber-950">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                  Pemenang
                </p>
                <p className="text-3xl font-black text-amber-800 dark:text-amber-200">
                  {champion.team.team_name}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {champion.correct}/{champion.total} benar · {champion.points}{" "}
                  poin
                </p>
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              {totalSlots === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  Nomor soal muncul setelah guru memulai sesi.
                </p>
              ) : (
                <QuestionBoard
                  mode="display"
                  totalSlots={totalSlots}
                  teams={state.teams}
                  answers={state.answers}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {state.teams.map((team) => (
                <span
                  key={team.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: team.color_code }}
                  />
                  {team.team_name}
                </span>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Peringkat Tim
              </h2>
              <Leaderboard
                teams={state.teams}
                answers={state.answers}
                totalSlots={totalSlots}
              />
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Log Aktivitas
              </h2>
              <ActivityLog logs={state.logs} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-500">Memuat...</p>
        </main>
      }
    >
      <DisplayInner />
    </Suspense>
  );
}
