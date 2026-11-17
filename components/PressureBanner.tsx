"use client";

import { buildBoardStandings } from "@/lib/game";
import type { BoardConfig, Move, Team } from "@/lib/types";

export default function PressureBanner({
  teams,
  moves,
  config,
  status,
}: {
  teams: Team[];
  moves: Move[];
  config: BoardConfig;
  status: string;
}) {
  if (status !== "PLAYING") return null;
  const standings = buildBoardStandings(teams, moves);
  const leader = standings[0];
  const second = standings[1];
  if (!leader || leader.finishedAt) return null;
  const goal = Math.max(1, config.goal);
  const duelGate = Math.ceil(goal * 0.8);
  const duel =
    Boolean(second) &&
    !second.finishedAt &&
    leader.position >= duelGate &&
    second.position >= duelGate &&
    leader.position - second.position <= 2;
  const hot = leader.position >= Math.ceil(goal * 0.7);
  if (!duel && !hot) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "cc-bounce-in flex flex-wrap items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-center text-sm font-extrabold",
        duel
          ? "border-cherry bg-cherry-soft text-cherry-dark"
          : "border-sun bg-sun-soft text-sun-dark",
      ].join(" ")}
    >
      {duel && second ? (
        <>
          <span>DUEL!</span>
          <span>{leader.team.team_name}</span>
          <span>vs</span>
          <span>{second.team.team_name}</span>
          <span className="font-mono">
            {leader.position}-{second.position}/{goal}
          </span>
        </>
      ) : (
        <>
          <span>BURUAN!</span>
          <span>{leader.team.team_name}</span>
          <span className="font-mono">
            {leader.position}/{goal}
          </span>
        </>
      )}
    </div>
  );
}
