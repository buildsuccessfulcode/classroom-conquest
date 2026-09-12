"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ActivityLog from "@/components/ActivityLog";
import CountdownTimer from "@/components/CountdownTimer";
import Leaderboard from "@/components/Leaderboard";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import QuestionBoard from "@/components/QuestionBoard";
import TimeWarningBanner from "@/components/TimeWarningBanner";
import { ArrowLeftIcon, CrownIcon, UsersIcon } from "@/components/icons";
import { useGameState } from "@/hooks/useGameState";
import { buildLeaderboard } from "@/lib/game";

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
  const { state, loading, error, reload } = useGameState(activeCode);

  if (!activeCode) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-extrabold text-ocean-dark"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Beranda
          </Link>
          <ModeBadge />
        </header>
        <div className="flex flex-col items-center text-center">
          <Mascot mood="happy" size={140} float />
          <h1 className="cc-display mt-2 text-3xl font-extrabold text-ink">
            Papan Proyektor
          </h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            Masukkan kode sesi untuk menampilkan arena.
          </p>
        </div>
        <form
          className="cc-card flex flex-col gap-4 p-5"
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
            className="rounded-2xl border-2 border-cloud bg-snow p-3 text-center font-mono text-4xl font-extrabold tracking-[0.3em] text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
            placeholder="K3LH01"
          />
          <button
            type="submit"
            className="cc-btn border-brand-dark bg-brand p-3.5 text-white"
          >
            Tampilkan
          </button>
        </form>
      </main>
    );
  }

  const totalSlots = state?.slots.length ?? 0;
  const champion =
    state && totalSlots > 0
      ? buildLeaderboard(state.teams, state.answers, totalSlots)[0]
      : undefined;

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="cc-display font-mono text-4xl font-extrabold tracking-[0.15em] text-ocean-dark">
            {activeCode}
          </span>
          {state ? (
            <div className="text-sm">
              <p className="font-extrabold text-ink">
                {state.session.subject_name}
              </p>
              <p className="flex items-center gap-1.5 font-semibold text-ink-soft">
                <UsersIcon className="h-4 w-4" />
                {totalSlots} soal ·{" "}
                {STATUS_LABEL[state.session.status] ?? state.session.status}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {state ? (
            <CountdownTimer
              session={state.session}
              size="lg"
              onExpire={() => void reload()}
            />
          ) : null}
          <ModeBadge />
          <button
            type="button"
            onClick={() => setActiveCode(null)}
            className="text-sm font-extrabold text-ink-soft underline"
          >
            Ganti Kode
          </button>
        </div>
      </header>

      {state ? <TimeWarningBanner session={state.session} /> : null}

      {loading && !state ? (
        <p className="text-sm font-bold text-ink-soft">Memuat permainan...</p>
      ) : error || !state ? (
        <p className="rounded-2xl border-2 border-cherry-soft bg-cherry-soft/50 px-4 py-3 text-sm font-bold text-cherry-dark">
          {error ?? "Sesi tidak ditemukan"}
        </p>
      ) : (
        <div className="grid flex-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
          <section className="flex flex-col gap-4">
            {state.session.status === "ENDED" && champion ? (
              <div className="cc-card flex items-center justify-center gap-4 p-5">
                <Mascot mood="cheer" size={110} crown float />
                <div className="text-left">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-sun-dark">
                    <CrownIcon className="h-4 w-4" />
                    Pemenang
                  </p>
                  <p className="cc-display text-4xl font-extrabold text-ink">
                    {champion.team.team_name}
                  </p>
                  <p className="text-sm font-bold text-ink-soft">
                    {champion.correct}/{champion.total} benar · {champion.points}{" "}
                    XP
                  </p>
                </div>
              </div>
            ) : null}
            <div className="cc-card p-4">
              {totalSlots === 0 ? (
                <p className="py-10 text-center text-sm font-bold text-ink-soft">
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
            <div className="cc-scrollbar flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {state.teams.map((team) => (
                <span
                  key={team.id}
                  className="flex items-center gap-2 rounded-full border-2 border-cloud bg-white px-3 py-1.5 text-sm font-extrabold text-ink"
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
            <div className="cc-card p-4">
              <h2 className="cc-display mb-3 text-lg font-extrabold text-ink">
                Peringkat Tim
              </h2>
              <Leaderboard
                teams={state.teams}
                answers={state.answers}
                totalSlots={totalSlots}
              />
            </div>
            <div className="cc-card flex-1 p-4">
              <h2 className="cc-display mb-3 text-lg font-extrabold text-ink">
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
        <main className="flex flex-1 flex-col items-center justify-center gap-3">
          <Mascot mood="sleep" size={120} float />
          <p className="text-sm font-bold text-ink-soft">Memuat...</p>
        </main>
      }
    >
      <DisplayInner />
    </Suspense>
  );
}
