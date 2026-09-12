"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGameState, subscribe } from "@/lib/backend";
import type { GameState } from "@/lib/types";

export function useGameState(sessionCode: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sessionCode) return;
    try {
      const next = await fetchGameState(sessionCode);
      setState(next);
      setError(next ? null : "Sesi tidak ditemukan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    }
  }, [sessionCode]);

  useEffect(() => {
    if (!sessionCode) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      try {
        const next = await fetchGameState(sessionCode);
        if (!active) return;
        setState(next);
        setError(next ? null : "Sesi tidak ditemukan");
        if (next) {
          unsubscribe = subscribe(next.session.id, () => {
            void reload();
          });
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Gagal memuat sesi");
        }
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [sessionCode, reload]);

  const matchedState =
    state && state.session.session_code === sessionCode ? state : null;
  const loading = Boolean(sessionCode) && !matchedState && !error;

  return {
    state: matchedState,
    loading,
    error: sessionCode ? error : null,
    reload,
  };
}
