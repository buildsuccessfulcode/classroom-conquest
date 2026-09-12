"use client";

import type { Answer, Team } from "@/lib/types";

interface QuestionBoardProps {
  totalSlots: number;
  teams: Team[];
  answers: Answer[];
  mode: "display" | "play";
  myTeamId?: string;
  onSelect?: (slotNumber: number) => void;
  disabled?: boolean;
}

export default function QuestionBoard({
  totalSlots,
  teams,
  answers,
  mode,
  myTeamId,
  onSelect,
  disabled = false,
}: QuestionBoardProps) {
  const colorByTeam = new Map(teams.map((team) => [team.id, team.color_code]));
  const slots = Array.from({ length: totalSlots }, (_, index) => index + 1);
  const solvedByMe = new Set(
    answers
      .filter((answer) => answer.team_id === myTeamId)
      .map((answer) => answer.slot_number),
  );
  const myColor = myTeamId ? colorByTeam.get(myTeamId) : undefined;

  return (
    <div
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))" }}
    >
      {slots.map((slot) => {
        if (mode === "display") {
          const solvers = answers.filter(
            (answer) => answer.slot_number === slot,
          );
          const dots = solvers.slice(0, 4);
          const extra = solvers.length - dots.length;
          return (
            <div
              key={slot}
              className="flex aspect-square flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                {slot}
              </span>
              <div className="mt-1 flex items-center gap-0.5">
                {dots.map((answer) => (
                  <span
                    key={answer.id}
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: colorByTeam.get(answer.team_id) ?? "#64748B",
                    }}
                  />
                ))}
                {extra > 0 ? (
                  <span className="text-[10px] font-bold text-slate-500">
                    +{extra}
                  </span>
                ) : null}
              </div>
            </div>
          );
        }

        const solved = solvedByMe.has(slot);
        return (
          <button
            key={slot}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(slot)}
            className={[
              "relative flex aspect-square items-center justify-center rounded-xl border font-black transition",
              solved
                ? "border-transparent text-white shadow-sm"
                : "border-slate-200 bg-slate-100 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            ].join(" ")}
            style={solved && myColor ? { backgroundColor: myColor } : undefined}
          >
            <span className="text-lg">{slot}</span>
            {solved ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="absolute bottom-1 right-1 h-3.5 w-3.5"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  d="M5 13l4 4L19 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
