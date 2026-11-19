"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  backendMode,
  fetchGameState,
  subscribe,
  type RealtimeEvent,
} from "@/lib/backend";
import { syncServerClock } from "@/lib/clock";
import type { GameState, SlotAttempt } from "@/lib/types";

const COALESCE_MS = 200;
const EVENT_FLUSH_MS = 80;
const RECONCILE_MS = 20_000;
const MAX_LOGS = 50;

function attemptKey(attempt: SlotAttempt): string {
  return `${attempt.team_id}:${attempt.slot_number}`;
}

function reduceEvents(prev: GameState, events: RealtimeEvent[]): GameState {
  let next = prev;
  for (const event of events) {
    if (event.type === "answer.created") {
      if (next.answers.some((answer) => answer.id === event.answer.id)) {
        continue;
      }
      next = { ...next, answers: [...next.answers, event.answer] };
    } else if (event.type === "team.joined") {
      if (next.teams.some((team) => team.id === event.team.id)) continue;
      next = { ...next, teams: [...next.teams, event.team] };
    } else if (event.type === "team.moved") {
      next = {
        ...next,
        teams: next.teams.map((team) =>
          team.id === event.team.id ? event.team : team,
        ),
      };
    } else if (event.type === "move.created") {
      if (next.moves.some((move) => move.id === event.move.id)) continue;
      next = { ...next, moves: [...next.moves, event.move] };
    } else if (event.type === "attempt.updated") {
      const key = attemptKey(event.attempt);
      const found = next.attempts.some(
        (attempt) => attemptKey(attempt) === key,
      );
      next = {
        ...next,
        attempts: found
          ? next.attempts.map((attempt) =>
              attemptKey(attempt) === key ? event.attempt : attempt,
            )
          : [...next.attempts, event.attempt],
      };
    } else if (event.type === "session.updated") {
      next = { ...next, session: event.session };
    } else if (event.type === "log.created") {
      if (next.logs.some((log) => log.id === event.log.id)) continue;
      next = {
        ...next,
        logs: [...next.logs, event.log].slice(-MAX_LOGS),
      };
    }
  }
  return next;
}

export function useGameState(
  sessionCode: string | null,
  teamId?: string | null,
) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const coalesce = useRef<number | null>(null);
  const reconcile = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const pending = useRef<RealtimeEvent[]>([]);

  const reload = useCallback(async () => {
    if (!sessionCode) return;
    const id = ++seq.current;
    try {
      const next = await fetchGameState(sessionCode, teamId);
      if (id !== seq.current) return;
      if (next) syncServerClock(next.serverTime);
      startTransition(() => {
        setState(next);
      });
      setError(next ? null : "Sesi tidak ditemukan");
    } catch (err) {
      if (id !== seq.current) return;
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    }
  }, [sessionCode, teamId]);

  const scheduleReload = useCallback(
    (delay = COALESCE_MS) => {
      if (coalesce.current !== null) return;
      coalesce.current = window.setTimeout(() => {
        coalesce.current = null;
        void reload();
      }, delay);
    },
    [reload],
  );

  useEffect(() => {
    if (!sessionCode) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const flush = () => {
      flushTimer.current = null;
      const events = pending.current;
      pending.current = [];
      if (events.length === 0) return;
      seq.current += 1;
      startTransition(() => {
        setState((prev) => (prev ? reduceEvents(prev, events) : prev));
      });
    };

    const queue = (event: RealtimeEvent) => {
      if (event.type === "refresh") {
        scheduleReload();
        return;
      }
      pending.current.push(event);
      if (flushTimer.current === null) {
        flushTimer.current = window.setTimeout(flush, EVENT_FLUSH_MS);
      }
      if (event.type === "session.updated") {
        scheduleReload();
      }
    };

    void (async () => {
      if (backendMode() === "supabase") {
        void import("@/lib/supabase/client");
      }
      const next = await fetchGameState(sessionCode, teamId);
      if (!active) return;
      if (next) syncServerClock(next.serverTime);
      setState(next);
      setError(next ? null : "Sesi tidak ditemukan");
      if (!next) return;
      const stop = await subscribe(next.session.id, queue);
      if (!active) {
        stop();
        return;
      }
      unsubscribe = stop;
      reconcile.current = window.setInterval(() => {
        if (document.visibilityState === "visible") void reload();
      }, RECONCILE_MS);
      scheduleReload(400);
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
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      coalesce.current = null;
      reconcile.current = null;
      flushTimer.current = null;
      pending.current = [];
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [sessionCode, teamId, reload, scheduleReload]);

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
