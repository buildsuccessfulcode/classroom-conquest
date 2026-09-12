"use client";

import { buildLeaderboard } from "@/lib/game";
import type { Answer, Team } from "@/lib/types";
import { BoltIcon, CrownIcon } from "./icons";

interface LeaderboardProps {
  teams: Team[];
  answers: Answer[];
  totalSlots: number;
  limit?: number;
  variant?: "podium" | "list";
  scroll?: boolean;
  compact?: boolean;
}

const PODIUM_STYLE = [
  {
    height: "h-24",
    bg: "bg-sun",
    border: "border-sun-dark",
    order: "order-2",
    ring: "ring-sun",
  },
  {
    height: "h-16",
    bg: "bg-ocean",
    border: "border-ocean-dark",
    order: "order-1",
    ring: "ring-ocean",
  },
  {
    height: "h-12",
    bg: "bg-mango",
    border: "border-mango-dark",
    order: "order-3",
    ring: "ring-mango",
  },
];

export default function Leaderboard({
  teams,
  answers,
  totalSlots,
  limit,
  variant = "podium",
  scroll = false,
  compact = false,
}: LeaderboardProps) {
  const entries = buildLeaderboard(teams, answers, totalSlots);
  const scrollable = scroll || entries.length > 8;
  const rowPad = compact ? "py-2" : "py-2.5";

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
        Belum ada tim yang bergabung.
      </p>
    );
  }

  if (variant === "list") {
    const visible =
      typeof limit === "number" ? entries.slice(0, limit) : entries;
    return (
      <div
        className={
          scrollable ? "cc-scrollbar max-h-[420px] overflow-y-auto pr-1" : ""
        }
      >
        <ol className="flex flex-col gap-2">
          {visible.map((entry) => (
            <li
              key={entry.team.id}
              className={`flex items-center gap-3 rounded-2xl border-2 border-cloud bg-white px-3 ${rowPad}`}
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
              <span
                className="h-4 w-4 shrink-0 rounded-full border-2 border-black/10"
                style={{ backgroundColor: entry.team.color_code }}
              />
              <span className="min-w-0 flex-1 truncate font-extrabold text-ink">
                {entry.team.team_name}
              </span>
              <span className="text-xs font-bold text-ink-soft">
                {entry.correct}/{entry.total}
              </span>
              <span className="flex items-center gap-1 font-mono text-sm font-extrabold text-grape-dark">
                <BoltIcon className="h-3.5 w-3.5 text-grape" />
                {entry.points}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-center gap-2">
        {podiumOrder.map((entry, slot) => {
          if (!entry) return <span key={slot} className="w-20" />;
          const style = PODIUM_STYLE[entry.rank - 1];
          return (
            <div
              key={entry.team.id}
              className={`flex w-20 flex-col items-center gap-1.5 ${style.order}`}
            >
              {entry.rank === 1 ? (
                <CrownIcon className="h-6 w-6 text-sun-dark" />
              ) : null}
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-black/10 text-sm font-extrabold text-white ${style.ring} ring-2 ring-offset-1`}
                style={{ backgroundColor: entry.team.color_code }}
              >
                {entry.team.team_name.slice(0, 2).toUpperCase()}
              </span>
              <span className="w-full truncate text-center text-xs font-extrabold text-ink">
                {entry.team.team_name}
              </span>
              <div
                className={`flex w-full flex-col items-center justify-start rounded-t-xl border-2 border-b-0 pt-1.5 text-white ${style.height} ${style.bg} ${style.border}`}
              >
                <span className="font-mono text-sm font-extrabold">
                  {entry.points}
                </span>
                <span className="text-[10px] font-bold opacity-90">XP</span>
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 ? (
        <div
          className={
            scrollable ? "cc-scrollbar max-h-[300px] overflow-y-auto pr-1" : ""
          }
        >
          <ol className="flex flex-col gap-2">
            {rest.map((entry) => (
              <li
                key={entry.team.id}
                className={`flex items-center gap-3 rounded-2xl border-2 border-cloud bg-white px-3 ${rowPad}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-snow text-xs font-extrabold text-ink-soft">
                  {entry.rank}
                </span>
                <span
                  className="h-4 w-4 shrink-0 rounded-full border-2 border-black/10"
                  style={{ backgroundColor: entry.team.color_code }}
                />
                <span className="min-w-0 flex-1 truncate font-extrabold text-ink">
                  {entry.team.team_name}
                </span>
                <span className="font-mono text-sm font-extrabold text-grape-dark">
                  {entry.points}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
