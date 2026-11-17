"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWalkFrames, WALK_START_DELAY_MS } from "@/lib/game";
import type { BoardConfig, Move, Team } from "@/lib/types";

export interface WalkMotion {
  tile: number;
  durationMs: number;
  sliding: boolean;
}

const FREEZE_FALLBACK_MS = 3000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.lite === "true") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useBoardWalk({
  teams,
  moves,
  config,
  paused = false,
  enabled = true,
  onWalkStart,
  onWalkEnd,
}: {
  teams: Team[];
  moves: Move[];
  config: BoardConfig | null;
  paused?: boolean;
  enabled?: boolean;
  onWalkStart?: (teamId: string) => void;
  onWalkEnd?: (teamId: string, move: Move) => void;
}) {
  const [motions, setMotions] = useState<Record<string, WalkMotion>>({});
  const motionsRef = useRef<Record<string, WalkMotion>>({});
  const settledRef = useRef<Map<string, number>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());
  const queuedRef = useRef<Map<string, Move>>(new Map());
  const timersRef = useRef<Map<string, number>>(new Map());
  const freezeTimersRef = useRef<Map<string, number>>(new Map());
  const initializedRef = useRef(false);
  const configRef = useRef(config);
  const startRef = useRef(onWalkStart);
  const endRef = useRef(onWalkEnd);

  useEffect(() => {
    configRef.current = config;
    startRef.current = onWalkStart;
    endRef.current = onWalkEnd;
  }, [config, onWalkEnd, onWalkStart]);

  const commit = useCallback(() => {
    setMotions({ ...motionsRef.current });
  }, []);

  const setMotion = useCallback(
    (teamId: string, motion: WalkMotion) => {
      const current = motionsRef.current[teamId];
      if (
        current &&
        current.tile === motion.tile &&
        current.durationMs === motion.durationMs &&
        current.sliding === motion.sliding
      ) {
        return;
      }
      motionsRef.current = { ...motionsRef.current, [teamId]: motion };
      commit();
    },
    [commit],
  );

  const clearMotion = useCallback(
    (teamId: string) => {
      if (!motionsRef.current[teamId]) return;
      const next = { ...motionsRef.current };
      delete next[teamId];
      motionsRef.current = next;
      commit();
    },
    [commit],
  );

  const clearTimer = useCallback((teamId: string) => {
    const id = timersRef.current.get(teamId);
    if (id !== undefined) window.clearTimeout(id);
    timersRef.current.delete(teamId);
  }, []);

  const clearFreezeTimer = useCallback((teamId: string) => {
    const id = freezeTimersRef.current.get(teamId);
    if (id !== undefined) window.clearTimeout(id);
    freezeTimersRef.current.delete(teamId);
  }, []);

  const finishWalk = useCallback(
    (teamId: string, move: Move) => {
      clearTimer(teamId);
      const goal = Math.max(1, configRef.current?.goal ?? 1);
      settledRef.current.set(
        teamId,
        Math.min(goal, Math.max(0, move.to_position)),
      );
      clearMotion(teamId);
      endRef.current?.(teamId, move);
    },
    [clearMotion, clearTimer],
  );

  const startWalk = useCallback(
    (move: Move) => {
      const boardConfig = configRef.current;
      const teamId = move.team_id;
      if (!boardConfig) return;
      clearTimer(teamId);
      clearFreezeTimer(teamId);
      queuedRef.current.delete(teamId);
      const frames = buildWalkFrames(move, boardConfig);
      if (frames.length === 0) {
        finishWalk(teamId, move);
        return;
      }
      const goal = Math.max(1, boardConfig.goal);
      if (prefersReducedMotion()) {
        const tile = Math.min(goal, Math.max(0, move.to_position));
        settledRef.current.set(teamId, tile);
        setMotion(teamId, { tile, durationMs: 0, sliding: false });
        startRef.current?.(teamId);
        timersRef.current.set(
          teamId,
          window.setTimeout(() => finishWalk(teamId, move), 60),
        );
        return;
      }
      startRef.current?.(teamId);
      let index = 0;
      const runFrame = () => {
        const frame = frames[index];
        settledRef.current.set(teamId, frame.tile);
        setMotion(teamId, {
          tile: frame.tile,
          durationMs: frame.durationMs,
          sliding: frame.sliding,
        });
        const hold = frame.durationMs > 0 ? frame.durationMs : 80;
        index += 1;
        if (index >= frames.length) {
          timersRef.current.set(
            teamId,
            window.setTimeout(() => finishWalk(teamId, move), hold),
          );
        } else {
          timersRef.current.set(teamId, window.setTimeout(runFrame, hold));
        }
      };
      runFrame();
    },
    [clearFreezeTimer, clearTimer, finishWalk, setMotion],
  );

  useEffect(() => {
    if (!config) return;
    const goal = Math.max(1, config.goal);
    const clamp = (value: number) => Math.min(goal, Math.max(0, value));
    const teamIds = new Set(teams.map((team) => team.id));

    if (!initializedRef.current) {
      initializedRef.current = true;
      seenRef.current = new Set(moves.map((move) => move.id));
      settledRef.current = new Map(
        teams.map((team) => [team.id, clamp(team.position)]),
      );
      return;
    }

    if (moves.length < seenRef.current.size) {
      for (const id of timersRef.current.values()) window.clearTimeout(id);
      for (const id of freezeTimersRef.current.values()) window.clearTimeout(id);
      timersRef.current.clear();
      freezeTimersRef.current.clear();
      queuedRef.current.clear();
      seenRef.current = new Set(moves.map((move) => move.id));
      settledRef.current = new Map(
        teams.map((team) => [team.id, clamp(team.position)]),
      );
      motionsRef.current = {};
      commit();
      return;
    }

    for (const id of [...settledRef.current.keys()]) {
      if (teamIds.has(id)) continue;
      clearTimer(id);
      clearFreezeTimer(id);
      queuedRef.current.delete(id);
      settledRef.current.delete(id);
      clearMotion(id);
    }

    const fresh = moves.filter((move) => !seenRef.current.has(move.id));
    for (const move of fresh) seenRef.current.add(move.id);
    const latest = new Map<string, Move>();
    for (const move of fresh) {
      if (!move.correct || move.delta <= 0) continue;
      const previous = latest.get(move.team_id);
      if (!previous || move.created_at >= previous.created_at) {
        latest.set(move.team_id, move);
      }
    }

    for (const [teamId, move] of latest) {
      clearFreezeTimer(teamId);
      clearTimer(teamId);
      const from = clamp(move.from_position);
      settledRef.current.set(teamId, from);
      if (!enabled || paused) {
        queuedRef.current.set(teamId, move);
        setMotion(teamId, { tile: from, durationMs: 0, sliding: false });
      } else {
        startWalk(move);
      }
    }

    for (const team of teams) {
      const target = clamp(team.position);
      const settled = settledRef.current.get(team.id);
      if (settled === undefined) {
        settledRef.current.set(team.id, target);
        continue;
      }
      if (timersRef.current.has(team.id) || queuedRef.current.has(team.id)) {
        continue;
      }
      if (target === settled) {
        clearFreezeTimer(team.id);
        if (motionsRef.current[team.id]) clearMotion(team.id);
        continue;
      }
      if (!enabled || target === 0) {
        settledRef.current.set(team.id, target);
        clearFreezeTimer(team.id);
        if (motionsRef.current[team.id]) clearMotion(team.id);
        continue;
      }
      setMotion(team.id, { tile: settled, durationMs: 0, sliding: false });
      if (!freezeTimersRef.current.has(team.id)) {
        freezeTimersRef.current.set(
          team.id,
          window.setTimeout(() => {
            freezeTimersRef.current.delete(team.id);
            if (
              timersRef.current.has(team.id) ||
              queuedRef.current.has(team.id)
            ) {
              return;
            }
            settledRef.current.set(team.id, target);
            clearMotion(team.id);
          }, FREEZE_FALLBACK_MS),
        );
      }
    }
  }, [
    clearFreezeTimer,
    clearMotion,
    clearTimer,
    commit,
    config,
    enabled,
    moves,
    paused,
    setMotion,
    startWalk,
    teams,
  ]);

  useEffect(() => {
    if (!enabled || paused) return;
    if (queuedRef.current.size === 0) return;
    const id = window.setTimeout(() => {
      const pending = [...queuedRef.current.values()];
      queuedRef.current.clear();
      for (const move of pending) startWalk(move);
    }, WALK_START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [enabled, paused, startWalk]);

  useEffect(() => {
    const timers = timersRef.current;
    const freezeTimers = freezeTimersRef.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      for (const id of freezeTimers.values()) window.clearTimeout(id);
      timers.clear();
      freezeTimers.clear();
    };
  }, []);

  return motions;
}
