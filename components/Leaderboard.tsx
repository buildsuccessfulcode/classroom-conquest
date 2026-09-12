"use client";

import { buildLeaderboard } from "@/lib/game";
import { formatTime } from "@/lib/format";
import type { Answer, Team } from "@/lib/types";

interface LeaderboardProps {
  teams: Team[];
  answers: Answer[];
  totalSlots: number;
  limit?: number;
}

export default function Leaderboard({
  teams,
  answers,
  totalSlots,
  limit,
}: LeaderboardProps) {
  const entries = buildLeaderboard(teams, answers, totalSlots);
  const visible = typeof limit === "number" ? entries.slice(0, limit) : entries;

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Belum ada tim yang bergabung.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {visible.map((entry) => (
        <li
          key={entry.team.id}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="w-6 text-center text-sm font-bold text-slate-400">
            {entry.rank}
          </span>
          <span
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: entry.team.color_code }}
          />
          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">
            {entry.team.team_name}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {entry.correct}/{entry.total}
          </span>
          {entry.lastAnsweredAt ? (
            <span className="hidden text-xs text-slate-400 sm:inline">
              {formatTime(entry.lastAnsweredAt)}
            </span>
          ) : null}
          <span className="w-16 text-right font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {entry.points}
          </span>
        </li>
      ))}
    </ol>
  );
}
