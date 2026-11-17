import type {
  Answer,
  BoardConfig,
  BoardLink,
  BoardPreset,
  BoardStanding,
  Difficulty,
  FinishRule,
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
export const MIN_QUESTIONS_RATIO = 0.5;
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

export function teamStreak(moves: Move[], teamId: string): number {
  const teamMoves = moves
    .filter((move) => move.team_id === teamId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  let streak = 0;
  for (let index = teamMoves.length - 1; index >= 0; index -= 1) {
    if (!teamMoves[index].correct) break;
    streak += 1;
  }
  return streak;
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

interface LinkTargets {
  ladders: number;
  snakes: number;
}

export function boardLinkTargets(
  goal: number,
  preset: BoardPreset,
): LinkTargets {
  const safeGoal = Math.max(MIN_BOARD_GOAL, Math.min(100, Math.round(goal)));
  const pairs = Math.max(2, Math.round(safeGoal / 12));
  let ladders = pairs + 1;
  let snakes = pairs;
  if (preset === "MUDAH") {
    ladders = pairs + 2;
    snakes = Math.max(1, pairs - 1);
  } else if (preset === "SULIT") {
    ladders = pairs;
    snakes = pairs + 1;
  }
  const maxTotal = Math.max(2, Math.floor(safeGoal * 0.25));
  while (ladders + snakes > maxTotal) {
    if (snakes > 1 && snakes >= ladders) snakes -= 1;
    else if (ladders > 1) ladders -= 1;
    else if (snakes > 0) snakes -= 1;
    else break;
  }
  return { ladders, snakes };
}

function boardSpanRange(
  goal: number,
  preset: BoardPreset,
  kind: "ladder" | "snake",
): { min: number; max: number } {
  const safeGoal = Math.max(MIN_BOARD_GOAL, Math.min(100, Math.round(goal)));
  const minBase =
    safeGoal <= 15 ? 2 : Math.max(3, Math.round(safeGoal * 0.08));
  const maxBase = Math.max(minBase + 1, Math.round(safeGoal * 0.16));
  const factor =
    kind === "ladder"
      ? preset === "SULIT"
        ? 1.25
        : 1
      : preset === "MUDAH"
        ? 0.8
        : preset === "SULIT"
          ? 0.75
          : 1;
  const min = Math.max(2, Math.round(minBase * factor));
  const max = Math.max(min + 1, Math.round(maxBase * factor));
  return { min, max };
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

function buildBoardOnce(input: {
  goal: number;
  preset: BoardPreset;
  seed: number;
  finishRule: FinishRule;
  allowToOverlap: boolean;
}): BoardConfig {
  const { goal, preset, seed, finishRule, allowToOverlap } = input;
  const rng = mulberry32(seed);
  const target = boardLinkTargets(goal, preset);
  const ladders: BoardLink[] = [];
  const snakes: BoardLink[] = [];
  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();

  const canUseTo = (value: number): boolean =>
    !usedFrom.has(value) && (allowToOverlap || !usedTo.has(value));

  const candidates = (min: number, max: number): number[] => {
    const list: number[] = [];
    for (let value = Math.max(2, min); value <= max; value += 1) {
      list.push(value);
    }
    return shuffleInPlace(list, rng);
  };

  const addLink = (
    list: BoardLink[],
    kind: "ladder" | "snake",
    from: number,
  ): boolean => {
    const maxFrom = kind === "snake" && preset === "SULIT" ? goal - 1 : goal - 2;
    if (from < 2 || from > maxFrom) return false;
    if (usedFrom.has(from) || usedTo.has(from)) return false;
    const { min, max } = boardSpanRange(goal, preset, kind);
    const spans: number[] = [];
    for (let span = min; span <= max; span += 1) spans.push(span);
    shuffleInPlace(spans, rng);
    for (const span of spans) {
      const to =
        kind === "ladder"
          ? Math.min(goal - 1, from + span)
          : Math.max(2, from - span);
      if (kind === "ladder" && to < from + 2) continue;
      if (kind === "snake" && to > from - 2) continue;
      if (!canUseTo(to)) continue;
      usedFrom.add(from);
      usedTo.add(to);
      list.push({ from, to });
      return true;
    }
    return false;
  };

  const ladderMaxFrom = Math.min(
    goal - 2,
    Math.max(2, Math.floor(goal * 0.8)),
  );
  const snakeMinFrom = Math.min(
    goal - 2,
    Math.max(2, Math.ceil(goal * 0.25)),
  );
  const snakeMaxFrom = Math.max(
    snakeMinFrom,
    preset === "SULIT" ? goal - 1 : goal - 2,
  );

  if (target.ladders > 0) {
    const comeback = candidates(
      Math.ceil(goal * 0.6),
      Math.min(ladderMaxFrom, Math.max(2, Math.floor(goal * 0.8))),
    );
    for (const from of comeback) {
      if (addLink(ladders, "ladder", from)) break;
    }
  }
  for (const from of candidates(2, ladderMaxFrom)) {
    if (ladders.length >= target.ladders) break;
    addLink(ladders, "ladder", from);
  }

  if (target.snakes > 0) {
    const middle = candidates(
      Math.ceil(goal * 0.4),
      Math.min(snakeMaxFrom, Math.max(2, Math.floor(goal * 0.7))),
    );
    for (const from of middle) {
      if (addLink(snakes, "snake", from)) break;
    }
  }
  for (const from of candidates(snakeMinFrom, snakeMaxFrom)) {
    if (snakes.length >= target.snakes) break;
    addLink(snakes, "snake", from);
  }

  ladders.sort((a, b) => a.from - b.from);
  snakes.sort((a, b) => a.from - b.from);
  return { goal, preset, seed, finishRule, ladders, snakes };
}

function linkSpan(link: BoardLink): number {
  return Math.abs(link.to - link.from);
}

function netSpanGap(config: BoardConfig): number {
  const ladderSpan = config.ladders.reduce(
    (total, link) => total + linkSpan(link),
    0,
  );
  const snakeSpan = config.snakes.reduce(
    (total, link) => total + linkSpan(link),
    0,
  );
  return ladderSpan - snakeSpan;
}

export function buildBoardConfig(input: {
  goal: number;
  preset: BoardPreset;
  seed: number;
  finishRule?: FinishRule;
}): BoardConfig {
  const goal = Math.max(
    MIN_BOARD_GOAL,
    Math.min(100, Math.round(input.goal)),
  );
  const finishRule: FinishRule =
    input.finishRule === "EXACT" ? "EXACT" : "OVERSHOOT";
  const target = boardLinkTargets(goal, input.preset);
  let best: BoardConfig | null = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const seed = (input.seed + attempt * 7919) >>> 0;
    const config = buildBoardOnce({
      goal,
      preset: input.preset,
      seed,
      finishRule,
      allowToOverlap: attempt >= 12,
    });
    if (
      config.ladders.length !== target.ladders ||
      config.snakes.length !== target.snakes
    ) {
      continue;
    }
    if (!best || netSpanGap(config) > netSpanGap(best)) best = config;
    if (netSpanGap(config) >= 0) return config;
  }
  if (best) return best;
  return buildBoardOnce({
    goal,
    preset: input.preset,
    seed: input.seed,
    finishRule,
    allowToOverlap: true,
  });
}

export function resolveBoardMove(
  from: number,
  delta: number,
  config: BoardConfig,
): {
  raw: number;
  position: number;
  jump: number;
  finished: boolean;
  bounced: boolean;
} {
  const goal = Math.max(1, config.goal);
  const start = Math.min(goal, Math.max(0, from));
  const finishRule = config.finishRule ?? "OVERSHOOT";
  if (delta <= 0) {
    const position = Math.min(goal, Math.max(0, start + delta));
    return {
      raw: position,
      position,
      jump: 0,
      finished: position >= goal,
      bounced: false,
    };
  }
  const landing = start + delta;
  if (landing > goal) {
    if (finishRule === "EXACT") {
      const position = Math.max(0, 2 * goal - landing);
      return {
        raw: goal,
        position,
        jump: position - goal,
        finished: false,
        bounced: true,
      };
    }
    return { raw: goal, position: goal, jump: 0, finished: true, bounced: false };
  }
  if (landing === goal) {
    return { raw: goal, position: goal, jump: 0, finished: true, bounced: false };
  }
  const ladder = config.ladders.find((link) => link.from === landing);
  if (ladder) {
    return {
      raw: landing,
      position: ladder.to,
      jump: ladder.to - landing,
      finished: false,
      bounced: false,
    };
  }
  const snake = config.snakes.find((link) => link.from === landing);
  if (snake) {
    return {
      raw: landing,
      position: snake.to,
      jump: snake.to - landing,
      finished: false,
      bounced: false,
    };
  }
  return {
    raw: landing,
    position: landing,
    jump: 0,
    finished: false,
    bounced: false,
  };
}

export const WALK_STEP_MS = 220;
export const WALK_SLIDE_MS = 700;
export const MOVE_ROLL_SPIN_MS = 1150;
export const MOVE_ROLL_READ_MS = 950;
export const MOVE_ANIMATION_LEAD_MS =
  MOVE_ROLL_SPIN_MS + MOVE_ROLL_READ_MS + 300;
export const MOVE_ANIMATION_MIN_WAIT_MS = 900;
export const MOVE_ANIMATION_MAX_WAIT_MS = 4200;

export function moveAnimationStart(
  createdAt: string | null | undefined,
  receivedAt: number,
): number {
  const created =
    typeof createdAt === "string" ? Date.parse(createdAt) : Number.NaN;
  const fallback = receivedAt + MOVE_ANIMATION_MIN_WAIT_MS;
  if (!Number.isFinite(created)) return fallback;
  const anchor = created + MOVE_ANIMATION_LEAD_MS;
  if (anchor <= receivedAt) return fallback;
  return Math.min(anchor, receivedAt + MOVE_ANIMATION_MAX_WAIT_MS);
}

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
