import { buildLeaderboard } from "./game";
import type { Answer, GameState, Team } from "./types";

export const STREAK_WINDOW_MS = 3 * 60 * 1000;
export const XP_PER_LEVEL = 300;

const LEVEL_TITLES = [
  "Pemula",
  "Penjelajah",
  "Petualang",
  "Ahli",
  "Master",
  "Legenda",
];

export type BadgeTone =
  | "brand"
  | "ocean"
  | "grape"
  | "mango"
  | "cherry"
  | "sun";

export type BadgeId =
  | "first"
  | "collector"
  | "scholar"
  | "spark"
  | "blaze"
  | "halfway"
  | "perfect"
  | "podium";

export interface BadgeDef {
  id: BadgeId;
  label: string;
  description: string;
  tone: BadgeTone;
}

export interface EarnedBadge extends BadgeDef {
  earned: boolean;
}

export interface LevelInfo {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForLevel: number;
  progress: number;
  totalXp: number;
}

export interface StreakInfo {
  current: number;
  best: number;
}

export interface TeamStats {
  teamId: string;
  xp: number;
  level: LevelInfo;
  streak: StreakInfo;
  correct: number;
  total: number;
  rank: number;
  badges: EarnedBadge[];
  earnedCount: number;
}

export const BADGES: BadgeDef[] = [
  {
    id: "first",
    label: "Langkah Pertama",
    description: "Jawab benar satu soal",
    tone: "brand",
  },
  {
    id: "collector",
    label: "Kolektor",
    description: "Kumpulkan 5 jawaban benar",
    tone: "ocean",
  },
  {
    id: "scholar",
    label: "Cendekia",
    description: "Kumpulkan 10 jawaban benar",
    tone: "grape",
  },
  {
    id: "spark",
    label: "Api Kecil",
    description: "Capai streak 3 jawaban",
    tone: "mango",
  },
  {
    id: "blaze",
    label: "Membara",
    description: "Capai streak 5 jawaban",
    tone: "cherry",
  },
  {
    id: "halfway",
    label: "Setengah Jalan",
    description: "Benar separuh dari total soal",
    tone: "sun",
  },
  {
    id: "perfect",
    label: "Sempurna",
    description: "Benar semua nomor soal",
    tone: "brand",
  },
  {
    id: "podium",
    label: "Juara Kelas",
    description: "Masuk tiga besar peringkat",
    tone: "grape",
  },
];

export function levelFromXp(xp: number): LevelInfo {
  const safeXp = Math.max(0, xp);
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = safeXp % XP_PER_LEVEL;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xpIntoLevel,
    xpForLevel: XP_PER_LEVEL,
    progress: xpIntoLevel / XP_PER_LEVEL,
    totalXp: safeXp,
  };
}

export function xpForTeam(answers: Answer[], teamId: string): number {
  return answers.reduce(
    (sum, answer) => (answer.team_id === teamId ? sum + answer.points : sum),
    0,
  );
}

function streakFromTimes(times: number[], now?: number): StreakInfo {
  if (times.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let index = 1; index < times.length; index += 1) {
    if (times[index] - times[index - 1] <= STREAK_WINDOW_MS) run += 1;
    else run = 1;
    if (run > best) best = run;
  }

  const stale =
    typeof now === "number" && now - times[times.length - 1] > STREAK_WINDOW_MS;
  return { current: stale ? 0 : run, best };
}

export function streakForTeam(
  answers: Answer[],
  teamId: string,
  now?: number,
): StreakInfo {
  const times = answers
    .filter((answer) => answer.team_id === teamId)
    .map((answer) => new Date(answer.answered_at).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);
  return streakFromTimes(times, now);
}

export interface BadgeContext {
  correct: number;
  streakBest: number;
  totalSlots: number;
  rank: number;
}

export function earnedBadgeIds(ctx: BadgeContext): Record<BadgeId, boolean> {
  return {
    first: ctx.correct >= 1,
    collector: ctx.correct >= 5,
    scholar: ctx.correct >= 10,
    spark: ctx.streakBest >= 3,
    blaze: ctx.streakBest >= 5,
    halfway: ctx.totalSlots > 0 && ctx.correct >= Math.ceil(ctx.totalSlots / 2),
    perfect: ctx.totalSlots > 0 && ctx.correct >= ctx.totalSlots,
    podium: ctx.rank > 0 && ctx.rank <= 3 && ctx.correct > 0,
  };
}

function badgesFromCounts(
  correct: number,
  streakBest: number,
  totalSlots: number,
  rank: number,
): EarnedBadge[] {
  const earned = earnedBadgeIds({
    correct,
    streakBest,
    totalSlots,
    rank,
  });
  return BADGES.map((badge) => ({ ...badge, earned: earned[badge.id] }));
}

export function badgesForTeam(
  team: Team,
  answers: Answer[],
  totalSlots: number,
  rank: number,
): EarnedBadge[] {
  const correct = answers.filter((answer) => answer.team_id === team.id).length;
  const streakBest = streakForTeam(answers, team.id).best;
  return badgesFromCounts(correct, streakBest, totalSlots, rank);
}

export function teamStats(
  state: GameState,
  teamId: string,
  now?: number,
): TeamStats {
  const totalSlots = state.slots.length;
  const board = buildLeaderboard(state.teams, state.answers, totalSlots);
  const entry = board.find((item) => item.team.id === teamId);
  const xp = entry?.points ?? 0;
  const rank = entry?.rank ?? 0;
  const correct = entry?.correct ?? 0;
  const teamAnswers = state.answers.filter(
    (answer) => answer.team_id === teamId,
  );
  const times = teamAnswers
    .map((answer) => new Date(answer.answered_at).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);
  const streak = streakFromTimes(times, now);
  const badges = badgesFromCounts(correct, streak.best, totalSlots, rank);

  return {
    teamId,
    xp,
    level: levelFromXp(xp),
    streak,
    correct,
    total: totalSlots,
    rank,
    badges,
    earnedCount: badges.filter((badge) => badge.earned).length,
  };
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "Peringkat 1";
  if (rank === 2) return "Peringkat 2";
  if (rank === 3) return "Peringkat 3";
  if (rank <= 0) return "Belum ada";
  return `Peringkat ${rank}`;
}
