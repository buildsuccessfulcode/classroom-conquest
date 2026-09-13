"use client";

import { useEffect, useState } from "react";
import { serverNow } from "@/lib/clock";

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let timer: number | null = null;

function start(): void {
  if (timer !== null || typeof window === "undefined") return;
  timer = window.setInterval(() => {
    const now = serverNow();
    for (const listener of listeners) listener(now);
  }, 1000);
}

function stop(): void {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
}

export function useServerNow(): number {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    const listener: Listener = (value) => setNow(value);
    listeners.add(listener);
    start();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stop();
    };
  }, []);

  return now;
}
