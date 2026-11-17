import * as actions from "@/app/actions";
import { maskApiKey } from "./ai/gemini";
import { isSupabaseConfigured } from "./config";
import * as demo from "./demo/engine";
import {
  clearDemoAiKey,
  readDemoAiSettings,
  writeDemoAiSettings,
} from "./demo/settings";
import type {
  ActivityLog,
  AiSettings,
  Answer,
  AnswerResult,
  BoardPreset,
  GameMode,
  GameState,
  GeneratedQuestionBank,
  GenerateQuestionsInput,
  GeminiModel,
  JoinTeamResult,
  Question,
  QuestionGroupSummary,
  SeedQuestion,
  Session,
  SlotQuestion,
  Team,
} from "./types";

export type BackendMode = "supabase" | "demo";

export type RealtimeEvent =
  | { type: "answer.created"; answer: Answer }
  | { type: "team.joined"; team: Team }
  | { type: "team.moved"; team: Team }
  | { type: "session.updated"; session: Session }
  | { type: "log.created"; log: ActivityLog }
  | { type: "refresh" };

export function backendMode(): BackendMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export async function createSession(input: {
  groupId: string;
  durationMinutes?: number;
  mode?: GameMode;
  boardPreset?: BoardPreset;
  boardGoal?: number;
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
): Promise<Question[]> {
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
  avatar?: string | null;
}): Promise<JoinTeamResult> {
  if (isSupabaseConfigured()) return actions.joinTeam(input);
  return demo.joinTeam(input);
}

export async function getSessionPreview(sessionCode: string): Promise<{
  mode: GameMode;
  status: string;
} | null> {
  if (isSupabaseConfigured()) return actions.getSessionPreview(sessionCode);
  return demo.getSessionPreview(sessionCode);
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

export async function submitMove(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
  answer: string;
}): Promise<AnswerResult> {
  if (isSupabaseConfigured()) return actions.submitMove(input);
  return demo.submitMove(input);
}

export async function reportFocusEvent(input: {
  sessionCode: string;
  teamId: string;
  awayMs: number;
  reason?: "leave" | "return" | "exit";
}): Promise<void> {
  if (isSupabaseConfigured()) return actions.reportFocusEvent(input);
  return demo.reportFocusEvent(input);
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

export async function getAiSettings(): Promise<AiSettings> {
  if (isSupabaseConfigured()) return actions.getAiSettings();
  const { apiKey, model } = readDemoAiSettings();
  return {
    hasKey: Boolean(apiKey),
    maskedKey: apiKey ? maskApiKey(apiKey) : null,
    model,
  };
}

export async function saveAiSettings(input: {
  apiKey?: string;
  model?: string;
}): Promise<AiSettings> {
  if (isSupabaseConfigured()) return actions.saveAiSettings(input);
  writeDemoAiSettings(input);
  return getAiSettings();
}

export async function clearAiKey(): Promise<AiSettings> {
  if (isSupabaseConfigured()) return actions.clearAiKey();
  clearDemoAiKey();
  return getAiSettings();
}

export async function listGeminiModels(
  apiKey?: string,
): Promise<GeminiModel[]> {
  if (isSupabaseConfigured()) return actions.listGeminiModels(apiKey);
  const key = apiKey?.trim() || readDemoAiSettings().apiKey;
  return actions.listGeminiModels(key);
}

export async function generateQuestions(
  input: GenerateQuestionsInput,
): Promise<GeneratedQuestionBank> {
  if (isSupabaseConfigured()) return actions.generateQuestions(input);
  const { apiKey, model } = readDemoAiSettings();
  if (!apiKey) {
    throw new Error("API key Gemini belum diatur. Buka tab Pengaturan.");
  }
  return actions.generateQuestions({ ...input, apiKey, model });
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

export async function subscribe(
  sessionId: string,
  onEvent: (event: RealtimeEvent) => void,
): Promise<() => void> {
  if (!isSupabaseConfigured()) {
    return demo.subscribe(sessionId, () => onEvent({ type: "refresh" }));
  }
  const { getBrowserClient } = await import("./supabase/client");
  const client = getBrowserClient();
  const channel = client
    .channel(`game-${sessionId}`)
    .on("broadcast", { event: "answer.created" }, ({ payload }) => {
      const answer = (payload as { answer?: Answer } | null)?.answer;
      onEvent(answer ? { type: "answer.created", answer } : { type: "refresh" });
    })
    .on("broadcast", { event: "team.joined" }, ({ payload }) => {
      const team = (payload as { team?: Team } | null)?.team;
      onEvent(team ? { type: "team.joined", team } : { type: "refresh" });
    })
    .on("broadcast", { event: "team.moved" }, ({ payload }) => {
      const team = (payload as { team?: Team } | null)?.team;
      onEvent(team ? { type: "team.moved", team } : { type: "refresh" });
    })
    .on("broadcast", { event: "session.updated" }, ({ payload }) => {
      const session = (payload as { session?: Session } | null)?.session;
      onEvent(
        session ? { type: "session.updated", session } : { type: "refresh" },
      );
    })
    .on("broadcast", { event: "log.created" }, ({ payload }) => {
      const log = (payload as { log?: ActivityLog } | null)?.log;
      onEvent(log ? { type: "log.created", log } : { type: "refresh" });
    })
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
