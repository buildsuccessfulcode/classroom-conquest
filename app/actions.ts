"use server";

import { cookies } from "next/headers";
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
  MAX_ATTEMPTS_PER_SLOT,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  countWrongAttempts,
  isAnswerCorrect,
  isRapidFire,
  pointsFor,
  shuffle,
} from "@/lib/game";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ActivityLog,
  Answer,
  AnswerResult,
  GameState,
  JoinTeamResult,
  LogKind,
  PublicQuestion,
  Question,
  QuestionGroup,
  QuestionGroupSummary,
  SeedQuestion,
  Session,
  SessionSlot,
  SlotQuestion,
  Team,
} from "@/lib/types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

async function countWrongAttemptsForSlot(
  client: ReturnType<typeof sb>,
  sessionId: string,
  teamId: string,
  slotNumber: number,
): Promise<number> {
  const { data, error } = await client
    .from("activity_logs")
    .select("message")
    .eq("session_id", sessionId)
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return countWrongAttempts(
    (data as { message: string }[] | null) ?? [],
    slotNumber,
  );
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
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return session;
  await addLog(
    session.id,
    null,
    "Waktu habis. Sesi berakhir otomatis.",
    "SYSTEM",
  );
  return data as Session;
}

async function getSessionByCode(code: string): Promise<Session | null> {
  const { data, error } = await sb()
    .from("sessions")
    .select("*")
    .eq("session_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Session | null) ?? null;
}

async function getTeam(
  client: ReturnType<typeof sb>,
  sessionId: string,
  teamId: string,
): Promise<Team | null> {
  const { data, error } = await client
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Team | null) ?? null;
}

async function getSlot(
  client: ReturnType<typeof sb>,
  sessionId: string,
  slotNumber: number,
): Promise<SessionSlot | null> {
  const { data, error } = await client
    .from("session_questions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("slot_number", slotNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionSlot | null) ?? null;
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
): Promise<PublicQuestion[]> {
  await requireTeacher();
  const { data, error } = await sb()
    .from("questions")
    .select(
      "id, group_id, subject, type, difficulty, question_text, metadata, points",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as PublicQuestion[] | null) ?? [];
}

export async function createSession(input: {
  groupId: string;
  durationMinutes?: number;
}): Promise<{ code: string }> {
  await requireTeacher();
  const client = sb();
  const groupId = input.groupId?.trim();
  if (!groupId) throw new Error("Group soal wajib dipilih");
  const { data: groupData, error: groupError } = await client
    .from("question_groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) throw new Error(groupError.message);
  const group = groupData as QuestionGroup | null;
  if (!group) throw new Error("Group soal tidak ditemukan");
  const duration = clampDuration(input.durationMinutes ?? 30);
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
      })
      .select("*")
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
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data as Session[] | null) ?? [];
}

export async function joinTeam(input: {
  sessionCode: string;
  teamName: string;
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
  const { data: existing } = await client
    .from("teams")
    .select("*")
    .eq("session_id", session.id)
    .ilike("team_name", name)
    .maybeSingle();
  if (existing) return { ok: true, team: existing as Team };
  const { data: teams } = await client
    .from("teams")
    .select("color_code")
    .eq("session_id", session.id);
  const used = ((teams as { color_code: string }[] | null) ?? []).map(
    (t) => t.color_code,
  );
  const { data, error } = await client
    .from("teams")
    .insert({
      session_id: session.id,
      team_name: name,
      color_code: pickTeamColor(used),
      score: 0,
    })
    .select("*")
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
      .select("*")
      .eq("session_id", activeSession.id)
      .order("joined_at", { ascending: true }),
    client
      .from("session_questions")
      .select("*")
      .eq("session_id", activeSession.id)
      .order("slot_number", { ascending: true }),
    client
      .from("answers")
      .select("*")
      .eq("session_id", activeSession.id)
      .order("answered_at", { ascending: true }),
    client
      .from("activity_logs")
      .select("*")
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const logs = ((logsRes.data as ActivityLog[] | null) ?? []).reverse();
  return {
    session: activeSession,
    teams: (teamsRes.data as Team[] | null) ?? [],
    slots: (slotsRes.data as SessionSlot[] | null) ?? [],
    answers: (answersRes.data as Answer[] | null) ?? [],
    logs,
    serverTime: new Date().toISOString(),
  };
}

export async function requestQuestion(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
}): Promise<SlotQuestion> {
  const client = sb();
  const session = await getSessionByCode(input.sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.status === "ENDED") throw new Error("Sesi sudah berakhir");
  if (session.status !== "PLAYING") throw new Error("Sesi belum dimulai");
  if (isSessionTimeUp(session)) throw new Error("Waktu sesi sudah habis");
  const team = await getTeam(client, session.id, input.teamId);
  if (!team) throw new Error("Tim tidak terdaftar di sesi ini");
  enforceRateLimit(`${session.id}:${team.id}`);
  const slot = await getSlot(client, session.id, input.slotNumber);
  if (!slot) throw new Error("Nomor soal tidak ditemukan");
  const { data: questionData, error } = await client
    .from("questions")
    .select("*")
    .eq("id", slot.question_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const question = questionData as Question | null;
  if (!question) throw new Error("Soal tidak ditemukan");
  const { data: existing } = await client
    .from("answers")
    .select("id")
    .eq("session_id", session.id)
    .eq("team_id", team.id)
    .eq("slot_number", input.slotNumber)
    .maybeSingle();
  const wrongAttempts = await countWrongAttemptsForSlot(
    client,
    session.id,
    team.id,
    input.slotNumber,
  );
  return {
    slotNumber: input.slotNumber,
    question: withShuffledChoices(toPublicQuestion(question)),
    solved: Boolean(existing),
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_SLOT - wrongAttempts),
    locked: wrongAttempts >= MAX_ATTEMPTS_PER_SLOT,
    correctAnswer: existing ? question.correct_answer : undefined,
  };
}

export async function submitAnswer(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
  answer: string;
}): Promise<AnswerResult> {
  const client = sb();
  const session = await getSessionByCode(input.sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.status === "ENDED") throw new Error("Sesi sudah berakhir");
  if (session.status !== "PLAYING") throw new Error("Sesi belum dimulai");
  if (isSessionTimeUp(session)) throw new Error("Waktu sesi sudah habis");
  const team = await getTeam(client, session.id, input.teamId);
  if (!team) throw new Error("Tim tidak terdaftar di sesi ini");
  enforceRateLimit(`${session.id}:${team.id}`);
  const slot = await getSlot(client, session.id, input.slotNumber);
  if (!slot) throw new Error("Nomor soal tidak ditemukan");
  const { data: existing } = await client
    .from("answers")
    .select("id")
    .eq("session_id", session.id)
    .eq("team_id", team.id)
    .eq("slot_number", input.slotNumber)
    .maybeSingle();
  if (existing) throw new Error("Soal ini sudah Anda jawab benar");
  const priorWrong = await countWrongAttemptsForSlot(
    client,
    session.id,
    team.id,
    input.slotNumber,
  );
  if (priorWrong >= MAX_ATTEMPTS_PER_SLOT) {
    return {
      correct: false,
      message: `Nomor ${input.slotNumber} terkunci untuk tim Anda.`,
      gainedPoints: 0,
      attemptsLeft: 0,
      locked: true,
    };
  }
  const { data: questionData } = await client
    .from("questions")
    .select("*")
    .eq("id", slot.question_id)
    .maybeSingle();
  const question = questionData as Question | null;
  if (!question) throw new Error("Soal tidak ditemukan");
  if (!isAnswerCorrect(question, input.answer)) {
    const attempt = priorWrong + 1;
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_SLOT - attempt);
    await addLog(
      session.id,
      team.id,
      `Tim ${team.team_name} menjawab salah nomor ${input.slotNumber} (percobaan ${attempt}/${MAX_ATTEMPTS_PER_SLOT})`,
      "INFO",
    );
    return {
      correct: false,
      message:
        attemptsLeft > 0
          ? `Jawaban belum tepat. Sisa percobaan: ${attemptsLeft}`
          : `Jawaban belum tepat. Nomor ${input.slotNumber} terkunci untuk tim Anda.`,
      gainedPoints: 0,
      attemptsLeft,
      locked: attemptsLeft <= 0,
    };
  }
  const { data: lastAnswer } = await client
    .from("answers")
    .select("answered_at")
    .eq("session_id", session.id)
    .eq("team_id", team.id)
    .order("answered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rapidFire = isRapidFire(
    (lastAnswer as { answered_at: string } | null)?.answered_at ?? null,
    Date.now(),
  );
  const gained =
    question.points > 0 ? question.points : pointsFor(question.difficulty);
  const { error: insertError } = await client.from("answers").insert({
    session_id: session.id,
    team_id: team.id,
    slot_number: input.slotNumber,
    question_id: question.id,
    points: gained,
    answered_at: new Date().toISOString(),
  });
  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("Soal ini sudah Anda jawab benar");
    }
    throw new Error(insertError.message);
  }
  await client
    .from("teams")
    .update({ score: team.score + gained })
    .eq("id", team.id);
  await addLog(
    session.id,
    team.id,
    `Tim ${team.team_name} menjawab benar nomor ${input.slotNumber} (+${gained})`,
    "CLAIM",
  );
  if (priorWrong >= MAX_ATTEMPTS_PER_SLOT - 1 || rapidFire) {
    await addLog(
      session.id,
      team.id,
      `[PERINGATAN] Tim ${team.team_name} nomor ${input.slotNumber} dijawab benar dengan indikasi mencurigakan`,
      "ERROR",
    );
  }
  return {
    correct: true,
    message: `Benar! +${gained} poin`,
    gainedPoints: gained,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_SLOT - priorWrong),
    locked: false,
  };
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
    .select("*")
    .ilike("name", groupName)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  let group = existing as QuestionGroup | null;
  let created = false;
  if (!group) {
    const { data, error } = await client
      .from("question_groups")
      .insert({ name: groupName, subject })
      .select("*")
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
