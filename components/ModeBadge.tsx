"use client";

import { backendMode } from "@/lib/backend";

export default function ModeBadge() {
  const mode = backendMode();
  const isSupabase = mode === "supabase";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        isSupabase
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          isSupabase ? "bg-emerald-500" : "bg-amber-500",
        ].join(" ")}
      />
      {isSupabase ? "Mode Supabase" : "Mode Demo (lokal)"}
    </span>
  );
}
