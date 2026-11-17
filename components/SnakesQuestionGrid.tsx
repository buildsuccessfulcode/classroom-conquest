"use client";

import { stepRangeFor } from "@/lib/game";
import type { Difficulty, SlotInfo } from "@/lib/types";
import { LockIcon } from "./icons";

const DIFFICULTY: Record<Difficulty, { label: string; className: string }> = {
  EASY: { label: "Mudah", className: "bg-brand-soft text-brand-dark" },
  MEDIUM: { label: "Sedang", className: "bg-sun-soft text-sun-dark" },
  HARD: { label: "Sulit", className: "bg-cherry-soft text-cherry-dark" },
};

export default function SnakesQuestionGrid({
  slotInfo,
  usedSlots,
  onSelect,
  disabled = false,
  loadingSlot = null,
}: {
  slotInfo: SlotInfo[];
  usedSlots: Set<number>;
  onSelect: (slotNumber: number) => void;
  disabled?: boolean;
  loadingSlot?: number | null;
}) {
  if (slotInfo.length === 0) {
    return (
      <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
        Sesi ini belum memiliki nomor soal.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {slotInfo.map((item) => {
        const used = usedSlots.has(item.slot_number);
        const steps = stepRangeFor(item.difficulty);
        const diff = DIFFICULTY[item.difficulty];
        const loading = loadingSlot === item.slot_number;
        return (
          <button
            key={item.slot_number}
            type="button"
            disabled={disabled || used}
            aria-busy={loading}
            onClick={() => onSelect(item.slot_number)}
            className={[
              "cc-tile relative flex flex-col items-start gap-1 rounded-2xl border-2 border-b-4 p-3 text-left transition",
              used
                ? "border-cloud bg-snow text-ink-soft/60"
                : "border-cloud bg-white hover:border-ocean hover:bg-ocean-soft",
              loading ? "ring-4 ring-ocean/40" : "",
            ].join(" ")}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="cc-display text-xl font-extrabold text-ink">
                {item.slot_number}
              </span>
              <span className="rounded-full bg-grape-soft px-2 py-0.5 text-[11px] font-extrabold text-grape-dark">
                {steps.min}-{steps.max} petak
              </span>
            </span>
            <span className="flex w-full items-center justify-between gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${diff.className}`}>
                {diff.label}
              </span>
              {used ? (
                <span className="flex items-center gap-1 text-[10px] font-extrabold text-cherry-dark">
                  <LockIcon className="h-3 w-3" />
                  Hangus
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
