"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ModeBadge from "@/components/ModeBadge";
import QuestionBoard from "@/components/QuestionBoard";
import QuestionCard from "@/components/QuestionCard";
import { useGameState } from "@/hooks/useGameState";
import { useTeamIdentity } from "@/hooks/useTeamIdentity";
import { joinTeam, requestQuestion, submitAnswer } from "@/lib/backend";
import { buildLeaderboard } from "@/lib/game";
import type { SlotQuestion } from "@/lib/types";

interface Feedback {
  correct: boolean;
  message: string;
}

export default function PlayPage() {
  const { identity, ready, save, clear } = useTeamIdentity();
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turn, setTurn] = useState<SlotQuestion | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const { state, loading, error: stateError, reload } = useGameState(
    identity?.sessionCode ?? null,
  );

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { team } = await joinTeam({
        sessionCode: joinCode,
        teamName: joinName,
      });
      save(team, joinCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bergabung");
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = useCallback(
    async (slotNumber: number) => {
      if (!identity) return;
      if (state?.session.status !== "PLAYING") {
        setFeedback({ correct: false, message: "Sesi belum dimulai oleh guru." });
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const request = await requestQuestion({
          sessionCode: identity.sessionCode,
          teamId: identity.teamId,
          slotNumber,
        });
        setTurn(request);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengambil soal");
      } finally {
        setBusy(false);
      }
    },
    [identity, state?.session.status],
  );

  const handleAnswer = async (answer: string) => {
    if (!turn || !identity) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitAnswer({
        sessionCode: identity.sessionCode,
        teamId: identity.teamId,
        slotNumber: turn.slotNumber,
        answer,
      });
      setFeedback({ correct: result.correct, message: result.message });
      setTurn(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">Memuat...</p>
      </main>
    );
  }

  if (!identity) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
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
          <h1 className="mb-1 text-2xl font-black">Gabung Permainan</h1>
          <p className="mb-5 text-sm text-slate-500">
            Masukkan kode sesi dari guru dan nama kelompok Anda.
          </p>
          <form className="flex flex-col gap-4" onSubmit={handleJoin}>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Kode Sesi
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                maxLength={6}
                required
                className="rounded-lg border border-slate-300 bg-white p-3 text-center font-mono text-2xl font-black tracking-widest text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="K3LH01"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Nama Tim
              <input
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                required
                maxLength={50}
                className="rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Tim Cyber"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 p-3 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Menghubungkan..." : "Gabung"}
            </button>
          </form>
          {error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      </main>
    );
  }

  const totalSlots = state?.slots.length ?? 0;
  const myCorrect =
    state?.answers.filter((answer) => answer.team_id === identity.teamId)
      .length ?? 0;
  const board = state
    ? buildLeaderboard(state.teams, state.answers, totalSlots)
    : [];
  const myEntry = board.find((entry) => entry.team.id === identity.teamId);
  const myRank = myEntry?.rank ?? "-";
  const myPoints = myEntry?.points ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full"
            style={{ backgroundColor: identity.colorCode }}
          />
          <div>
            <p className="text-lg font-black leading-tight">
              {identity.teamName}
            </p>
            <p className="font-mono text-xs text-slate-500">
              Sesi {identity.sessionCode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ModeBadge />
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-slate-500 underline"
          >
            Ganti Tim
          </button>
        </div>
      </header>

      {feedback ? (
        <p
          className={[
            "rounded-lg border px-4 py-2 text-sm font-semibold",
            feedback.correct
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
          ].join(" ")}
        >
          {feedback.message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Poin</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {myPoints}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Benar</p>
          <p className="text-2xl font-black">
            {myCorrect}/{totalSlots}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Peringkat</p>
          <p className="text-2xl font-black">{myRank}</p>
        </div>
      </section>

      {loading && !state ? (
        <p className="text-sm text-slate-500">Memuat papan soal...</p>
      ) : stateError || !state ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p>{stateError ?? "Sesi tidak ditemukan"}</p>
          <button
            type="button"
            onClick={clear}
            className="mt-2 font-semibold underline"
          >
            Kembali ke form gabung
          </button>
        </div>
      ) : (
        <>
          {state.session.status !== "PLAYING" ? (
            <p className="rounded-lg bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {state.session.status === "LOBBY"
                ? "Menunggu guru memulai sesi..."
                : "Sesi telah berakhir."}
            </p>
          ) : totalSlots === 0 ? (
            <p className="rounded-lg bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Guru belum memuat nomor soal.
            </p>
          ) : (
            <p className="text-center text-sm text-slate-500">
              Pilih nomor soal. Jawaban salah tidak mengurangi poin dan bisa
              dicoba lagi.
            </p>
          )}
          {totalSlots > 0 ? (
            <QuestionBoard
              mode="play"
              totalSlots={totalSlots}
              teams={state.teams}
              answers={state.answers}
              myTeamId={identity.teamId}
              disabled={busy || state.session.status !== "PLAYING"}
              onSelect={(slotNumber) => void handleSelect(slotNumber)}
            />
          ) : null}
        </>
      )}

      {turn ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Nomor {turn.slotNumber}
                {turn.solved ? " · Sudah benar" : ""}
              </span>
              <button
                type="button"
                onClick={() => setTurn(null)}
                className="text-sm font-semibold text-slate-400"
              >
                {turn.solved ? "Tutup" : "Batal"}
              </button>
            </div>
            {turn.solved ? (
              <p className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                Soal ini sudah Anda jawab benar. Mode review (read-only).
              </p>
            ) : null}
            {turn.locked ? (
              <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                Nomor ini terkunci untuk tim Anda setelah mencapai batas
                percobaan.
              </p>
            ) : null}
            <QuestionCard
              key={turn.question.id}
              question={turn.question}
              busy={busy}
              readOnly={turn.solved || turn.locked}
              attemptsLeft={turn.attemptsLeft}
              onSubmit={(answer) => void handleAnswer(answer)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
