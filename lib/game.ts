import type { Answer, Difficulty, LeaderboardEntry, Team } from "./types";

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
