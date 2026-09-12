"use client";

import { useCallback, useMemo } from "react";
import { useStoredValue, writeStoredValue } from "./useLocalStorage";
import type { Team } from "@/lib/types";

const STORAGE_KEY = "classroom-conquest:identity:v1";

export interface TeamIdentity {
  sessionCode: string;
  teamId: string;
  teamName: string;
  colorCode: string;
}

export function useTeamIdentity() {
  const raw = useStoredValue(STORAGE_KEY);
  const identity = useMemo<TeamIdentity | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TeamIdentity;
    } catch {
      return null;
    }
  }, [raw]);

  const save = useCallback((team: Team, sessionCode: string) => {
    const next: TeamIdentity = {
      sessionCode: sessionCode.trim().toUpperCase(),
      teamId: team.id,
      teamName: team.team_name,
      colorCode: team.color_code,
    };
    writeStoredValue(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clear = useCallback(() => {
    writeStoredValue(STORAGE_KEY, null);
  }, []);

  return { identity, ready: true, save, clear };
}
