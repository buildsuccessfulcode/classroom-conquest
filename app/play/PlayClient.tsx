"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import AvatarPicker from "@/components/AvatarPicker";
import BoardStandings from "@/components/BoardStandings";
import CountdownTimer from "@/components/CountdownTimer";
import DiceRoll from "@/components/DiceRoll";
import Leaderboard from "@/components/Leaderboard";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import PressureBanner from "@/components/PressureBanner";
import QuestionBoard from "@/components/QuestionBoard";
import QuestionCard from "@/components/QuestionCard";
import Skeleton from "@/components/Skeleton";
import SnakesBoard from "@/components/SnakesBoard";
import SnakesQuestionGrid from "@/components/SnakesQuestionGrid";
import TeamProfile from "@/components/TeamProfile";
import BadgeShelf from "@/components/BadgeShelf";
import TimeWarningBanner from "@/components/TimeWarningBanner";

const AnswerFeedback = dynamic(() => import("@/components/AnswerFeedback"), {
  ssr: false,
});
import { useGameState } from "@/hooks/useGameState";
import { useFocusGuard } from "@/hooks/useFocusGuard";
import { useStoredValue, writeStoredValue } from "@/hooks/useLocalStorage";
import { useTeamIdentity } from "@/hooks/useTeamIdentity";
import {
  getSessionPreview,
  joinTeam,
  requestQuestion,
  submitAnswer,
  submitMove,
} from "@/lib/backend";
import {
  SOUND_STORAGE_KEY,
  haptic,
  playFeedback,
  unlockAudio,
} from "@/lib/feedback";
import {
  buildBoardStandings,
  buildLeaderboard,
  countWrongAttemptsForTeam,
  MAX_ATTEMPTS_PER_SLOT,
  moveAnimationStart,
  remainingSeconds,
  stepRangeFor,
} from "@/lib/game";
import { serverNow } from "@/lib/clock";
import { DEFAULT_AVATAR, type AvatarId } from "@/lib/avatars";
import {
  BADGES,
  earnedBadgeIds,
  levelFromXp,
  teamStats,
  type EarnedBadge,
} from "@/lib/gamification";
import type { Difficulty, GameMode, SlotQuestion } from "@/lib/types";
import {
  ArrowRightIcon,
  BoltIcon,
  LockIcon,
  LogOutIcon,
  SparkleIcon,
  UsersIcon,
  VolumeOffIcon,
  VolumeOnIcon,
  XIcon,
} from "@/components/icons";

const CELEBRATION_MS = 1200;
const CELEBRATION_LONG_MS = 1800;

interface Celebration {
  correct: boolean;
  gained: number;
  streak: number;
  badge: EarnedBadge | null;
  levelUp: boolean;
  level: number;
  message: string;
}

interface DiceRollState {
  value: number;
  difficulty: Difficulty;
  bounced: boolean;
  finished: boolean;
  position: number;
  closesAt: number;
}

export default function PlayClient() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
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
  const [joinAvatar, setJoinAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [joinMode, setJoinMode] = useState<GameMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turn, setTurn] = useState<SlotQuestion | null>(null);
  const [diceRoll, setDiceRoll] = useState<DiceRollState | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [boardFilter, setBoardFilter] = useState<"all" | "todo" | "done">(
    "all",
  );
  const soundPref = useStoredValue(SOUND_STORAGE_KEY);
  const soundOn = soundPref !== "off";
  const prevStatusRef = useRef<string | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const pendingCelebrationRef = useRef<Celebration | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

  const { state, loading, error: stateError, reload } = useGameState(
    identity?.sessionCode ?? null,
  );

  useFocusGuard({
    sessionCode: identity?.sessionCode ?? null,
    teamId: identity?.teamId ?? null,
    active: state?.session.status === "PLAYING",
  });

  useEffect(() => {
    if (identity) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    let active = true;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const preview = await getSessionPreview(code);
          if (active) setJoinMode(preview?.mode ?? null);
        } catch {
          if (active) setJoinMode(null);
        }
      })();
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [identity, joinCode]);

  const staleIdentity = Boolean(
    identity &&
      state &&
      state.session.status !== "ENDED" &&
      !state.teams.some((team) => team.id === identity.teamId),
  );

  useEffect(() => {
    if (!celebration) return;
    const duration =
      celebration.badge || celebration.levelUp
        ? CELEBRATION_LONG_MS
        : CELEBRATION_MS;
    const id = window.setTimeout(() => setCelebration(null), duration);
    return () => window.clearTimeout(id);
  }, [celebration]);

  const status = state?.session.status ?? null;
  useEffect(() => {
    if (!status) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (!identity || prev === null || prev === status) return;
    if (prev !== "PLAYING" && status === "PLAYING") playFeedback("start");
    else if (prev === "PLAYING" && status === "ENDED") playFeedback("end");
  }, [identity, status]);

  const toggleSound = () => {
    const next = !soundOn;
    writeStoredValue(SOUND_STORAGE_KEY, next ? null : "off");
    if (next) {
      unlockAudio();
      playFeedback("sent");
    }
  };

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

  const isSnakes = state?.session.game_mode === "SNAKES";
  const boardConfig = state?.session.board_config ?? null;
  const myTeam = state?.teams.find((team) => team.id === identity?.teamId);
  const usedSlots = useMemo(() => {
    if (!state || !identity) return new Set<number>();
    return new Set(
      state.moves
        .filter((move) => move.team_id === identity.teamId)
        .map((move) => move.slot_number),
    );
  }, [state, identity]);
  const standings = useMemo(
    () => (state ? buildBoardStandings(state.teams, state.moves) : []),
    [state],
  );
  const myStanding = standings.find(
    (entry) => entry.team.id === identity?.teamId,
  );
  const remainingTiles = boardConfig
    ? Math.max(0, boardConfig.goal - (myTeam?.position ?? 0))
    : 0;
  const exactFinish = boardConfig?.finishRule === "EXACT";

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const result = await joinTeam({
        sessionCode: joinCode,
        teamName: joinName,
        avatar: joinMode === "SNAKES" ? joinAvatar : null,
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
      const session = state?.session;
      if (!identity || !session) return;
      if (session.status !== "PLAYING") return;
      if ((remainingSeconds(session, serverNow()) ?? 0) <= 0) {
        setError("Waktu sesi sudah habis. Sesi berakhir.");
        void reload();
        return;
      }
      unlockAudio();
      setBusy(true);
      setLoadingSlot(slotNumber);
      setError(null);
      try {
        const request = await requestQuestion({
          sessionCode: identity.sessionCode,
          teamId: identity.teamId,
          slotNumber,
        });
        if (request.used) {
          setError("Soal ini sudah dipakai tim Anda.");
          return;
        }
        setTurn(request);
        router.replace(`${pathname}?slot=${slotNumber}`, { scroll: false });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal mengambil soal";
        setError(message);
        if (/habis|berakhir/i.test(message)) void reload();
      } finally {
        setBusy(false);
        setLoadingSlot(null);
      }
    },
    [identity, pathname, reload, router, state],
  );

  const closeTurn = useCallback(() => {
    setTurn(null);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const focusBoard = useCallback(() => {
    const node = boardRef.current;
    if (!node) return;
    const reduced =
      document.documentElement.dataset.lite === "true" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  }, []);

  const flushPendingCelebration = useCallback(() => {
    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
    const pending = pendingCelebrationRef.current;
    if (!pending) return;
    pendingCelebrationRef.current = null;
    setCelebration(pending);
  }, []);

  const queueCelebration = useCallback(
    (value: Celebration) => {
      pendingCelebrationRef.current = value;
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
      celebrationTimerRef.current = window.setTimeout(() => {
        celebrationTimerRef.current = null;
        flushPendingCelebration();
      }, 6000);
    },
    [flushPendingCelebration],
  );

  const handleWalkEnd = useCallback(
    (teamId: string) => {
      if (teamId !== identity?.teamId) return;
      flushPendingCelebration();
    },
    [flushPendingCelebration, identity?.teamId],
  );

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const handleLeaveRoom = useCallback(() => {
    clear();
    restoredRef.current = false;
    setTurn(null);
    setJoinCode("");
    setJoinName("");
    setJoinAvatar(DEFAULT_AVATAR);
    setJoinMode(null);
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
    if (!turn || !identity) return;
    if (state && (remainingSeconds(state.session, serverNow()) ?? 0) <= 0) {
      closeTurn();
      setError("Waktu sesi sudah habis. Sesi berakhir.");
      void reload();
      return;
    }
    const snakesMode = state?.session.game_mode === "SNAKES";
    const slotNumber = turn.slotNumber;
    const difficulty = turn.question.difficulty;
    unlockAudio();
    closeTurn();
    playFeedback("sent");
    haptic(10);
    setBusy(true);
    setError(null);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (snakesMode) {
          const result = await submitMove({
            sessionCode: identity.sessionCode,
            teamId: identity.teamId,
            slotNumber,
            answer,
          });
          const feedback: Celebration = {
            correct: result.correct,
            gained: result.delta ?? 0,
            streak: result.streak ?? 0,
            badge: null,
            levelUp: false,
            level: 1,
            message: result.message,
          };
          if (result.correct) {
            const walkAt = moveAnimationStart(result.createdAt, serverNow());
            const closesAt = Math.max(serverNow() + 650, walkAt - 250);
            setDiceRoll({
              value: result.delta ?? 0,
              difficulty,
              bounced: result.bounced ?? false,
              finished: result.finished ?? false,
              position: result.position ?? 0,
              closesAt,
            });
            haptic([10, 30, 10]);
            const reloadPromise = reload();
            const wait = Math.max(0, closesAt - serverNow());
            await new Promise((resolve) => window.setTimeout(resolve, wait));
            setDiceRoll(null);
            playFeedback("correct");
            haptic([14, 40, 14]);
            queueCelebration(feedback);
            window.requestAnimationFrame(focusBoard);
            await reloadPromise;
          } else {
            playFeedback("wrong");
            haptic(18);
            setCelebration(feedback);
            await reload();
          }
          setBusy(false);
          return;
        }
        if (!stats) return;
        const before = stats;
        const result = await submitAnswer({
          sessionCode: identity.sessionCode,
          teamId: identity.teamId,
          slotNumber,
          answer,
        });
        playFeedback(result.correct ? "correct" : "wrong");
        haptic(result.correct ? [14, 40, 14] : 18);
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
          before.badges
            .filter((badge) => badge.earned)
            .map((badge) => badge.id),
        );
        const unlocked = result.correct
          ? BADGES.find(
              (badge) => after[badge.id] && !beforeEarned.has(badge.id),
            )
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
        setBusy(false);
        return;
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : "";
        if (/sudah|terkunci|habis|berakhir|belum dimulai|tidak ditemukan|tidak terdaftar/i.test(message)) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    setError(lastError instanceof Error ? lastError.message : "Gagal mengirim jawaban");
    await reload();
    setBusy(false);
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
          <span className="flex items-center gap-2">
            <Image
              src="/logo-square.png"
              alt=""
              width={36}
              height={36}
              priority
              className="h-9 w-9"
            />
            <span className="cc-display text-lg font-extrabold text-brand-dark">
              Classroom Conquest
            </span>
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
              onChange={(event) => {
                setJoinCode(event.target.value.toUpperCase());
                setJoinMode(null);
              }}
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
          {joinMode === "SNAKES" ? (
            <AvatarPicker
              value={joinAvatar}
              onChange={setJoinAvatar}
              disabled={busy}
            />
          ) : null}
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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
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

  const totalSlots = state.slots.length;
  const board = buildLeaderboard(state.teams, state.answers, totalSlots);
  const champion = board[0];
  const championTeam = isSnakes ? standings[0]?.team : champion?.team;
  const turnRange = turn ? stepRangeFor(turn.question.difficulty) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5">
      <div className="sticky top-0 z-30 -mx-4 border-b-2 border-cloud bg-snow/95 px-4 py-3 backdrop-blur">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border-2 border-black/10"
              style={{ backgroundColor: identity.colorCode }}
            />
            <div className="min-w-0 leading-tight">
              <p className="cc-display truncate text-lg font-extrabold text-ink">
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
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundOn ? "Matikan suara" : "Nyalakan suara"}
              title={soundOn ? "Matikan suara" : "Nyalakan suara"}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-cloud bg-white text-ink-soft transition hover:border-ocean/60"
            >
              {soundOn ? (
                <VolumeOnIcon className="h-4 w-4" />
              ) : (
                <VolumeOffIcon className="h-4 w-4" />
              )}
            </button>
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
              {isSnakes ? (
                <>
                  Petak {myTeam?.position ?? 0}
                  {boardConfig ? `/${boardConfig.goal}` : ""} · Peringkat{" "}
                  {myStanding ? `#${myStanding.rank}` : "-"}
                </>
              ) : (
                <>
                  Peringkat {stats.rank > 0 ? `#${stats.rank}` : "-"} ·{" "}
                  {stats.correct}/{totalSlots} benar
                </>
              )}
            </span>
          ) : null}
        </div>
      </div>

      <TimeWarningBanner session={state.session} />
      {isSnakes && boardConfig ? (
        <PressureBanner
          teams={state.teams}
          moves={state.moves}
          config={boardConfig}
          status={state.session.status}
        />
      ) : null}

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
          {championTeam ? (
            <>
              <p className="text-sm font-bold text-ink-soft">Pemenang kelas</p>
              <p className="cc-display text-3xl font-extrabold text-ink">
                {championTeam.team_name}
              </p>
              <span className="flex items-center gap-1 rounded-full bg-grape-soft px-4 py-1.5 text-sm font-extrabold text-grape-dark">
                <BoltIcon className="h-4 w-4" />
                {isSnakes
                  ? `${standings[0]?.position ?? championTeam.position}/${
                      boardConfig?.goal ?? "-"
                    } petak`
                  : `${champion?.points ?? 0} XP`}
              </span>
              {isSnakes && standings[0] && !standings[0].finishedAt ? (
                <p className="text-xs font-bold text-ink-soft">
                  Tidak ada tim yang finis. Juara ditentukan dari petak terjauh.
                </p>
              ) : null}
            </>
          ) : null}
          <div className="mt-1 w-full rounded-2xl bg-snow p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-soft">
              Posisi timmu
            </p>
            <p className="cc-display text-2xl font-extrabold text-ink">
              {isSnakes
                ? `${myStanding ? `Peringkat ${myStanding.rank}` : "-"} · Petak ${
                    myTeam?.position ?? 0
                  }/${boardConfig?.goal ?? "-"}`
                : `${stats.rank > 0 ? `Peringkat ${stats.rank}` : "-"} · ${
                    stats.xp
                  } XP`}
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
      ) : isSnakes ? (
        <section className="cc-card p-5">
          <div className="flex items-center gap-4">
            <Avatar
              id={myTeam?.avatar}
              size={72}
              ringColor={identity.colorCode}
              title={identity.teamName}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border-2 border-black/10"
                  style={{ backgroundColor: identity.colorCode }}
                />
                <h2 className="cc-display truncate text-2xl font-extrabold text-ink">
                  {identity.teamName}
                </h2>
              </div>
              <p className="mt-1 text-sm font-bold text-ink-soft">
                Posisi {myTeam?.position ?? 0}/{boardConfig?.goal ?? "-"} ·
                Peringkat {myStanding ? `#${myStanding.rank}` : "-"}
                {exactFinish ? ` · Sisa ${remainingTiles} petak (wajib pas)` : ""}
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-cloud">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{
                    width: `${
                      boardConfig
                        ? Math.min(
                            100,
                            Math.round(
                              ((myTeam?.position ?? 0) / boardConfig.goal) * 100,
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <TeamProfile
          teamName={identity.teamName}
          colorCode={identity.colorCode}
          stats={stats}
          mood={status === "LOBBY" ? "sleep" : stats.streak.current >= 3 ? "cheer" : "happy"}
        />
      )}

      {status === "ENDED" && !isSnakes ? (
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
                className="flex max-w-full min-w-0 items-center gap-2 rounded-full border-2 border-cloud bg-white px-3 py-1.5 text-sm font-extrabold text-ink"
              >
                {team.avatar ? (
                  <Avatar id={team.avatar} size={22} />
                ) : (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color_code }}
                  />
                )}
                <span className="truncate">{team.team_name}</span>
              </span>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <UsersIcon className="h-4 w-4" />
            {state.teams.length} tim di arena
          </p>
        </section>
      ) : null}

      {isSnakes && boardConfig && status !== "LOBBY" ? (
        <section ref={boardRef} className="cc-card scroll-mt-24 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="cc-display text-lg font-extrabold text-ink">
              Papan Ular Tangga
            </h2>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand-dark">
              Petak {myTeam?.position ?? 0}/{boardConfig.goal}
            </span>
          </div>
          <SnakesBoard
            config={boardConfig}
            teams={state.teams}
            moves={state.moves}
            variant="mini"
            highlightTeamId={identity.teamId}
            onWalkEnd={handleWalkEnd}
          />
        </section>
      ) : null}

      {status === "PLAYING" ? (
        isSnakes && boardConfig ? (
          <>
            <section className="cc-card flex items-center gap-3 p-4">
              <Mascot mood="happy" size={62} />
              <p className="text-sm font-bold text-ink-soft">
                Pilih soal untuk memajukan bidak. Jarak langkah mengikuti
                kesulitan soal: Mudah 2–4, Sedang 5–8, Sulit 9–12 petak.
                Jawaban salah membuat bidak tetap dan soal hangus.
              </p>
            </section>

            <section className="cc-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="cc-display text-lg font-extrabold text-ink">
                  Pilih Soal
                </h2>
                <span className="rounded-full bg-sun-soft px-3 py-1 text-xs font-extrabold text-sun-dark">
                  {usedSlots.size}/{state.slotInfo.length} dipakai
                </span>
              </div>
              {exactFinish ? (
                <p className="mb-3 rounded-2xl bg-grape-soft px-3 py-2 text-xs font-bold text-grape-dark">
                  Finis sempurna: sisa {remainingTiles} petak. Pilih soal yang
                  rentang langkahnya bisa mendarat pas; kelebihan langkah akan
                  mantul mundur.
                </p>
              ) : null}
              <SnakesQuestionGrid
                slotInfo={state.slotInfo}
                usedSlots={usedSlots}
                disabled={busy}
                loadingSlot={loadingSlot}
                exactTarget={exactFinish ? remainingTiles : null}
                onSelect={(slotNumber) => void handleSelect(slotNumber)}
              />
            </section>

            <section className="cc-card p-5">
              <h2 className="cc-display mb-3 text-lg font-extrabold text-ink">
                Posisi Tim
              </h2>
              <BoardStandings
                teams={state.teams}
                config={boardConfig}
                moves={state.moves}
                highlightTeamId={identity.teamId}
              />
            </section>
          </>
        ) : (
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
                Sesi ini belum memiliki nomor soal.
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
        )
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
                      : turn.used
                        ? "Soal sudah dipakai"
                        : turn.locked
                          ? "Terkunci"
                            : isSnakes && turnRange
                              ? `Maju ${turnRange.min}-${turnRange.max} petak bila benar`
                              : `Sisa ${turn.attemptsLeft} percobaan`}
                  </p>
                </div>
              </div>
              {turn.solved || turn.locked || turn.used ? (
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

            {turn.solved || turn.locked || turn.used ? null : (
              <p className="mb-3 rounded-2xl bg-sun-soft/60 px-3 py-2 text-xs font-bold text-sun-dark">
                {isSnakes
                  ? "Jawaban benar memajukan bidak sesuai tingkat kesulitan soal. Jawaban salah membuat bidak tetap dan soal hangus."
                  : "Jawab soal ini dulu untuk menutupnya. Jawaban salah tidak mengurangi XP."}
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
                Nomor ini terkunci setelah mencapai batas percobaan. Jawaban
                benar ditampilkan untuk belajar.
              </p>
            ) : null}

            <QuestionCard
              key={turn.question.id}
              question={turn.question}
              busy={busy}
              readOnly={turn.solved || turn.locked || turn.used}
              attemptsLeft={isSnakes ? undefined : turn.attemptsLeft}
              correctAnswer={turn.correctAnswer}
              rewardLabel={
                isSnakes && turnRange
                  ? `${turnRange.min}-${turnRange.max} petak`
                  : undefined
              }
              onSubmit={(answer) => void handleAnswer(answer)}
            />
          </div>
        </div>
      ) : null}

      {diceRoll ? (
        <DiceRoll
          value={diceRoll.value}
          difficulty={diceRoll.difficulty}
          bounced={diceRoll.bounced}
          finished={diceRoll.finished}
          position={diceRoll.position}
          closesAt={diceRoll.closesAt}
        />
      ) : null}

      {celebration ? (
        <AnswerFeedback
          variant={celebration.correct ? "correct" : "wrong"}
          xp={celebration.gained}
          unit={isSnakes ? "petak" : "XP"}
          detail={isSnakes ? celebration.message : undefined}
          streak={celebration.streak}
          badge={celebration.badge}
          levelUp={celebration.levelUp}
          level={celebration.level}
          message={celebration.message}
          onDismiss={() => setCelebration(null)}
        />
      ) : null}
    </main>
  );
}
