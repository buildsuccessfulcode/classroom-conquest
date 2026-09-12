"use client";

import { backendMode } from "@/lib/backend";

export default function ModeBadge() {
  const mode = backendMode();
  const isSupabase = mode === "supabase";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold",
        isSupabase
          ? "border-brand-soft bg-brand-soft/50 text-brand-dark"
          : "border-sun-soft bg-sun-soft/60 text-sun-dark",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          isSupabase ? "bg-brand" : "bg-sun",
        ].join(" ")}
      />
      {isSupabase ? "Supabase" : "Demo Lokal"}
    </span>
  );
}
