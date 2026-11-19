"use client";

import { memo, useMemo } from "react";
import type { Answer, Team } from "@/lib/types";
import { CheckIcon, LockIcon } from "./icons";

type BoardFilter = "all" | "todo" | "done";

interface QuestionBoardProps {
  totalSlots: number;
  teams: Team[];
  answers: Answer[];
  mode: "display" | "play";
  myTeamId?: string;
  onSelect?: (slotNumber: number) => void;
  disabled?: boolean;
  loadingSlot?: number | null;
  disabledReason?: string;
  lockedSlots?: number[];
  filter?: BoardFilter;
}

const SCROLL_THRESHOLD = 48;

function QuestionBoard({
  totalSlots,
  teams,
  answers,
  mode,
  myTeamId,
  onSelect,
  disabled = false,
  loadingSlot = null,
  disabledReason,
  lockedSlots = [],
  filter = "all",
}: QuestionBoardProps) {
  const colorByTeam = useMemo(
    () => new Map(teams.map((team) => [team.id, team.color_code])),
    [teams],
  );

  const answersBySlot = useMemo(() => {
    const map = new Map<number, Answer[]>();
    for (const answer of answers) {
      const list = map.get(answer.slot_number);
      if (list) list.push(answer);
      else map.set(answer.slot_number, [answer]);
    }
    return map;
  }, [answers]);

  const solvedByMe = useMemo(
    () =>
      new Set(
        answers
          .filter((answer) => answer.team_id === myTeamId)
          .map((answer) => answer.slot_number),
      ),
    [answers, myTeamId],
  );

  const locked = useMemo(() => new Set(lockedSlots), [lockedSlots]);
  const myColor = myTeamId ? colorByTeam.get(myTeamId) : undefined;
  const showOverlay = mode === "play" && Boolean(disabledReason);

  const slots = useMemo(() => {
    const all = Array.from({ length: totalSlots }, (_, index) => index + 1);
    if (mode !== "play" || filter === "all") return all;
    return all.filter((slot) =>
      filter === "done" ? solvedByMe.has(slot) : !solvedByMe.has(slot),
    );
  }, [totalSlots, mode, filter, solvedByMe]);

  const scrollable = totalSlots > SCROLL_THRESHOLD;

  return (
    <div className="relative w-full">
      <div
        className={[
          scrollable ? "cc-scrollbar max-h-[55vh] overflow-y-auto pr-1" : "",
        ].join(" ")}
      >
        <div
          className={[
            "grid w-full gap-2.5 transition sm:gap-3",
            showOverlay ? "opacity-50 blur-[1px]" : "",
          ].join(" ")}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${scrollable ? 56 : 64}px, 1fr))`,
          }}
        >
          {slots.map((slot) => {
            if (mode === "display") {
              const solvers = answersBySlot.get(slot) ?? [];
              const dots = solvers.slice(0, 3);
              const extra = solvers.length - dots.length;
              const solved = solvers.length > 0;
              return (
                <div
                  key={slot}
                  className={[
                    "cc-cv relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-b-4",
                    solved
                      ? "border-brand-dark bg-brand-soft"
                      : "border-cloud bg-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "cc-display text-2xl font-extrabold",
                      solved ? "text-brand-dark" : "text-ink-soft",
                    ].join(" ")}
                  >
                    {slot}
                  </span>
                  <div className="mt-0.5 flex h-4 items-center gap-0.5">
                    {dots.map((answer) => (
                      <span
                        key={answer.id}
                        className="h-2.5 w-2.5 rounded-full border border-white"
                        style={{
                          backgroundColor:
                            colorByTeam.get(answer.team_id) ?? "#64748B",
                        }}
                      />
                    ))}
                    {extra > 0 ? (
                      <span className="text-[10px] font-extrabold text-ink-soft">
                        +{extra}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            }

            const solved = solvedByMe.has(slot);
            const isLocked = !solved && locked.has(slot);
            const isLoading = loadingSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                disabled={disabled}
                aria-busy={isLoading}
                aria-label={
                  isLocked
                    ? `Nomor ${slot} terkunci, buka untuk melihat jawaban`
                    : undefined
                }
                onClick={() => onSelect?.(slot)}
                className={[
                  "cc-tile cc-cv relative flex aspect-square items-center justify-center rounded-2xl border-2 border-b-4 font-extrabold",
                  solved
                    ? "border-black/10 text-white"
                    : isLocked
                      ? "border-cloud bg-snow text-ink-soft/50"
                      : "border-cloud bg-white text-ink hover:border-ocean hover:bg-ocean-soft disabled:opacity-40",
                  isLoading ? "ring-4 ring-ocean/40" : "",
                ].join(" ")}
                style={
                  solved && myColor ? { backgroundColor: myColor } : undefined
                }
              >
                {isLoading ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-7 w-7 animate-spin text-ocean"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <circle cx="12" cy="12" r="9" className="opacity-25" />
                    <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                  </svg>
                ) : (
                  <>
                    <span className="cc-display text-2xl">{slot}</span>
                    {solved ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/30">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : isLocked ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cherry-soft text-cherry-dark">
                        <LockIcon className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "play" && slots.length === 0 ? (
        <p className="rounded-2xl bg-snow px-4 py-8 text-center text-sm font-bold text-ink-soft">
          {filter === "done"
            ? "Belum ada nomor yang selesai."
            : "Semua nomor sudah selesai. Kerja bagus!"}
        </p>
      ) : null}

      {showOverlay ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/70 backdrop-blur-[1px]">
          <LockIcon className="h-9 w-9 text-ink-soft" />
          <p className="px-4 text-center text-sm font-bold text-ink-soft">
            {disabledReason}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default memo(QuestionBoard);
