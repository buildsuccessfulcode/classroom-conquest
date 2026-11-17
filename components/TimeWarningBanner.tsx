"use client";

import { useServerNow } from "@/hooks/useServerNow";
import { formatClock, remainingSeconds } from "@/lib/game";
import type { Session } from "@/lib/types";
import { FlameIcon } from "./icons";

export default function TimeWarningBanner({ session }: { session: Session }) {
  const fallbackNow = session.started_at
    ? new Date(session.started_at).getTime()
    : 0;
  const now = useServerNow(fallbackNow);
  const seconds = remainingSeconds(session, now) ?? 0;

  if (session.status !== "PLAYING" || seconds > 60 || seconds <= 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border-2 border-cherry-soft bg-cherry-soft/60 px-4 py-2 text-sm font-extrabold text-cherry-dark">
      <FlameIcon className="h-4 w-4 animate-pulse text-cherry" />
      Waktu hampir habis — {formatClock(seconds)}
    </div>
  );
}
