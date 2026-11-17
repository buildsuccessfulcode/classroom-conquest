import type {
  Answer,
  BoardConfig,
  BoardLink,
  BoardPreset,
  BoardStanding,
  Difficulty,
  LeaderboardEntry,
  Move,
  Team,
} from "./types";

export const SNAKES_STEP_RANGES: Record<
  Difficulty,
  { min: number; max: number }
> = {
  EASY: { min: 2, max: 4 },
  MEDIUM: { min: 5, max: 8 },
  HARD: { min: 9, max: 12 },
};
export const MIN_QUESTIONS_RATIO = 0.6;
export const MIN_BOARD_GOAL = 10;
export const BOARD_TILE_OPTIONS = [30, 50, 100] as const;

export const MAX_ATTEMPTS_PER_SLOT = 2;
export const RAPID_FIRE_INTERVAL_MS = 2000;
export const RATE_LIMIT_MAX_REQUESTS = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export function pointsFor(difficulty: Difficulty): number {
  if (difficulty === "HARD") return 200;
  if (difficulty === "MEDIUM") return 150;
  return 100;
}

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAnswerCorrect(
  question: { correct_answer: string },
  answer: string,
): boolean {
  return normalizeAnswer(question.correct_answer) === normalizeAnswer(answer);
}

export function buildLeaderboard(
  teams: Team[],
  answers: Answer[],
  totalSlots: number,
): LeaderboardEntry[] {
  const byTeam = new Map<string, Answer[]>();
  for (const answer of answers) {
    const list = byTeam.get(answer.team_id);
    if (list) list.push(answer);
    else byTeam.set(answer.team_id, [answer]);
  }
  return teams
    .map((team) => {
      const list = byTeam.get(team.id) ?? [];
      const points = list.reduce((sum, answer) => sum + answer.points, 0);
      const lastAnsweredAt = list.reduce<string | null>(
        (latest, answer) =>
          latest === null || answer.answered_at > latest
            ? answer.answered_at
            : latest,
        null,
      );
      return {
        team,
        points,
        correct: list.length,
        total: totalSlots,
        lastAnsweredAt,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (a.lastAnsweredAt && b.lastAnsweredAt) {
        if (a.lastAnsweredAt !== b.lastAnsweredAt) {
          return a.lastAnsweredAt < b.lastAnsweredAt ? -1 : 1;
        }
      } else if (a.lastAnsweredAt) {
        return -1;
      } else if (b.lastAnsweredAt) {
        return 1;
      }
      return a.team.team_name.localeCompare(b.team.team_name);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function remainingSeconds(
  session: {
    started_at: string | null;
    duration_minutes: number;
    status: string;
  },
  now: number,
): number | null {
  if (session.status === "ENDED") return 0;
  if (!session.started_at) return session.duration_minutes * 60;
  const endsAt =
    new Date(session.started_at).getTime() + session.duration_minutes * 60_000;
  return Math.max(0, Math.floor((endsAt - now) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function wrongAttemptSlot(message: string): number | null {
  const match = message.match(/menjawab salah nomor (\d+)/);
  return match ? Number(match[1]) : null;
}

export function countWrongAttempts(
  logs: { message: string }[],
  slotNumber: number,
): number {
  return logs.reduce(
    (count, log) =>
      wrongAttemptSlot(log.message) === slotNumber ? count + 1 : count,
    0,
  );
}

export function countWrongAttemptsForTeam(
  logs: { message: string; team_id?: string | null }[],
  slotNumber: number,
  teamId: string,
): number {
  return logs.reduce(
    (count, log) =>
      log.team_id === teamId && wrongAttemptSlot(log.message) === slotNumber
        ? count + 1
        : count,
    0,
  );
}

export function isRapidFire(
  lastAnsweredAt: string | null,
  now: number,
): boolean {
  if (!lastAnsweredAt) return false;
  return now - new Date(lastAnsweredAt).getTime() < RAPID_FIRE_INTERVAL_MS;
}

export function stepRangeFor(difficulty: Difficulty): {
  min: number;
  max: number;
} {
  return SNAKES_STEP_RANGES[difficulty] ?? SNAKES_STEP_RANGES.EASY;
}

export function stepsForDifficulty(
  difficulty: Difficulty,
  random: () => number = Math.random,
): number {
  const { min, max } = stepRangeFor(difficulty);
  return min + Math.floor(random() * (max - min + 1));
}

export function minQuestionsForBoard(): number {
  return Math.ceil(MIN_BOARD_GOAL * MIN_QUESTIONS_RATIO);
}

export function goalFromQuestionCount(questionCount: number): number {
  const raw = Math.floor(questionCount / MIN_QUESTIONS_RATIO);
  return Math.max(MIN_BOARD_GOAL, Math.min(100, raw));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function linkCounts(goal: number, preset: BoardPreset): {
  ladders: number;
  snakes: number;
} {
  const base = goal >= 90 ? 8 : goal >= 40 ? 6 : 4;
  const ladderAdjust = preset === "MUDAH" ? 2 : preset === "SULIT" ? -1 : 0;
  const snakeAdjust = preset === "MUDAH" ? -1 : preset === "SULIT" ? 2 : 0;
  return {
    ladders: Math.max(2, base + ladderAdjust),
    snakes: Math.max(2, base - 2 + snakeAdjust),
  };
}

export function buildBoardConfig(input: {
  goal: number;
  preset: BoardPreset;
  seed: number;
}): BoardConfig {
  const goal = Math.max(
    MIN_BOARD_GOAL,
    Math.min(100, Math.round(input.goal)),
  );
  const rng = mulberry32(input.seed);
  const used = new Set<number>();
  const target = linkCounts(goal, input.preset);
  const ladders: BoardLink[] = [];
  const snakes: BoardLink[] = [];

  const pickUnique = (min: number, max: number): number | null => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const value = min + Math.floor(rng() * (max - min + 1));
      if (!used.has(value)) {
        used.add(value);
        return value;
      }
    }
    return null;
  };

  for (let index = 0; index < target.ladders; index += 1) {
    const from = pickUnique(2, goal - 2);
    if (from === null) break;
    const span = 4 + Math.floor(rng() * 9);
    const to = Math.min(goal - 1, from + span);
    if (to <= from + 1) {
      used.delete(from);
      continue;
    }
    used.add(to);
    ladders.push({ from, to });
  }

  for (let index = 0; index < target.snakes; index += 1) {
    const from = pickUnique(3, goal - 1);
    if (from === null) break;
    const span = 4 + Math.floor(rng() * 9);
    const to = Math.max(1, from - span);
    if (to >= from - 1) {
      used.delete(from);
      continue;
    }
    used.add(to);
    snakes.push({ from, to });
  }

  ladders.sort((a, b) => a.from - b.from);
  snakes.sort((a, b) => a.from - b.from);
  return { goal, preset: input.preset, seed: input.seed, ladders, snakes };
}

export function resolveBoardMove(
  from: number,
  delta: number,
  config: BoardConfig,
): { raw: number; position: number; jump: number; finished: boolean } {
  const goal = Math.max(1, config.goal);
  const start = Math.min(goal, Math.max(0, from));
  const raw = Math.min(goal, Math.max(0, start + delta));
  if (delta <= 0) {
    return { raw, position: raw, jump: 0, finished: raw >= goal };
  }
  if (raw >= goal) {
    return { raw, position: goal, jump: 0, finished: true };
  }
  const ladder = config.ladders.find((link) => link.from === raw);
  if (ladder) {
    return {
      raw,
      position: ladder.to,
      jump: ladder.to - raw,
      finished: false,
    };
  }
  const snake = config.snakes.find((link) => link.from === raw);
  if (snake) {
    return {
      raw,
      position: snake.to,
      jump: snake.to - raw,
      finished: false,
    };
  }
  return { raw, position: raw, jump: 0, finished: false };
}

export const WALK_STEP_MS = 220;
export const WALK_SLIDE_MS = 700;
export const WALK_START_DELAY_MS = 300;

export interface WalkFrame {
  tile: number;
  durationMs: number;
  sliding: boolean;
}

export function buildWalkFrames(move: Move, config: BoardConfig): WalkFrame[] {
  if (!move.correct || move.delta <= 0) return [];
  const goal = Math.max(1, config.goal);
  const clamp = (value: number) => Math.min(goal, Math.max(0, value));
  const from = clamp(move.from_position);
  const raw = clamp(
    move.jump !== 0 ? move.to_position - move.jump : move.to_position,
  );
  const finalTile = clamp(move.to_position);
  const frames: WalkFrame[] = [
    { tile: from, durationMs: 0, sliding: false },
  ];
  for (let tile = Math.max(1, from + 1); tile <= raw; tile += 1) {
    frames.push({ tile, durationMs: WALK_STEP_MS, sliding: false });
  }
  if (finalTile !== raw) {
    frames.push({ tile: finalTile, durationMs: WALK_SLIDE_MS, sliding: true });
  }
  return frames;
}

export function teamAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function buildBoardStandings(
  teams: Team[],
  moves: Move[] = [],
): BoardStanding[] {
  const reachedAt = new Map<string, string>();
  for (const move of moves) {
    if (!move.correct) continue;
    const team = teams.find((item) => item.id === move.team_id);
    if (!team || move.to_position !== team.position) continue;
    const current = reachedAt.get(move.team_id);
    if (!current || move.created_at < current) {
      reachedAt.set(move.team_id, move.created_at);
    }
  }
  return [...teams]
    .sort((a, b) => {
      const aFinished = a.finished_at ? 0 : 1;
      const bFinished = b.finished_at ? 0 : 1;
      if (aFinished !== bFinished) return aFinished - bFinished;
      if (a.finished_at && b.finished_at && a.finished_at !== b.finished_at) {
        return a.finished_at < b.finished_at ? -1 : 1;
      }
      if (b.position !== a.position) return b.position - a.position;
      const aReached = reachedAt.get(a.id);
      const bReached = reachedAt.get(b.id);
      if (aReached && bReached && aReached !== bReached) {
        return aReached < bReached ? -1 : 1;
      }
      if (aReached) return -1;
      if (bReached) return 1;
      return a.team_name.localeCompare(b.team_name);
    })
    .map((team, index) => ({
      team,
      position: team.position,
      rank: index + 1,
      finishedAt: team.finished_at,
    }));
}
