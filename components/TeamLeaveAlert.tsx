"use client";

import { useEffect, useRef } from "react";
import { LogOutIcon } from "./icons";

const VISIBLE_MS = 3500;

export default function TeamLeaveAlert({
  teamName,
  color,
  onDone,
}: {
  teamName: string;
  color?: string;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div className="cc-bounce-in flex items-center gap-3 rounded-2xl border-2 border-cherry-dark bg-cherry px-4 py-3 text-white shadow-xl">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <LogOutIcon className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold uppercase tracking-widest text-white/80">
            Peserta keluar
          </span>
          <span className="flex items-center gap-2 text-base font-extrabold">
            {color ? (
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-white/40"
                style={{ backgroundColor: color }}
              />
            ) : null}
            <span className="truncate">
              Tim {teamName} meninggalkan permainan
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
