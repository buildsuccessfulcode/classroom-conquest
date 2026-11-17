"use client";

import { useCallback, useSyncExternalStore } from "react";
import { serverNow } from "@/lib/clock";

const listeners = new Set<() => void>();
let timer: number | null = null;
let current: number | null = null;

function emit(): void {
  current = serverNow();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  if (current === null) {
    current = serverNow();
    listener();
  }
  if (timer === null) {
    timer = window.setInterval(emit, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      current = null;
    }
  };
}

function getSnapshot(): number {
  if (current === null) current = serverNow();
  return current;
}

export function useServerNow(fallback = 0): number {
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
