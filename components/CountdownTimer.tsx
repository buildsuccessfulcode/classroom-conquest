"use client";

import { useEffect, useRef } from "react";
import { useServerNow } from "@/hooks/useServerNow";
import { formatClock, remainingSeconds } from "@/lib/game";
import type { Session } from "@/lib/types";
import { ClockIcon } from "./icons";

interface CountdownTimerProps {
  session: Session;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  onExpire?: () => void;
}

const SIZES = {
  sm: { text: "text-lg", icon: "h-4 w-4", gap: "gap-1.5", pad: "px-2.5 py-1" },
  md: { text: "text-2xl", icon: "h-5 w-5", gap: "gap-2", pad: "px-3.5 py-1.5" },
  lg: { text: "text-4xl", icon: "h-7 w-7", gap: "gap-2.5", pad: "px-4 py-2" },
} as const;

export default function CountdownTimer({
  session,
  size = "md",
  showProgress = false,
  onExpire,
}: CountdownTimerProps) {
  const fallbackNow = session.started_at
    ? new Date(session.started_at).getTime()
    : 0;
  const now = useServerNow(fallbackNow);
  const seconds = remainingSeconds(session, now) ?? 0;
  const firedRef = useRef(false);
  const total = session.duration_minutes * 60;
  const progress = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const waiting = session.status === "LOBBY" && !session.started_at;
  const ended = session.status === "ENDED" || seconds <= 0;
  const urgent = !waiting && !ended && seconds <= 60;
  const style = SIZES[size];

  useEffect(() => {
    firedRef.current = false;
  }, [session.started_at, session.status]);

  useEffect(() => {
    if (firedRef.current) return;
    if (session.status === "PLAYING" && seconds <= 0) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [seconds, session.status, onExpire]);

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={[
          "inline-flex items-center rounded-2xl font-mono font-extrabold tabular-nums",
          style.gap,
          style.pad,
          style.text,
          ended
            ? "bg-cloud text-ink-soft"
            : urgent
              ? "bg-cherry-soft text-cherry-dark"
              : "bg-white text-ink shadow-[0_4px_0_#e5e5e5]",
        ].join(" ")}
      >
        <ClockIcon
          className={[
            style.icon,
            ended ? "text-ink-soft" : urgent ? "text-cherry" : "text-ocean",
          ].join(" ")}
        />
        {formatClock(seconds)}
      </span>
      {showProgress ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-cloud">
          <div
            className={[
              "h-full w-full origin-left rounded-full transition-transform duration-500",
              urgent ? "bg-cherry" : "bg-gradient-to-r from-ocean to-brand",
            ].join(" ")}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      ) : null}
      {waiting ? (
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
          Menunggu mulai
        </span>
      ) : null}
    </div>
  );
}
