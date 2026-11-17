"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGameState,
  subscribe,
  type RealtimeEvent,
} from "@/lib/backend";
import { syncServerClock } from "@/lib/clock";
import type { GameState } from "@/lib/types";

const COALESCE_MS = 200;
const RECONCILE_MS = 15_000;

export function useGameState(sessionCode: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const coalesce = useRef<number | null>(null);
  const reconcile = useRef<number | null>(null);

  const reload = useCallback(async () => {
    if (!sessionCode) return;
    const id = ++seq.current;
    try {
      const next = await fetchGameState(sessionCode);
      if (id !== seq.current) return;
      if (next) syncServerClock(next.serverTime);
      setState(next);
      setError(next ? null : "Sesi tidak ditemukan");
    } catch (err) {
      if (id !== seq.current) return;
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    }
  }, [sessionCode]);

  const scheduleReload = useCallback(() => {
    if (coalesce.current !== null) return;
    coalesce.current = window.setTimeout(() => {
      coalesce.current = null;
      void reload();
    }, COALESCE_MS);
  }, [reload]);

  useEffect(() => {
    if (!sessionCode) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const applyEvent = (event: RealtimeEvent) => {
      if (event.type === "answer.created") {
        setState((prev) => {
          if (!prev || prev.answers.some((a) => a.id === event.answer.id)) {
            return prev;
          }
          return { ...prev, answers: [...prev.answers, event.answer] };
        });
      } else if (event.type === "team.joined") {
        setState((prev) => {
          if (!prev || prev.teams.some((t) => t.id === event.team.id)) {
            return prev;
          }
          return { ...prev, teams: [...prev.teams, event.team] };
        });
      } else if (event.type === "team.moved") {
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            teams: prev.teams.map((team) =>
              team.id === event.team.id ? event.team : team,
            ),
          };
        });
      } else if (event.type === "session.updated") {
        setState((prev) =>
          prev ? { ...prev, session: event.session } : prev,
        );
      } else if (event.type === "log.created") {
        setState((prev) => {
          if (!prev || prev.logs.some((log) => log.id === event.log.id)) {
            return prev;
          }
          return { ...prev, logs: [...prev.logs, event.log] };
        });
      }
      scheduleReload();
    };

    void (async () => {
      const next = await fetchGameState(sessionCode);
      if (!active) return;
      if (next) syncServerClock(next.serverTime);
      setState(next);
      setError(next ? null : "Sesi tidak ditemukan");
      if (!next) return;
      const stop = await subscribe(next.session.id, applyEvent);
      if (!active) {
        stop();
        return;
      }
      unsubscribe = stop;
      reconcile.current = window.setInterval(() => void reload(), RECONCILE_MS);
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const onOnline = () => void reload();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      active = false;
      unsubscribe?.();
      if (coalesce.current !== null) window.clearTimeout(coalesce.current);
      if (reconcile.current !== null) window.clearInterval(reconcile.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [sessionCode, reload, scheduleReload]);

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
