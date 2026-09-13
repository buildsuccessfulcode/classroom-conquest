import * as actions from "@/app/actions";
import { isSupabaseConfigured } from "./config";
import * as demo from "./demo/engine";
import { getBrowserClient } from "./supabase/client";
import type {
  AnswerResult,
  GameState,
  JoinTeamResult,
  PublicQuestion,
  QuestionGroupSummary,
  SeedQuestion,
  Session,
  SlotQuestion,
} from "./types";

export type BackendMode = "supabase" | "demo";

export function backendMode(): BackendMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export async function createSession(input: {
  groupId: string;
  durationMinutes?: number;
}): Promise<{ code: string }> {
  if (isSupabaseConfigured()) return actions.createSession(input);
  return demo.createSession(input);
}

export async function listQuestionGroups(): Promise<QuestionGroupSummary[]> {
  if (isSupabaseConfigured()) return actions.listQuestionGroups();
  return demo.listQuestionGroups();
}

export async function listGroupQuestions(
  groupId: string,
): Promise<PublicQuestion[]> {
  if (isSupabaseConfigured()) return actions.listGroupQuestions(groupId);
  return demo.listGroupQuestions(groupId);
}

export async function listSessions(): Promise<Session[]> {
  if (isSupabaseConfigured()) return actions.listSessions();
  return demo.listSessions();
}

export async function joinTeam(input: {
  sessionCode: string;
  teamName: string;
}): Promise<JoinTeamResult> {
  if (isSupabaseConfigured()) return actions.joinTeam(input);
  return demo.joinTeam(input);
}

export async function fetchGameState(
  sessionCode: string,
): Promise<GameState | null> {
  if (isSupabaseConfigured()) return actions.fetchGameState(sessionCode);
  return demo.fetchGameState(sessionCode);
}

export async function requestQuestion(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
}): Promise<SlotQuestion> {
  if (isSupabaseConfigured()) return actions.requestQuestion(input);
  return demo.requestQuestion(input);
}

export async function submitAnswer(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
  answer: string;
}): Promise<AnswerResult> {
  if (isSupabaseConfigured()) return actions.submitAnswer(input);
  return demo.submitAnswer(input);
}

export async function importQuestions(input: {
  groupName: string;
  subject: string;
  questions: SeedQuestion[];
}): Promise<{
  groupId: string;
  groupName: string;
  inserted: number;
  created: boolean;
}> {
  if (isSupabaseConfigured()) return actions.importQuestions(input);
  return demo.importQuestions(input);
}

export async function deleteQuestionGroup(groupId: string): Promise<void> {
  if (isSupabaseConfigured()) return actions.deleteQuestionGroup(groupId);
  return demo.deleteQuestionGroup(groupId);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  if (isSupabaseConfigured()) return actions.deleteQuestion(questionId);
  return demo.deleteQuestion(questionId);
}

export async function startSession(sessionCode: string): Promise<void> {
  if (isSupabaseConfigured()) return actions.startSession(sessionCode);
  return demo.startSession(sessionCode);
}

export async function resetSession(sessionCode: string): Promise<void> {
  if (isSupabaseConfigured()) return actions.resetSession(sessionCode);
  return demo.resetSession(sessionCode);
}

export async function endSession(sessionCode: string): Promise<void> {
  if (isSupabaseConfigured()) return actions.endSession(sessionCode);
  return demo.endSession(sessionCode);
}

export async function deleteSession(sessionCode: string): Promise<void> {
  if (isSupabaseConfigured()) return actions.deleteSession(sessionCode);
  return demo.deleteSession(sessionCode);
}

export function subscribe(
  sessionId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured()) return demo.subscribe(sessionId, onChange);
  const client = getBrowserClient();
  const channel = client
    .channel(`game-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "answers",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "teams",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "activity_logs",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
