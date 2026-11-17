"use server";

import { cookies } from "next/headers";
import {
  generateQuestions as geminiGenerate,
  listGeminiModels as geminiListModels,
  maskApiKey,
  sanitizeApiKey,
} from "@/lib/ai/gemini";
import { GEMINI_DEFAULT_MODEL } from "@/lib/ai/prompt";
import { pickTeamColor } from "@/lib/colors";
import { isSupabaseConfigured } from "@/lib/config";
import {
  TEACHER_COOKIE,
  TEACHER_SESSION_MAX_AGE,
  requireTeacher,
  teacherSessionToken,
  verifyTeacherPassword,
} from "@/lib/teacher-auth";
import {
  BOARD_TILE_OPTIONS,
  MAX_ATTEMPTS_PER_SLOT,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  buildBoardConfig,
  goalFromQuestionCount,
  minQuestionsForBoard,
  pointsFor,
  shuffle,
} from "@/lib/game";
import { isAvatarId, pickAvatar } from "@/lib/avatars";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ActivityLog,
  AiSettings,
  Answer,
  AnswerResult,
  BoardConfig,
  BoardPreset,
  FinishRule,
  GameMode,
  GameState,
  GeneratedQuestionBank,
  GenerateQuestionsInput,
  GeminiModel,
  JoinTeamResult,
  LogKind,
  Move,
  PublicQuestion,
  Question,
  QuestionGroup,
  QuestionGroupSummary,
  QuestionType,
  SeedQuestion,
  Session,
  SessionSlot,
  SlotInfo,
  SlotQuestion,
  Team,
} from "@/lib/types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const SESSION_COLUMNS =
  "id, session_code, group_id, subject_name, is_active, status, game_mode, board_config, duration_minutes, started_at, ended_at, created_at";
const TEAM_COLUMNS =
  "id, session_id, team_name, color_code, avatar, position, finished_at, score, joined_at, created_at";
const SLOT_COLUMNS = "id, session_id, slot_number, question_id, created_at";
const ANSWER_COLUMNS =
  "id, session_id, team_id, slot_number, question_id, points, answered_at";
const MOVE_COLUMNS =
  "id, session_id, team_id, slot_number, question_id, correct, points, delta, from_position, to_position, jump, created_at";
const LOG_COLUMNS = "id, session_id, team_id, message, kind, created_at";
const GROUP_COLUMNS = "id, name, subject, created_at";

const rateBuckets = new Map<string, number[]>();

function enforceRateLimit(key: string): void {
  const now = Date.now();
  const recent = (rateBuckets.get(key) ?? []).filter(
    (stamp) => now - stamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("Terlalu banyak permintaan. Tunggu sebentar.");
  }
  recent.push(now);
  rateBuckets.set(key, recent);
}

function sb() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase belum dikonfigurasi");
  }
  return createServiceClient();
}

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function normalizeSubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) throw new Error("Mata pelajaran wajib diisi");
  return trimmed;
}

function normalizeGroupName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama group wajib diisi");
  return trimmed;
}

function clampDuration(minutes: number): number {
  if (!Number.isFinite(minutes)) return 30;
  return Math.min(120, Math.max(5, Math.round(minutes)));
}

function toPublicQuestion(question: Question): PublicQuestion {
  return {
    id: question.id,
    group_id: question.group_id,
    subject: question.subject,
    type: question.type,
    difficulty: question.difficulty,
    question_text: question.question_text,
    metadata: question.metadata,
    points: question.points,
  };
}

function withShuffledChoices(question: PublicQuestion): PublicQuestion {
  const metadata = question.metadata;
  if (!metadata) return question;
  const next = { ...metadata };
  if (metadata.options && metadata.options.length > 1) {
    next.options = shuffle(metadata.options);
  }
  if (metadata.words && metadata.words.length > 1) {
    next.words = shuffle(metadata.words);
  }
  return { ...question, metadata: next };
}

function isSessionTimeUp(session: Session): boolean {
  if (session.status === "ENDED") return true;
  if (!session.started_at) return false;
  const endsAt =
    new Date(session.started_at).getTime() + session.duration_minutes * 60_000;
  return Date.now() > endsAt;
}

async function autoEndIfExpired(session: Session): Promise<Session> {
  if (session.status !== "PLAYING") return session;
  if (!isSessionTimeUp(session)) return session;
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("sessions")
    .update({ status: "ENDED", is_active: false, ended_at: now })
    .eq("id", session.id)
    .eq("status", "PLAYING")
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return (await getSessionByCode(session.session_code)) ?? session;
  }
  await addLog(
    session.id,
    null,
    "Waktu habis. Sesi berakhir otomatis.",
    "SYSTEM",
  );
  return data as Session;
}

function isSessionTimeUpError(message: string): boolean {
  return /waktu sesi sudah habis/i.test(message);
}

async function expireSessionByCode(sessionCode: string): Promise<void> {
  const session = await getSessionByCode(sessionCode);
  if (!session || session.status !== "PLAYING") return;
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("sessions")
    .update({ status: "ENDED", is_active: false, ended_at: now })
    .eq("id", session.id)
    .eq("status", "PLAYING")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  await addLog(
    session.id,
    null,
    "Waktu habis. Sesi berakhir otomatis.",
    "SYSTEM",
  );
}

async function getSessionByCode(code: string): Promise<Session | null> {
  const { data, error } = await sb()
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("session_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Session | null) ?? null;
}

async function addLog(
  sessionId: string,
  teamId: string | null,
  message: string,
  kind: LogKind,
): Promise<void> {
  await sb()
    .from("activity_logs")
    .insert({ session_id: sessionId, team_id: teamId, message, kind });
}

async function ensureSlots(session: Session): Promise<void> {
  const client = sb();
  const { count, error } = await client
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;
  const { data, error: questionError } = await client
    .from("questions")
    .select("id")
    .eq("group_id", session.group_id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (questionError) throw new Error(questionError.message);
  const questions = (data as { id: string }[] | null) ?? [];
  if (questions.length === 0) {
    throw new Error("Group soal kosong. Impor soal terlebih dahulu.");
  }
  const rows = questions.map((question, index) => ({
    session_id: session.id,
    slot_number: index + 1,
    question_id: question.id,
  }));
  const { error: insertError } = await client
    .from("session_questions")
    .insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export async function listQuestionGroups(): Promise<QuestionGroupSummary[]> {
  await requireTeacher();
  const { data, error } = await sb()
    .from("question_groups")
    .select("id, name, subject, created_at, questions(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  type Row = QuestionGroup & { questions: { count: number }[] | null };
  return ((data as Row[] | null) ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    subject: group.subject,
    created_at: group.created_at,
    question_count: group.questions?.[0]?.count ?? 0,
  }));
}

export async function listGroupQuestions(
  groupId: string,
): Promise<Question[]> {
  await requireTeacher();
  const { data, error } = await sb()
    .from("questions")
    .select(
      "id, group_id, subject, type, difficulty, question_text, metadata, correct_answer, points",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Question[] | null) ?? [];
}

export async function createSession(input: {
  groupId: string;
  durationMinutes?: number;
  mode?: GameMode;
  boardPreset?: BoardPreset;
  boardGoal?: number;
  finishRule?: FinishRule;
}): Promise<{ code: string }> {
  await requireTeacher();
  const client = sb();
  const groupId = input.groupId?.trim();
  if (!groupId) throw new Error("Group soal wajib dipilih");
  const { data: groupData, error: groupError } = await client
    .from("question_groups")
    .select(GROUP_COLUMNS)
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) throw new Error(groupError.message);
  const group = groupData as QuestionGroup | null;
  if (!group) throw new Error("Group soal tidak ditemukan");
  const duration = clampDuration(input.durationMinutes ?? 30);
  const mode: GameMode = input.mode === "SNAKES" ? "SNAKES" : "CLASSIC";
  let boardConfig: BoardConfig | null = null;
  if (mode === "SNAKES") {
    const { count: questionCount, error: countError } = await client
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);
    if (countError) throw new Error(countError.message);
    const count = questionCount ?? 0;
    if (count < minQuestionsForBoard()) {
      throw new Error(
        `Mode Ular Tangga butuh minimal ${minQuestionsForBoard()} soal (50% dari papan minimum 10 petak). Tambah soal atau gunakan mode Klasik.`,
      );
    }
    const preset: BoardPreset =
      input.boardPreset === "MUDAH" || input.boardPreset === "SULIT"
        ? input.boardPreset
        : "NORMAL";
    const requested = Number(input.boardGoal);
    const allowedGoal = (BOARD_TILE_OPTIONS as readonly number[]).includes(
      requested,
    );
    const safeGoal = goalFromQuestionCount(count);
    const goal = allowedGoal ? Math.min(requested, safeGoal) : safeGoal;
    const finishRule: FinishRule =
      input.finishRule === "EXACT" ? "EXACT" : "OVERSHOOT";
    boardConfig = buildBoardConfig({
      goal,
      preset,
      finishRule,
      seed: Math.floor(Math.random() * 1_000_000_000),
    });
  }
  let created: Session | null = null;
  for (let attempt = 0; attempt < 6 && !created; attempt += 1) {
    const code = randomCode();
    const { data, error } = await client
      .from("sessions")
      .insert({
        session_code: code,
        group_id: group.id,
        subject_name: group.subject,
        duration_minutes: duration,
        status: "LOBBY",
        is_active: true,
        game_mode: mode,
        board_config: boardConfig,
      })
      .select(SESSION_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
    created = data as Session;
  }
  if (!created) throw new Error("Gagal membuat kode sesi unik");
  await ensureSlots(created);
  await addLog(
    created.id,
    null,
    `Sesi ${created.session_code} dibuat untuk ${group.subject}`,
    "SYSTEM",
  );
  return { code: created.session_code };
}

export async function listSessions(): Promise<Session[]> {
  await requireTeacher();
  const { data, error } = await sb()
    .from("sessions")
    .select(SESSION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data as Session[] | null) ?? [];
}

export async function joinTeam(input: {
  sessionCode: string;
  teamName: string;
  avatar?: string | null;
}): Promise<JoinTeamResult> {
  const client = sb();
  const session = await getSessionByCode(input.sessionCode);
  if (!session) return { ok: false, error: "Sesi tidak ditemukan" };
  if (session.status === "ENDED") {
    return { ok: false, error: "Sesi sudah berakhir" };
  }
  if (session.status !== "LOBBY") {
    return { ok: false, error: "Sesi sudah dimulai" };
  }
  const name = input.teamName.trim();
  if (!name) return { ok: false, error: "Nama tim wajib diisi" };
  const avatar = isAvatarId(input.avatar) ? input.avatar : null;
  const { data: existing } = await client
    .from("teams")
    .select(TEAM_COLUMNS)
    .eq("session_id", session.id)
    .ilike("team_name", name)
    .maybeSingle();
  if (existing) return { ok: true, team: existing as Team };
  const { data: teams } = await client
    .from("teams")
    .select("color_code, avatar")
    .eq("session_id", session.id);
  const used = (teams as { color_code: string; avatar: string | null }[] | null) ?? [];
  const usedAvatars = used
    .map((team) => team.avatar)
    .filter((value): value is string => Boolean(value));
  const chosenAvatar =
    session.game_mode === "SNAKES"
      ? avatar && !usedAvatars.includes(avatar)
        ? avatar
        : pickAvatar(usedAvatars)
      : null;
  const { data, error } = await client
    .from("teams")
    .insert({
      session_id: session.id,
      team_name: name,
      color_code: pickTeamColor(used.map((team) => team.color_code)),
      avatar: chosenAvatar,
      score: 0,
      position: 0,
    })
    .select(TEAM_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  const team = data as Team;
  await addLog(session.id, team.id, `Tim ${team.team_name} bergabung`, "JOIN");
  return { ok: true, team };
}

export async function fetchGameState(
  sessionCode: string,
): Promise<GameState | null> {
  const client = sb();
  const session = await getSessionByCode(sessionCode);
  if (!session) return null;
  const activeSession = await autoEndIfExpired(session);
  const [teamsRes, slotsRes, answersRes, logsRes] = await Promise.all([
    client
      .from("teams")
      .select(TEAM_COLUMNS)
      .eq("session_id", activeSession.id)
      .order("joined_at", { ascending: true }),
    client
      .from("session_questions")
      .select(SLOT_COLUMNS)
      .eq("session_id", activeSession.id)
      .order("slot_number", { ascending: true }),
    client
      .from("answers")
      .select(ANSWER_COLUMNS)
      .eq("session_id", activeSession.id)
      .order("answered_at", { ascending: true }),
    client
      .from("activity_logs")
      .select(LOG_COLUMNS)
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const logs = ((logsRes.data as ActivityLog[] | null) ?? []).reverse();
  let moves: Move[] = [];
  let slotInfo: SlotInfo[] = [];
  if (activeSession.game_mode === "SNAKES") {
    const [movesRes, slotInfoRes] = await Promise.all([
      client
        .from("moves")
        .select(MOVE_COLUMNS)
        .eq("session_id", activeSession.id)
        .order("created_at", { ascending: true }),
      client
        .from("session_questions")
        .select("slot_number, question_id, questions(type, difficulty, points)")
        .eq("session_id", activeSession.id)
        .order("slot_number", { ascending: true }),
    ]);
    moves = (movesRes.data as Move[] | null) ?? [];
    type SlotInfoRow = {
      slot_number: number;
      question_id: string;
      questions:
        | { type: QuestionType; difficulty: "EASY" | "MEDIUM" | "HARD"; points: number }
        | { type: QuestionType; difficulty: "EASY" | "MEDIUM" | "HARD"; points: number }[]
        | null;
    };
    slotInfo = ((slotInfoRes.data as SlotInfoRow[] | null) ?? [])
      .map((row) => {
        const question = Array.isArray(row.questions)
          ? row.questions[0]
          : row.questions;
        if (!question) return null;
        return {
          slot_number: row.slot_number,
          question_id: row.question_id,
          type: question.type,
          difficulty: question.difficulty,
          points: question.points,
        };
      })
      .filter((row): row is SlotInfo => row !== null);
  }
  return {
    session: activeSession,
    teams: (teamsRes.data as Team[] | null) ?? [],
    slots: (slotsRes.data as SessionSlot[] | null) ?? [],
    answers: (answersRes.data as Answer[] | null) ?? [],
    moves,
    slotInfo,
    logs,
    serverTime: new Date().toISOString(),
  };
}

export async function requestQuestion(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
}): Promise<SlotQuestion> {
  enforceRateLimit(`${input.sessionCode}:${input.teamId}`);
  const { data, error } = await sb().rpc("request_question", {
    p_session_code: input.sessionCode,
    p_team_id: input.teamId,
    p_slot_number: input.slotNumber,
  });
  if (error) {
    if (isSessionTimeUpError(error.message)) {
      await expireSessionByCode(input.sessionCode);
      throw new Error("Waktu sesi sudah habis. Sesi berakhir.");
    }
    throw new Error(error.message);
  }
  const row = data as {
    question: Question;
    solved: boolean;
    used?: boolean;
    wrong_attempts: number;
  } | null;
  if (!row || !row.question) throw new Error("Soal tidak ditemukan");
  const wrongAttempts = row.wrong_attempts ?? 0;
  const used = Boolean(row.used);
  const locked = wrongAttempts >= MAX_ATTEMPTS_PER_SLOT || used;
  return {
    slotNumber: input.slotNumber,
    question: withShuffledChoices(toPublicQuestion(row.question)),
    solved: row.solved,
    used,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_SLOT - wrongAttempts),
    locked,
    correctAnswer:
      row.solved || (locked && !used)
        ? row.question.correct_answer
        : undefined,
  };
}

export async function submitAnswer(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
  answer: string;
}): Promise<AnswerResult> {
  enforceRateLimit(`${input.sessionCode}:${input.teamId}`);
  const { data, error } = await sb().rpc("submit_answer", {
    p_session_code: input.sessionCode,
    p_team_id: input.teamId,
    p_slot_number: input.slotNumber,
    p_answer: input.answer,
  });
  if (error) {
    if (isSessionTimeUpError(error.message)) {
      await expireSessionByCode(input.sessionCode);
      throw new Error("Waktu sesi sudah habis. Sesi berakhir.");
    }
    throw new Error(error.message);
  }
  const row = data as AnswerResult | null;
  if (!row) throw new Error("Gagal memproses jawaban");
  return row;
}

export async function submitMove(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
  answer: string;
}): Promise<AnswerResult> {
  enforceRateLimit(`${input.sessionCode}:${input.teamId}`);
  const { data, error } = await sb().rpc("submit_move", {
    p_session_code: input.sessionCode,
    p_team_id: input.teamId,
    p_slot_number: input.slotNumber,
    p_answer: input.answer,
  });
  if (error) {
    if (isSessionTimeUpError(error.message)) {
      await expireSessionByCode(input.sessionCode);
      throw new Error("Waktu sesi sudah habis. Sesi berakhir.");
    }
    throw new Error(error.message);
  }
  const row = data as AnswerResult | null;
  if (!row) throw new Error("Gagal memproses langkah");
  if (!row.correct) return row;
  const { data: moveRow } = await sb()
    .from("moves")
    .select("created_at")
    .eq("team_id", input.teamId)
    .eq("slot_number", input.slotNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const createdAt = (moveRow as { created_at: string } | null)?.created_at;
  return createdAt ? { ...row, createdAt } : row;
}

export async function getSessionPreview(sessionCode: string): Promise<{
  mode: GameMode;
  status: string;
} | null> {
  const code = sessionCode.trim().toUpperCase();
  if (!code) return null;
  const { data, error } = await sb()
    .from("sessions")
    .select("game_mode, status")
    .eq("session_code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { game_mode: GameMode; status: string } | null;
  if (!row) return null;
  return { mode: row.game_mode, status: row.status };
}

export async function reportFocusEvent(input: {
  sessionCode: string;
  teamId: string;
  awayMs: number;
  reason?: "leave" | "return" | "exit";
}): Promise<void> {
  const client = sb();
  const session = await getSessionByCode(input.sessionCode);
  if (!session) return;
  if (session.status !== "PLAYING") return;
  if (isSessionTimeUp(session)) return;
  const { data: teamData } = await client
    .from("teams")
    .select(TEAM_COLUMNS)
    .eq("id", input.teamId)
    .eq("session_id", session.id)
    .maybeSingle();
  const team = teamData as Team | null;
  if (!team) return;
  enforceRateLimit(`${session.id}:${team.id}:focus`);
  const awaySeconds = Math.max(1, Math.round(input.awayMs / 1000));
  let message: string;
  if (input.reason === "leave") {
    message = `[PERINGATAN] Tim ${team.team_name} meninggalkan tab permainan`;
  } else if (input.reason === "return") {
    message = `[PERINGATAN] Tim ${team.team_name} kembali setelah meninggalkan tab selama ${awaySeconds} detik`;
  } else {
    message = `[PERINGATAN] Tim ${team.team_name} keluar dari tab permainan`;
  }
  await addLog(session.id, team.id, message, "ERROR");
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
  await requireTeacher();
  const client = sb();
  const groupName = normalizeGroupName(input.groupName);
  const subject = normalizeSubject(input.subject);
  const list = Array.isArray(input.questions) ? input.questions : [];
  if (list.length === 0) throw new Error("Tidak ada soal untuk diimpor");
  const { data: existing, error: findError } = await client
    .from("question_groups")
    .select(GROUP_COLUMNS)
    .ilike("name", groupName)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  let group = existing as QuestionGroup | null;
  let created = false;
  if (!group) {
    const { data, error } = await client
      .from("question_groups")
      .insert({ name: groupName, subject })
      .select(GROUP_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    group = data as QuestionGroup;
    created = true;
  }
  const rows = list.map((q) => ({
    group_id: group!.id,
    subject: group!.subject,
    type: q.type,
    difficulty: q.difficulty,
    question_text: q.question_text,
    metadata: q.metadata ?? null,
    correct_answer: q.correct_answer,
    points: q.points ?? pointsFor(q.difficulty),
  }));
  const { error } = await client.from("questions").insert(rows);
  if (error) throw new Error(error.message);
  return {
    groupId: group.id,
    groupName: group.name,
    inserted: rows.length,
    created,
  };
}

export async function deleteQuestionGroup(groupId: string): Promise<void> {
  await requireTeacher();
  const client = sb();
  const id = groupId?.trim();
  if (!id) throw new Error("Group soal tidak valid");
  const { count, error } = await client
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) {
    throw new Error("Group sedang dipakai sesi. Hapus sesinya dulu.");
  }
  const { error: deleteError } = await client
    .from("question_groups")
    .delete()
    .eq("id", id);
  if (deleteError) throw new Error(deleteError.message);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await requireTeacher();
  const client = sb();
  const id = questionId?.trim();
  if (!id) throw new Error("Soal tidak valid");
  const { count, error } = await client
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("question_id", id);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) {
    throw new Error("Soal sedang dipakai sesi. Hapus sesinya dulu.");
  }
  const { error: deleteError } = await client
    .from("questions")
    .delete()
    .eq("id", id);
  if (deleteError) throw new Error(deleteError.message);
}

export async function startSession(sessionCode: string): Promise<void> {
  await requireTeacher();
  const session = await getSessionByCode(sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  const now = new Date().toISOString();
  const { error } = await sb()
    .from("sessions")
    .update({
      status: "PLAYING",
      is_active: true,
      started_at: now,
      ended_at: null,
    })
    .eq("id", session.id);
  if (error) throw new Error(error.message);
  await addLog(session.id, null, "Sesi dimulai", "SYSTEM");
}

export async function resetSession(sessionCode: string): Promise<void> {
  await requireTeacher();
  const client = sb();
  const session = await getSessionByCode(sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  await client.from("answers").delete().eq("session_id", session.id);
  await client.from("moves").delete().eq("session_id", session.id);
  await client.from("activity_logs").delete().eq("session_id", session.id);
  await client.from("teams").delete().eq("session_id", session.id);
  await client
    .from("sessions")
    .update({
      status: "LOBBY",
      is_active: true,
      started_at: null,
      ended_at: null,
    })
    .eq("id", session.id);
  await addLog(
    session.id,
    null,
    "Sesi direset. Peserta dan skor dikosongkan.",
    "SYSTEM",
  );
}

export async function endSession(sessionCode: string): Promise<void> {
  await requireTeacher();
  const session = await getSessionByCode(sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  const now = new Date().toISOString();
  const { error } = await sb()
    .from("sessions")
    .update({ status: "ENDED", is_active: false, ended_at: now })
    .eq("id", session.id);
  if (error) throw new Error(error.message);
  await addLog(session.id, null, "Sesi diakhiri", "SYSTEM");
}

export async function deleteSession(sessionCode: string): Promise<void> {
  await requireTeacher();
  const session = await getSessionByCode(sessionCode);
  if (!session) return;
  const { error } = await sb().from("sessions").delete().eq("id", session.id);
  if (error) throw new Error(error.message);
}

export async function loginTeacher(
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!verifyTeacherPassword(password)) {
    return { ok: false, error: "Password salah" };
  }
  const store = await cookies();
  store.set(TEACHER_COOKIE, teacherSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TEACHER_SESSION_MAX_AGE,
  });
  return { ok: true };
}

export async function logoutTeacher(): Promise<void> {
  const store = await cookies();
  store.delete(TEACHER_COOKIE);
}

const SETTING_GEMINI_KEY = "gemini_api_key";
const SETTING_GEMINI_MODEL = "gemini_model";
const GENERATE_TYPES: QuestionType[] = [
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "REARRANGE_WORDS",
];
const MAX_GENERATE_COUNT = 50;

async function readSetting(key: string): Promise<string | null> {
  const { data, error } = await sb()
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { value: string } | null)?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  const { error } = await sb()
    .from("app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}

async function deleteSetting(key: string): Promise<void> {
  const { error } = await sb().from("app_settings").delete().eq("key", key);
  if (error) throw new Error(error.message);
}

async function storedGeminiKey(): Promise<string | null> {
  const value = await readSetting(SETTING_GEMINI_KEY);
  const cleaned = value ? sanitizeApiKey(value) : "";
  return cleaned ? cleaned : null;
}

export async function getAiSettings(): Promise<AiSettings> {
  await requireTeacher();
  const [key, model] = await Promise.all([
    storedGeminiKey(),
    readSetting(SETTING_GEMINI_MODEL),
  ]);
  return {
    hasKey: Boolean(key),
    maskedKey: key ? maskApiKey(key) : null,
    model: model?.trim() || GEMINI_DEFAULT_MODEL,
  };
}

export async function saveAiSettings(input: {
  apiKey?: string;
  model?: string;
}): Promise<AiSettings> {
  await requireTeacher();
  const apiKey = input.apiKey ? sanitizeApiKey(input.apiKey) : "";
  if (apiKey) {
    if (apiKey.length < 10) throw new Error("API key Gemini tidak valid");
    await writeSetting(SETTING_GEMINI_KEY, apiKey);
  }
  const model = input.model?.trim();
  if (model) await writeSetting(SETTING_GEMINI_MODEL, model);
  return getAiSettings();
}

export async function clearAiKey(): Promise<AiSettings> {
  await requireTeacher();
  await deleteSetting(SETTING_GEMINI_KEY);
  return getAiSettings();
}

export async function listGeminiModels(apiKey?: string): Promise<GeminiModel[]> {
  await requireTeacher();
  enforceRateLimit("ai-models");
  const key = (apiKey ? sanitizeApiKey(apiKey) : "") || (await storedGeminiKey());
  if (!key) throw new Error("API key Gemini belum diatur");
  return geminiListModels(key);
}

function normalizeGenerateInput(
  input: GenerateQuestionsInput,
): GenerateQuestionsInput {
  const subject = input.subject?.trim();
  if (!subject) throw new Error("Mata pelajaran wajib diisi");
  const topic = (input.topic ?? "").trim();
  const count = Math.round(Number(input.count));
  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Jumlah soal minimal 1");
  }
  if (count > MAX_GENERATE_COUNT) {
    throw new Error(`Jumlah soal maksimal ${MAX_GENERATE_COUNT}`);
  }
  const selected = (Array.isArray(input.types) ? input.types : []).filter(
    (type): type is QuestionType => GENERATE_TYPES.includes(type),
  );
  const types = selected.length > 0 ? selected : GENERATE_TYPES;
  const distribution = input.distribution ?? { EASY: 0, MEDIUM: 0, HARD: 0 };
  const clamp = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  return {
    subject,
    topic,
    grade: (input.grade ?? "").trim(),
    language: input.language === "en" ? "en" : "id",
    count,
    distribution: {
      EASY: clamp(distribution.EASY),
      MEDIUM: clamp(distribution.MEDIUM),
      HARD: clamp(distribution.HARD),
    },
    types,
  };
}

export async function generateQuestions(
  input: GenerateQuestionsInput & { apiKey?: string; model?: string },
): Promise<GeneratedQuestionBank> {
  await requireTeacher();
  enforceRateLimit("ai-generate");
  const normalized = normalizeGenerateInput(input);
  const key =
    (input.apiKey ? sanitizeApiKey(input.apiKey) : "") ||
    (await storedGeminiKey());
  if (!key) {
    throw new Error("API key Gemini belum diatur. Buka tab Pengaturan.");
  }
  const model =
    input.model?.trim() ||
    (await readSetting(SETTING_GEMINI_MODEL))?.trim() ||
    GEMINI_DEFAULT_MODEL;
  return geminiGenerate(key, model, normalized);
}
