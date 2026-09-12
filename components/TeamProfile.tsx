"use client";

import type { TeamStats } from "@/lib/gamification";
import BadgeShelf from "./BadgeShelf";
import Mascot, { type MascotMood } from "./Mascot";
import XpBar from "./XpBar";
import { CheckIcon, TargetIcon } from "./icons";

export default function TeamProfile({
  teamName,
  colorCode,
  stats,
  mood = "happy",
  showBadges = true,
}: {
  teamName: string;
  colorCode: string;
  stats: TeamStats;
  mood?: MascotMood;
  showBadges?: boolean;
}) {
  return (
    <section className="cc-card overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <div className="shrink-0">
          <Mascot mood={mood} size={92} crown={stats.rank === 1} float />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 shrink-0 rounded-full border-2 border-black/10"
              style={{ backgroundColor: colorCode }}
            />
            <h2 className="cc-display truncate text-2xl font-extrabold text-ink">
              {teamName}
            </h2>
          </div>
          <div className="mt-3">
            <XpBar level={stats.level} streak={stats.streak} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-t-2 border-cloud bg-cloud">
        <div className="flex flex-col items-center gap-0.5 bg-white py-3">
          <TargetIcon className="h-5 w-5 text-ocean" />
          <span className="font-mono text-lg font-extrabold text-ink">
            {stats.rank > 0 ? `#${stats.rank}` : "-"}
          </span>
          <span className="text-[11px] font-bold text-ink-soft">Peringkat</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 bg-white py-3">
          <CheckIcon className="h-5 w-5 text-brand" />
          <span className="font-mono text-lg font-extrabold text-ink">
            {stats.correct}/{stats.total}
          </span>
          <span className="text-[11px] font-bold text-ink-soft">Benar</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 bg-white py-3">
          <span className="text-lg font-extrabold text-grape">XP</span>
          <span className="font-mono text-lg font-extrabold text-ink">
            {stats.xp}
          </span>
          <span className="text-[11px] font-bold text-ink-soft">Total</span>
        </div>
      </div>

      {showBadges ? (
        <div className="border-t-2 border-cloud p-5">
          <BadgeShelf badges={stats.badges} />
        </div>
      ) : null}
    </section>
  );
}
