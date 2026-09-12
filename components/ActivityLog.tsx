"use client";

import { formatTime } from "@/lib/format";
import type { ActivityLog as ActivityLogEntry, LogKind } from "@/lib/types";

const KIND_STYLES: Record<LogKind, string> = {
  CLAIM: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ATTACK: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
  JOIN: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  SYSTEM: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  INFO: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ERROR: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  emptyText?: string;
}

export default function ActivityLog({
  logs,
  emptyText = "Belum ada aktivitas.",
}: ActivityLogProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
    );
  }

  return (
    <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
      {[...logs].reverse().map((log) => (
        <li
          key={log.id}
          className={`rounded-lg border px-3 py-2 text-sm ${KIND_STYLES[log.kind]}`}
        >
          <span className="mr-2 font-mono text-xs opacity-70">
            {formatTime(log.created_at)}
          </span>
          {log.message}
        </li>
      ))}
    </ul>
  );
}
