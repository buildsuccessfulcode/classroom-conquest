"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AnswerFeedback from "@/components/AnswerFeedback";
import CountdownTimer from "@/components/CountdownTimer";
import Leaderboard from "@/components/Leaderboard";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import QuestionBoard from "@/components/QuestionBoard";
import QuestionCard from "@/components/QuestionCard";
import TeamProfile from "@/components/TeamProfile";
import BadgeShelf from "@/components/BadgeShelf";
import TimeWarningBanner from "@/components/TimeWarningBanner";
import { useGameState } from "@/hooks/useGameState";
import { useFocusGuard } from "@/hooks/useFocusGuard";
import { useTeamIdentity } from "@/hooks/useTeamIdentity";
import { joinTeam, requestQuestion, submitAnswer } from "@/lib/backend";
import {
  buildLeaderboard,
  countWrongAttemptsForTeam,
  MAX_ATTEMPTS_PER_SLOT,
} from "@/lib/game";
import {
  BADGES,
  earnedBadgeIds,
  levelFromXp,
  teamStats,
  type EarnedBadge,
} from "@/lib/gamification";
import type { SlotQuestion } from "@/lib/types";
import {
  ArrowRightIcon,
  BoltIcon,
  LockIcon,
  LogOutIcon,
  SparkleIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

interface Celebration {
  correct: boolean;
  gained: number;
  streak: number;
  badge: EarnedBadge | null;
  levelUp: boolean;
  level: number;
  message: string;
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 flex-col items-center justify-center gap-3">
          <Mascot mood="sleep" size={130} float />
          <p className="text-sm font-bold text-ink-soft">Menyiapkan arena...</p>
        </main>
      }
    >
      <PlayInner />
    </Suspense>
  );
}

function PlayInner() {
  const { identity, ready, save, clear } = useTeamIdentity();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slotParam = searchParams.get("slot");
  const restoredRef = useRef(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turn, setTurn] = useState<SlotQuestion | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [boardFilter, setBoardFilter] = useState<"all" | "todo" | "done">(
    "all",
  );

  const { state, loading, error: stateError, reload } = useGameState(
    identity?.sessionCode ?? null,
  );

  useFocusGuard({
    sessionCode: identity?.sessionCode ?? null,
    teamId: identity?.teamId ?? null,
    active: state?.session.status === "PLAYING",
  });

  const staleIdentity = Boolean(
    identity &&
      state &&
      state.session.status !== "ENDED" &&
      !state.teams.some((team) => team.id === identity.teamId),
  );

  useEffect(() => {
    if (!celebration) return;
    const id = window.setTimeout(() => setCelebration(null), 2600);
    return () => window.clearTimeout(id);
  }, [celebration]);

  const stats = useMemo(
    () => (state && identity ? teamStats(state, identity.teamId) : null),
    [state, identity],
  );

  const lockedSlots = useMemo(() => {
    if (!state || !identity) return [] as number[];
    const solved = new Set(
      state.answers
        .filter((answer) => answer.team_id === identity.teamId)
        .map((answer) => answer.slot_number),
    );
    const result: number[] = [];
    for (let slot = 1; slot <= state.slots.length; slot += 1) {
      if (solved.has(slot)) continue;
      const wrong = countWrongAttemptsForTeam(
        state.logs,
        slot,
        identity.teamId,
      );
      if (wrong >= MAX_ATTEMPTS_PER_SLOT) result.push(slot);
    }
    return result;
  }, [state, identity]);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await joinTeam({
        sessionCode: joinCode,
        teamName: joinName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      save(result.team, joinCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bergabung");
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = useCallback(
    async (slotNumber: number) => {
      if (!identity) return;
      if (state?.session.status !== "PLAYING") return;
      setBusy(true);
      setLoadingSlot(slotNumber);
      setError(null);
      try {
        const request = await requestQuestion({
          sessionCode: identity.sessionCode,
          teamId: identity.teamId,
          slotNumber,
        });
        setTurn(request);
        router.replace(`${pathname}?slot=${slotNumber}`, { scroll: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengambil soal");
      } finally {
        setBusy(false);
        setLoadingSlot(null);
      }
    },
    [identity, pathname, router, state?.session.status],
  );

  const closeTurn = useCallback(() => {
    setTurn(null);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const handleLeaveRoom = useCallback(() => {
    clear();
    restoredRef.current = false;
    setTurn(null);
    setJoinCode("");
    setJoinName("");
    setError(null);
    router.replace(pathname, { scroll: false });
  }, [clear, pathname, router]);

  useEffect(() => {
    if (restoredRef.current) return;
    if (!ready || !identity) return;
    if (!state || state.session.status !== "PLAYING") return;
    restoredRef.current = true;
    const slotNumber = Number(slotParam);
    if (
      !Number.isInteger(slotNumber) ||
      slotNumber < 1 ||
      slotNumber > state.slots.length
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      void handleSelect(slotNumber);
    }, 0);
    return () => window.clearTimeout(id);
  }, [handleSelect, identity, ready, slotParam, state]);

  const handleAnswer = async (answer: string) => {
    if (!turn || !identity || !stats) return;
    const before = stats;
    setBusy(true);
    setError(null);
    try {
      const result = await submitAnswer({
        sessionCode: identity.sessionCode,
        teamId: identity.teamId,
        slotNumber: turn.slotNumber,
        answer,
      });
      closeTurn();
      const predictedCorrect = before.correct + (result.correct ? 1 : 0);
      const predictedStreakCurrent = result.correct
        ? before.streak.current + 1
        : 0;
      const predictedStreakBest = Math.max(
        before.streak.best,
        predictedStreakCurrent,
      );
      const newXp = before.xp + result.gainedPoints;
      const after = earnedBadgeIds({
        correct: predictedCorrect,
        streakBest: predictedStreakBest,
        totalSlots: before.total,
        rank: before.rank,
      });
      const beforeEarned = new Set(
        before.badges.filter((badge) => badge.earned).map((badge) => badge.id),
      );
      const unlocked = result.correct
        ? BADGES.find((badge) => after[badge.id] && !beforeEarned.has(badge.id))
        : undefined;
      setCelebration({
        correct: result.correct,
        gained: result.gainedPoints,
        streak: predictedStreakCurrent,
        badge: unlocked ? { ...unlocked, earned: true } : null,
        levelUp: levelFromXp(newXp).level > before.level.level,
        level: levelFromXp(newXp).level,
        message: result.message,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <Mascot mood="sleep" size={130} float />
        <p className="text-sm font-bold text-ink-soft">Menyiapkan arena...</p>
      </main>
    );
  }

  if (!identity || staleIdentity) {
    const notice =
      error ??
      (staleIdentity
        ? `Tim Anda tidak lagi terdaftar di sesi ${identity?.sessionCode ?? ""}. Silakan gabung ulang.`
        : null);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
        <header className="flex items-center justify-between">
          <span className="cc-display text-lg font-extrabold text-brand-dark">
            Classroom Conquest
          </span>
          <ModeBadge />
        </header>

        <div className="flex flex-col items-center text-center">
          <Mascot mood="happy" size={150} float />
          <h1 className="cc-display mt-2 text-3xl font-extrabold text-ink">
            Gabung Arena
          </h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            Masukkan kode sesi dari gurumu, lalu tentukan nama tim.
          </p>
        </div>

        <form className="cc-card flex flex-col gap-4 p-5" onSubmit={handleJoin}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-ink">Kode Sesi</span>
            <input
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
              maxLength={6}
              required
              className="rounded-2xl border-2 border-cloud bg-snow p-3 text-center font-mono text-3xl font-extrabold tracking-[0.3em] text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
              placeholder="K3LH01"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-ink">Nama Tim</span>
            <input
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              required
              maxLength={50}
              className="rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
              placeholder="Tim Cyber"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="cc-btn border-brand-dark bg-brand p-3.5 text-base text-white"
          >
            {busy ? "Menghubungkan..." : "Gabung"}
            {!busy ? <ArrowRightIcon className="h-5 w-5" /> : null}
          </button>
          {notice ? (
            <p className="rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
              {notice}
            </p>
          ) : null}
        </form>
      </main>
    );
  }

  if (loading && !state) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <Mascot mood="sleep" size={130} float />
        <p className="text-sm font-bold text-ink-soft">Menyiapkan arena...</p>
      </main>
    );
  }

  if (stateError || !state || !stats) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-10">
        <div className="cc-card flex flex-col items-center gap-3 p-6 text-center">
          <Mascot mood="sad" size={130} />
          <p className="text-sm font-bold text-ink-soft">
            {stateError ?? "Sesi tidak ditemukan"}
          </p>
          <button
            type="button"
            onClick={clear}
            className="cc-btn border-ocean-dark bg-ocean px-5 py-3 text-white"
          >
            Kembali ke form gabung
          </button>
        </div>
      </main>
    );
  }

  const status = state.session.status;
  const totalSlots = state.slots.length;
  const board = buildLeaderboard(state.teams, state.answers, totalSlots);
  const champion = board[0];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5">
      <div className="sticky top-0 z-30 -mx-4 border-b-2 border-cloud bg-snow/95 px-4 py-3 backdrop-blur">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 rounded-full border-2 border-black/10"
              style={{ backgroundColor: identity.colorCode }}
            />
            <div className="leading-tight">
              <p className="cc-display text-lg font-extrabold text-ink">
                {identity.teamName}
              </p>
              <p className="font-mono text-[11px] font-bold text-ink-soft">
                {identity.sessionCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === "PLAYING" ? (
              <span className="hidden items-center gap-1 rounded-full bg-grape-soft px-3 py-1 text-xs font-extrabold text-grape-dark sm:flex">
                <BoltIcon className="h-3.5 w-3.5" />
                {stats.xp} XP
              </span>
            ) : null}
            <ModeBadge />
          </div>
        </header>
        <div className="mt-2 flex items-center justify-between gap-3">
          <CountdownTimer
            session={state.session}
            size="sm"
            onExpire={() => void reload()}
          />
          {status === "PLAYING" ? (
            <span className="text-xs font-extrabold text-ink-soft">
              Peringkat {stats.rank > 0 ? `#${stats.rank}` : "-"} ·{" "}
              {stats.correct}/{totalSlots} benar
            </span>
          ) : null}
        </div>
      </div>

      <TimeWarningBanner session={state.session} />

      {status === "ENDED" ? (
        <section className="cc-card flex flex-col items-center gap-3 overflow-hidden p-6 text-center">
          <div className="flex items-center gap-1">
            <SparkleIcon className="h-6 w-6 text-sun" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-sun-dark">
              Hasil Akhir
            </span>
            <SparkleIcon className="h-6 w-6 text-sun" />
          </div>
          <Mascot mood="cheer" size={150} crown float />
          {champion ? (
            <>
              <p className="text-sm font-bold text-ink-soft">Pemenang kelas</p>
              <p className="cc-display text-3xl font-extrabold text-ink">
                {champion.team.team_name}
              </p>
              <span className="flex items-center gap-1 rounded-full bg-grape-soft px-4 py-1.5 text-sm font-extrabold text-grape-dark">
                <BoltIcon className="h-4 w-4" />
                {champion.points} XP
              </span>
            </>
          ) : null}
          <div className="mt-1 w-full rounded-2xl bg-snow p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-soft">
              Posisi timmu
            </p>
            <p className="cc-display text-2xl font-extrabold text-ink">
              {stats.rank > 0 ? `Peringkat ${stats.rank}` : "-"} · {stats.xp} XP
            </p>
          </div>
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="cc-btn mt-1 border-ocean-dark bg-ocean px-5 py-3 text-white"
          >
            <LogOutIcon className="h-5 w-5" />
            Pindah Room
          </button>
        </section>
      ) : (
        <TeamProfile
          teamName={identity.teamName}
          colorCode={identity.colorCode}
          stats={stats}
          mood={status === "LOBBY" ? "sleep" : stats.streak.current >= 3 ? "cheer" : "happy"}
        />
      )}

      {status === "ENDED" ? (
        <section className="cc-card p-5">
          <BadgeShelf badges={stats.badges} title="Badge yang Dikumpulkan" />
        </section>
      ) : null}

      {status === "LOBBY" ? (
        <section className="cc-card flex flex-col items-center gap-4 p-6 text-center">
          <Mascot mood="sleep" size={120} float />
          <div>
            <p className="cc-display text-xl font-extrabold text-ink">
              Menunggu guru memulai
            </p>
            <p className="text-sm font-semibold text-ink-soft">
              Siapkan strategi timmu. Permainan segera dimulai.
            </p>
          </div>
          <div className="cc-scrollbar flex max-h-40 w-full flex-wrap justify-center gap-2 overflow-y-auto">
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
          <p className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <UsersIcon className="h-4 w-4" />
            {state.teams.length} tim di arena
          </p>
        </section>
      ) : null}

      {status === "PLAYING" ? (
        <>
          <section className="cc-card flex items-center gap-3 p-4">
            <Mascot mood="happy" size={62} />
            <p className="text-sm font-bold text-ink-soft">
              Pilih nomor mana saja. Jawaban salah tidak mengurangi XP, dan
              kamu punya {MAX_ATTEMPTS_PER_SLOT} percobaan per nomor.
            </p>
          </section>

          {totalSlots === 0 ? (
            <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
              Guru belum memuat nomor soal.
            </p>
          ) : (
            <section className="cc-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="cc-display text-lg font-extrabold text-ink">
                  Papan Soal
                </h2>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand-dark">
                  {stats.correct}/{totalSlots} benar
                </span>
              </div>
              <div className="mb-3 flex gap-2">
                {(
                  [
                    ["all", "Semua", totalSlots],
                    ["todo", "Belum", totalSlots - stats.correct],
                    ["done", "Selesai", stats.correct],
                  ] as const
                ).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBoardFilter(value)}
                    className={[
                      "flex-1 rounded-2xl border-2 px-3 py-2 text-xs font-extrabold transition",
                      boardFilter === value
                        ? "border-ocean bg-ocean-soft text-ocean-dark"
                        : "border-cloud bg-white text-ink-soft hover:border-ocean/60",
                    ].join(" ")}
                  >
                    {label} · {count}
                  </button>
                ))}
              </div>
              <QuestionBoard
                mode="play"
                totalSlots={totalSlots}
                teams={state.teams}
                answers={state.answers}
                myTeamId={identity.teamId}
                disabled={busy}
                loadingSlot={loadingSlot}
                lockedSlots={lockedSlots}
                filter={boardFilter}
                onSelect={(slotNumber) => void handleSelect(slotNumber)}
              />
            </section>
          )}

          <section className="cc-card p-5">
            <h2 className="cc-display mb-3 text-lg font-extrabold text-ink">
              Peringkat Kelas
            </h2>
            <Leaderboard
              teams={state.teams}
              answers={state.answers}
              totalSlots={totalSlots}
            />
          </section>
        </>
      ) : null}

      {turn && status === "PLAYING" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="cc-slide-up flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="cc-display flex h-11 w-11 items-center justify-center rounded-2xl bg-ocean text-xl font-extrabold text-white">
                  {turn.slotNumber}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-extrabold text-ink">
                    Soal nomor {turn.slotNumber}
                  </p>
                  <p className="text-xs font-bold text-ink-soft">
                    {turn.solved
                      ? "Sudah dijawab benar"
                      : turn.locked
                        ? "Terkunci"
                        : `Sisa ${turn.attemptsLeft} percobaan`}
                  </p>
                </div>
              </div>
              {turn.solved || turn.locked ? (
                <button
                  type="button"
                  onClick={closeTurn}
                  aria-label="Tutup"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-snow text-ink-soft transition hover:bg-cloud"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-sun-soft px-3 py-1.5 text-xs font-extrabold text-sun-dark">
                  <LockIcon className="h-3.5 w-3.5" />
                  Wajib dijawab
                </span>
              )}
            </div>

            {turn.solved || turn.locked ? null : (
              <p className="mb-3 rounded-2xl bg-sun-soft/60 px-3 py-2 text-xs font-bold text-sun-dark">
                Jawab soal ini dulu untuk menutupnya. Jawaban salah tidak
                mengurangi XP.
              </p>
            )}

            {error ? (
              <p className="mb-3 rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
                {error}
              </p>
            ) : null}
            {turn.solved ? (
              <p className="mb-3 rounded-2xl bg-brand-soft px-3 py-2 text-sm font-bold text-brand-dark">
                Soal ini sudah kamu jawab benar. Ini mode tinjau.
              </p>
            ) : null}
            {turn.locked ? (
              <p className="mb-3 rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
                Nomor ini terkunci setelah mencapai batas percobaan. Coba nomor
                lain, ya.
              </p>
            ) : null}

            <QuestionCard
              key={turn.question.id}
              question={turn.question}
              busy={busy}
              readOnly={turn.solved || turn.locked}
              attemptsLeft={turn.attemptsLeft}
              correctAnswer={turn.correctAnswer}
              onSubmit={(answer) => void handleAnswer(answer)}
            />
          </div>
        </div>
      ) : null}

      {celebration ? (
        <AnswerFeedback
          variant={celebration.correct ? "correct" : "wrong"}
          xp={celebration.gained}
          streak={celebration.streak}
          badge={celebration.badge}
          levelUp={celebration.levelUp}
          level={celebration.level}
          message={celebration.message}
        />
      ) : null}
    </main>
  );
}
