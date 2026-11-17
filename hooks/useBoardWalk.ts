"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildWalkFrames, moveAnimationStart } from "@/lib/game";
import { serverNow } from "@/lib/clock";
import type { BoardConfig, Move, Team } from "@/lib/types";

export interface WalkMotion {
  tile: number;
  durationMs: number;
  sliding: boolean;
}

const FRAME_HOLD_MS = 80;
const REDUCED_MOTION_SCALE = 0.45;
const useMotionEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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
    (move: Move, receivedAt: number) => {
      const boardConfig = configRef.current;
      const teamId = move.team_id;
      if (!boardConfig) return;
      clearTimer(teamId);
      queuedRef.current.delete(teamId);
      const scale = prefersReducedMotion() ? REDUCED_MOTION_SCALE : 1;
      const frames = buildWalkFrames(move, boardConfig).map((frame) => ({
        ...frame,
        durationMs:
          frame.durationMs > 0
            ? Math.round(frame.durationMs * scale)
            : frame.durationMs,
      }));
      if (frames.length === 0) {
        finishWalk(teamId, move);
        return;
      }
      const anchor = moveAnimationStart(move.created_at, receivedAt);
      const offsets: number[] = [];
      let cursor = 0;
      for (const frame of frames) {
        offsets.push(cursor);
        cursor += frame.durationMs > 0 ? frame.durationMs : FRAME_HOLD_MS;
      }
      const totalMs = cursor;

      const apply = (frame: (typeof frames)[number]) => {
        settledRef.current.set(teamId, frame.tile);
        setMotion(teamId, {
          tile: frame.tile,
          durationMs: frame.durationMs,
          sliding: frame.sliding,
        });
      };

      const tick = (index: number) => {
        if (index >= frames.length) {
          finishWalk(teamId, move);
          return;
        }
        const now = serverNow();
        const due = anchor + offsets[index];
        if (now < due) {
          timersRef.current.set(
            teamId,
            window.setTimeout(() => tick(index), Math.min(250, due - now)),
          );
          return;
        }
        if (index === 0) startRef.current?.(teamId);
        apply(frames[index]);
        let next = index + 1;
        while (next < frames.length && anchor + offsets[next] <= now) {
          next += 1;
        }
        if (next >= frames.length) {
          const finishAt = anchor + totalMs;
          timersRef.current.set(
            teamId,
            window.setTimeout(
              () => finishWalk(teamId, move),
              Math.max(0, finishAt - serverNow()),
            ),
          );
          return;
        }
        tick(next);
      };

      tick(0);
    },
    [clearTimer, finishWalk, setMotion],
  );

  useMotionEffect(() => {
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
      timersRef.current.clear();
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

    const receivedAt = serverNow();
    for (const [teamId, move] of latest) {
      clearTimer(teamId);
      const from = clamp(move.from_position);
      settledRef.current.set(teamId, from);
      setMotion(teamId, { tile: from, durationMs: 0, sliding: false });
      if (!enabled || paused) {
        queuedRef.current.set(teamId, move);
      } else {
        startWalk(move, receivedAt);
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
        if (motionsRef.current[team.id]) clearMotion(team.id);
        continue;
      }
      if (!enabled || target === 0) {
        settledRef.current.set(team.id, target);
        if (motionsRef.current[team.id]) clearMotion(team.id);
        continue;
      }
      setMotion(team.id, { tile: settled, durationMs: 0, sliding: false });
    }
  }, [
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
      const receivedAt = serverNow();
      for (const move of pending) startWalk(move, receivedAt);
    }, 0);
    return () => window.clearTimeout(id);
  }, [enabled, paused, startWalk]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  return motions;
}
