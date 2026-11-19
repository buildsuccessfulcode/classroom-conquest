"use client";

import { memo, useMemo } from "react";
import { formatTime } from "@/lib/format";
import type { ActivityLog as ActivityLogEntry, LogKind } from "@/lib/types";

const KIND_STYLES: Record<LogKind, { card: string; dot: string }> = {
  CLAIM: { card: "border-brand-soft bg-brand-soft/50 text-brand-dark", dot: "bg-brand" },
  ATTACK: { card: "border-cherry-soft bg-cherry-soft/50 text-cherry-dark", dot: "bg-cherry" },
  JOIN: { card: "border-ocean-soft bg-ocean-soft/50 text-ocean-dark", dot: "bg-ocean" },
  SYSTEM: { card: "border-cloud bg-snow text-ink-soft", dot: "bg-ink-soft" },
  INFO: { card: "border-sun-soft bg-sun-soft/60 text-sun-dark", dot: "bg-sun" },
  ERROR: { card: "border-cherry-soft bg-cherry-soft/50 text-cherry-dark", dot: "bg-cherry" },
};

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  emptyText?: string;
}

export default memo(function ActivityLog({
  logs,
  emptyText = "Belum ada aktivitas mencurigakan.",
}: ActivityLogProps) {
  const ordered = useMemo(() => [...logs].reverse(), [logs]);
  if (logs.length === 0) {
    return (
      <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="cc-scrollbar flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
      {ordered.map((log) => {
        const style = KIND_STYLES[log.kind];
        return (
          <li
            key={log.id}
            className={`flex items-start gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-semibold ${style.card}`}
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
            />
            <span className="min-w-0 flex-1">
              <span className="mr-1.5 font-mono text-[11px] opacity-60">
                {formatTime(log.created_at)}
              </span>
              {log.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
});
