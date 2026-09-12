"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function getListeners(key: string): Set<() => void> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function subscribeToKey(key: string, callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const set = getListeners(key);
  set.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function emit(key: string): void {
  for (const callback of getListeners(key)) callback();
}

export function readStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export function writeStoredValue(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
  emit(key);
}

export function useStoredValue(key: string): string | null {
  const subscribe = useCallback(
    (callback: () => void) => subscribeToKey(key, callback),
    [key],
  );
  const getSnapshot = useCallback(() => readStoredValue(key), [key]);
  const getServerSnapshot = useCallback(() => null, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
