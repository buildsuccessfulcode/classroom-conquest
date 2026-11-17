"use client";

import { buildBoardStandings } from "@/lib/game";
import type { BoardConfig, Move, Team } from "@/lib/types";
import Avatar from "./Avatar";
import { CrownIcon, FlagIcon } from "./icons";

export default function BoardStandings({
  teams,
  config,
  moves,
  highlightTeamId,
  compact = false,
}: {
  teams: Team[];
  config: BoardConfig;
  moves?: Move[];
  highlightTeamId?: string;
  compact?: boolean;
}) {
  const standings = buildBoardStandings(teams, moves);
  if (standings.length === 0) {
    return (
      <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
        Belum ada tim yang bergabung.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {standings.map((entry) => (
        <li
          key={entry.team.id}
          className={[
            "flex items-center gap-3 rounded-2xl border-2 px-3",
            compact ? "py-1.5" : "py-2",
            entry.team.id === highlightTeamId
              ? "border-ocean bg-ocean-soft"
              : "border-cloud bg-white",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
              entry.rank === 1
                ? "bg-sun text-ink"
                : entry.rank <= 3
                  ? "bg-ocean-soft text-ocean-dark"
                  : "bg-snow text-ink-soft",
            ].join(" ")}
          >
            {entry.rank}
          </span>
          <Avatar id={entry.team.avatar} size={compact ? 26 : 32} />
          <span className="min-w-0 flex-1 truncate font-extrabold text-ink">
            {entry.team.team_name}
          </span>
          {entry.finishedAt ? (
            <span className="flex items-center gap-1 rounded-full bg-sun-soft px-2 py-0.5 text-[10px] font-extrabold text-sun-dark">
              <CrownIcon className="h-3 w-3" />
              Finis
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono text-xs font-extrabold text-ink-soft">
              <FlagIcon className="h-3.5 w-3.5" />
              {entry.position}/{config.goal}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
