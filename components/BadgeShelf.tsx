"use client";

import type { BadgeTone, EarnedBadge } from "@/lib/gamification";
import BadgeIcon from "./BadgeIcon";
import { LockIcon } from "./icons";

const TONE: Record<BadgeTone, string> = {
  brand: "bg-brand text-white",
  ocean: "bg-ocean text-white",
  grape: "bg-grape text-white",
  mango: "bg-mango text-white",
  cherry: "bg-cherry text-white",
  sun: "bg-sun text-ink",
};

export default function BadgeShelf({
  badges,
  title = "Koleksi Badge",
}: {
  badges: EarnedBadge[];
  title?: string;
}) {
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="cc-display text-lg font-extrabold text-ink">{title}</h3>
        <span className="rounded-full bg-snow px-3 py-1 text-xs font-extrabold text-ink-soft">
          {earned}/{badges.length}
        </span>
      </div>
      <ul className="grid grid-cols-4 gap-3">
        {badges.map((badge) => (
          <li key={badge.id} className="flex flex-col items-center gap-1.5">
            <span
              title={`${badge.label} — ${badge.description}`}
              className={[
                "flex h-14 w-14 items-center justify-center rounded-2xl border-b-4 transition",
                badge.earned
                  ? `${TONE[badge.tone]} border-black/15 cc-bounce-in`
                  : "border-cloud bg-white text-cloud",
              ].join(" ")}
            >
              {badge.earned ? (
                <BadgeIcon id={badge.id} className="h-7 w-7" />
              ) : (
                <LockIcon className="h-6 w-6" />
              )}
            </span>
            <span
              className={[
                "text-center text-[10px] font-bold leading-tight",
                badge.earned ? "text-ink" : "text-ink-soft/70",
              ].join(" ")}
            >
              {badge.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
