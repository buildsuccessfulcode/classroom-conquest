"use client";

import type { LevelInfo, StreakInfo } from "@/lib/gamification";
import { BoltIcon, FlameIcon } from "./icons";

export default function XpBar({
  level,
  streak,
  compact = false,
}: {
  level: LevelInfo;
  streak?: StreakInfo;
  compact?: boolean;
}) {
  const percent = Math.round(level.progress * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-extrabold text-grape-dark">
          <BoltIcon className="h-4 w-4 text-grape" />
          Level {level.level}
          <span className="font-bold text-ink-soft">· {level.title}</span>
        </span>
        <span className="font-mono text-xs font-bold text-ink-soft">
          {level.xpIntoLevel}/{level.xpForLevel} XP
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-cloud">
          <div
            className="cc-progress h-full rounded-full bg-gradient-to-r from-brand to-brand-light"
            style={{ width: `${percent}%` }}
          />
        </div>
        {streak && streak.current > 0 ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-mango-soft px-2.5 py-1 text-sm font-extrabold text-mango-dark"
            title={`Streak terbaik ${streak.best}`}
          >
            <FlameIcon className="cc-flame h-4 w-4 text-mango" />
            {streak.current}
          </span>
        ) : null}
      </div>
      {!compact ? (
        <p className="text-xs font-semibold text-ink-soft">
          Total {level.totalXp} XP
          {streak && streak.best > 0 ? ` · streak terbaik ${streak.best}` : ""}
        </p>
      ) : null}
    </div>
  );
}
