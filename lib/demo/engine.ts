import { pickTeamColor } from "../colors";
import {
  MAX_ATTEMPTS_PER_SLOT,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  countWrongAttempts,
  isAnswerCorrect,
  isRapidFire,
  pointsFor,
  shuffle,
} from "../game";
import type {
  ActivityLog,
  Answer,
  AnswerResult,
  GameState,
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
} from "../types";

const STORAGE_KEY = "classroom-conquest:demo:v3";
const CHANNEL_NAME = "classroom-conquest-demo";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let outboundChannel: BroadcastChannel | null = null;

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

interface DemoDB {
  sessions: Session[];
  teams: Team[];
  groups: QuestionGroup[];
  questions: Question[];
  slots: SessionSlot[];
  answers: Answer[];
  logs: ActivityLog[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function uid(): string {
  return crypto.randomUUID();
}

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function emptyDB(): DemoDB {
  return {
    sessions: [],
    teams: [],
    groups: [],
    questions: [],
    slots: [],
    answers: [],
    logs: [],
  };
}

function load(): DemoDB {
  if (typeof window === "undefined") return emptyDB();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyDB();
  try {
    const parsed = JSON.parse(raw) as Partial<DemoDB>;
    return {
      sessions: parsed.sessions ?? [],
      teams: parsed.teams ?? [],
      groups: parsed.groups ?? [],
      questions: parsed.questions ?? [],
      slots: parsed.slots ?? [],
      answers: parsed.answers ?? [],
      logs: parsed.logs ?? [],
    };
  } catch {
    return emptyDB();
  }
}

function save(db: DemoDB): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  postChange();
}

function postChange(): void {
  if (typeof window === "undefined") return;
  if (!outboundChannel) outboundChannel = new BroadcastChannel(CHANNEL_NAME);
  outboundChannel.postMessage({ type: "change" });
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

function countWrongAttemptsForSlot(
  db: DemoDB,
  sessionId: string,
  teamId: string,
  slotNumber: number,
): number {
  return countWrongAttempts(
    db.logs.filter(
      (log) => log.session_id === sessionId && log.team_id === teamId,
    ),
    slotNumber,
  );
}

function addLog(
  db: DemoDB,
  sessionId: string,
  teamId: string | null,
  message: string,
  kind: LogKind,
): void {
  db.logs.push({
    id: uid(),
    session_id: sessionId,
    team_id: teamId,
    message,
    kind,
    created_at: nowIso(),
  });
}

function isSessionTimeUp(session: Session): boolean {
  if (session.status === "ENDED") return true;
  if (!session.started_at) return false;
  const endsAt =
    new Date(session.started_at).getTime() + session.duration_minutes * 60_000;
  return Date.now() > endsAt;
}

function ensureSlots(db: DemoDB, session: Session): void {
  const existing = db.slots.filter((slot) => slot.session_id === session.id);
  if (existing.length > 0) return;
  const questions = db.questions
    .filter((q) => q.group_id === session.group_id)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (questions.length === 0) {
    throw new Error("Group soal kosong. Impor soal terlebih dahulu.");
  }
  questions.forEach((question, index) => {
    db.slots.push({
      id: uid(),
      session_id: session.id,
      slot_number: index + 1,
      question_id: question.id,
      created_at: nowIso(),
    });
  });
}

function findSession(db: DemoDB, sessionCode: string): Session | undefined {
  const code = sessionCode.trim().toUpperCase();
  return db.sessions.find((s) => s.session_code === code);
}

export async function listQuestionGroups(): Promise<QuestionGroupSummary[]> {
  const db = load();
  return [...db.groups]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((group) => ({
      ...group,
      question_count: db.questions.filter((q) => q.group_id === group.id).length,
    }));
}

export async function listGroupQuestions(
  groupId: string,
): Promise<PublicQuestion[]> {
  const db = load();
  return db.questions
    .filter((q) => q.group_id === groupId)
    .map((q) => toPublicQuestion(q));
}

export async function createSession(input: {
  groupId: string;
  durationMinutes?: number;
}): Promise<{ code: string }> {
  const db = load();
  const groupId = input.groupId?.trim();
  if (!groupId) throw new Error("Group soal wajib dipilih");
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("Group soal tidak ditemukan");
  const duration = Math.min(120, Math.max(5, input.durationMinutes ?? 30));
  let code = randomCode();
  while (db.sessions.some((s) => s.session_code === code)) code = randomCode();
  const session: Session = {
    id: uid(),
    session_code: code,
    group_id: group.id,
    subject_name: group.subject,
    is_active: true,
    status: "LOBBY",
    duration_minutes: duration,
    started_at: null,
    ended_at: null,
    created_at: nowIso(),
  };
  db.sessions.push(session);
  ensureSlots(db, session);
  addLog(
    db,
    session.id,
    null,
    `Sesi ${code} dibuat untuk ${group.subject}`,
    "SYSTEM",
  );
  save(db);
  return { code };
}

export async function listSessions(): Promise<Session[]> {
  const db = load();
  return [...db.sessions]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);
}

export async function joinTeam(input: {
  sessionCode: string;
  teamName: string;
}): Promise<{ team: Team }> {
  const db = load();
  const session = findSession(db, input.sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.status === "ENDED") throw new Error("Sesi sudah berakhir");
  const name = input.teamName.trim();
  if (!name) throw new Error("Nama tim wajib diisi");
  const existing = db.teams.find(
    (t) =>
      t.session_id === session.id &&
      t.team_name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return { team: existing };
  const used = db.teams
    .filter((t) => t.session_id === session.id)
    .map((t) => t.color_code);
  const team: Team = {
    id: uid(),
    session_id: session.id,
    team_name: name,
    color_code: pickTeamColor(used),
    score: 0,
    joined_at: nowIso(),
  };
  db.teams.push(team);
  addLog(db, session.id, team.id, `Tim ${team.team_name} bergabung`, "JOIN");
  save(db);
  return { team };
}

export async function fetchGameState(
  sessionCode: string,
): Promise<GameState | null> {
  const db = load();
  const session = findSession(db, sessionCode);
  if (!session) return null;
  return {
    session,
    teams: db.teams
      .filter((t) => t.session_id === session.id)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
    slots: db.slots
      .filter((s) => s.session_id === session.id)
      .sort((a, b) => a.slot_number - b.slot_number),
    answers: db.answers
      .filter((a) => a.session_id === session.id)
      .sort((a, b) => a.answered_at.localeCompare(b.answered_at)),
    logs: db.logs
      .filter((l) => l.session_id === session.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-50),
    serverTime: nowIso(),
  };
}

export async function requestQuestion(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
}): Promise<SlotQuestion> {
  const db = load();
  const session = findSession(db, input.sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.status === "ENDED") throw new Error("Sesi sudah berakhir");
  if (session.status !== "PLAYING") throw new Error("Sesi belum dimulai");
  if (isSessionTimeUp(session)) throw new Error("Waktu sesi sudah habis");
  const team = db.teams.find(
    (t) => t.id === input.teamId && t.session_id === session.id,
  );
  if (!team) throw new Error("Tim tidak terdaftar di sesi ini");
  enforceRateLimit(`${session.id}:${team.id}`);
  const slot = db.slots.find(
    (s) => s.session_id === session.id && s.slot_number === input.slotNumber,
  );
  if (!slot) throw new Error("Nomor soal tidak ditemukan");
  const question = db.questions.find((q) => q.id === slot.question_id);
  if (!question) throw new Error("Soal tidak ditemukan");
  const solved = db.answers.some(
    (a) =>
      a.session_id === session.id &&
      a.team_id === team.id &&
      a.slot_number === input.slotNumber,
  );
  const wrongAttempts = countWrongAttemptsForSlot(
    db,
    session.id,
    team.id,
    input.slotNumber,
  );
  return {
    slotNumber: input.slotNumber,
    question: withShuffledChoices(toPublicQuestion(question)),
    solved,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_SLOT - wrongAttempts),
    locked: wrongAttempts >= MAX_ATTEMPTS_PER_SLOT,
  };
}

export async function submitAnswer(input: {
  sessionCode: string;
  teamId: string;
  slotNumber: number;
  answer: string;
}): Promise<AnswerResult> {
  const db = load();
  const session = findSession(db, input.sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.status === "ENDED") throw new Error("Sesi sudah berakhir");
  if (session.status !== "PLAYING") throw new Error("Sesi belum dimulai");
  if (isSessionTimeUp(session)) throw new Error("Waktu sesi sudah habis");
  const team = db.teams.find(
    (t) => t.id === input.teamId && t.session_id === session.id,
  );
  if (!team) throw new Error("Tim tidak terdaftar di sesi ini");
  enforceRateLimit(`${session.id}:${team.id}`);
  const slot = db.slots.find(
    (s) => s.session_id === session.id && s.slot_number === input.slotNumber,
  );
  if (!slot) throw new Error("Nomor soal tidak ditemukan");
  const solved = db.answers.some(
    (a) =>
      a.session_id === session.id &&
      a.team_id === team.id &&
      a.slot_number === input.slotNumber,
  );
  if (solved) throw new Error("Soal ini sudah Anda jawab benar");
  const priorWrong = countWrongAttemptsForSlot(
    db,
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
  const question = db.questions.find((q) => q.id === slot.question_id);
  if (!question) throw new Error("Soal tidak ditemukan");
  if (!isAnswerCorrect(question, input.answer)) {
    const attempt = priorWrong + 1;
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_SLOT - attempt);
    addLog(
      db,
      session.id,
      team.id,
      `Tim ${team.team_name} menjawab salah nomor ${input.slotNumber} (percobaan ${attempt}/${MAX_ATTEMPTS_PER_SLOT})`,
      "INFO",
    );
    save(db);
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
  const teamAnswers = db.answers
    .filter((a) => a.session_id === session.id && a.team_id === team.id)
    .sort((a, b) => a.answered_at.localeCompare(b.answered_at));
  const lastAnsweredAt =
    teamAnswers.length > 0
      ? teamAnswers[teamAnswers.length - 1].answered_at
      : null;
  const rapidFire = isRapidFire(lastAnsweredAt, Date.now());
  const gained =
    question.points > 0 ? question.points : pointsFor(question.difficulty);
  db.answers.push({
    id: uid(),
    session_id: session.id,
    team_id: team.id,
    slot_number: input.slotNumber,
    question_id: question.id,
    points: gained,
    answered_at: nowIso(),
  });
  team.score += gained;
  addLog(
    db,
    session.id,
    team.id,
    `Tim ${team.team_name} menjawab benar nomor ${input.slotNumber} (+${gained})`,
    "CLAIM",
  );
  if (priorWrong >= MAX_ATTEMPTS_PER_SLOT - 1 || rapidFire) {
    addLog(
      db,
      session.id,
      team.id,
      `[PERINGATAN] Tim ${team.team_name} nomor ${input.slotNumber} dijawab benar dengan indikasi mencurigakan`,
      "ERROR",
    );
  }
  save(db);
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
  const db = load();
  const groupName = input.groupName.trim();
  if (!groupName) throw new Error("Nama group wajib diisi");
  const subject = input.subject.trim();
  if (!subject) throw new Error("Mata pelajaran wajib diisi");
  const list = Array.isArray(input.questions) ? input.questions : [];
  if (list.length === 0) throw new Error("Tidak ada soal untuk diimpor");
  let group = db.groups.find(
    (g) => g.name.toLowerCase() === groupName.toLowerCase(),
  );
  let created = false;
  if (!group) {
    group = {
      id: uid(),
      name: groupName,
      subject,
      created_at: nowIso(),
    };
    db.groups.push(group);
    created = true;
  }
  for (const q of list) {
    db.questions.push({
      id: uid(),
      group_id: group.id,
      subject: group.subject,
      type: q.type,
      difficulty: q.difficulty,
      question_text: q.question_text,
      metadata: q.metadata ?? null,
      correct_answer: q.correct_answer,
      points: q.points ?? pointsFor(q.difficulty),
    });
  }
  save(db);
  return {
    groupId: group.id,
    groupName: group.name,
    inserted: list.length,
    created,
  };
}

export async function deleteQuestionGroup(groupId: string): Promise<void> {
  const db = load();
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) return;
  const used = db.sessions.some((s) => s.group_id === group.id);
  if (used) {
    throw new Error("Group sedang dipakai sesi. Hapus sesinya dulu.");
  }
  const questionIds = new Set(
    db.questions.filter((q) => q.group_id === group.id).map((q) => q.id),
  );
  db.groups = db.groups.filter((g) => g.id !== group.id);
  db.questions = db.questions.filter((q) => q.group_id !== group.id);
  db.slots = db.slots.filter((s) => !questionIds.has(s.question_id));
  db.answers = db.answers.filter((a) => !questionIds.has(a.question_id));
  save(db);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const db = load();
  const question = db.questions.find((q) => q.id === questionId);
  if (!question) return;
  const used = db.slots.some((s) => s.question_id === question.id);
  if (used) {
    throw new Error("Soal sedang dipakai sesi. Hapus sesinya dulu.");
  }
  db.questions = db.questions.filter((q) => q.id !== question.id);
  db.answers = db.answers.filter((a) => a.question_id !== question.id);
  save(db);
}

export async function startSession(sessionCode: string): Promise<void> {
  const db = load();
  const session = findSession(db, sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  session.status = "PLAYING";
  session.is_active = true;
  session.started_at = nowIso();
  session.ended_at = null;
  addLog(db, session.id, null, "Sesi dimulai", "SYSTEM");
  save(db);
}

export async function resetSession(sessionCode: string): Promise<void> {
  const db = load();
  const session = findSession(db, sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  db.answers = db.answers.filter((a) => a.session_id !== session.id);
  for (const team of db.teams) {
    if (team.session_id === session.id) team.score = 0;
  }
  db.logs = db.logs.filter((l) => l.session_id !== session.id);
  session.status = "PLAYING";
  session.is_active = true;
  session.started_at = nowIso();
  session.ended_at = null;
  addLog(db, session.id, null, "Sesi direset. Skor dikosongkan.", "SYSTEM");
  save(db);
}

export async function endSession(sessionCode: string): Promise<void> {
  const db = load();
  const session = findSession(db, sessionCode);
  if (!session) throw new Error("Sesi tidak ditemukan");
  session.status = "ENDED";
  session.is_active = false;
  session.ended_at = nowIso();
  addLog(db, session.id, null, "Sesi diakhiri", "SYSTEM");
  save(db);
}

export async function deleteSession(sessionCode: string): Promise<void> {
  const db = load();
  const session = findSession(db, sessionCode);
  if (!session) return;
  db.sessions = db.sessions.filter((s) => s.id !== session.id);
  db.teams = db.teams.filter((t) => t.session_id !== session.id);
  db.slots = db.slots.filter((s) => s.session_id !== session.id);
  db.answers = db.answers.filter((a) => a.session_id !== session.id);
  db.logs = db.logs.filter((l) => l.session_id !== session.id);
  save(db);
}

export function subscribe(
  _sessionId: string,
  onChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const onMessage = () => onChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  channel.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  return () => {
    channel.removeEventListener("message", onMessage);
    channel.close();
    window.removeEventListener("storage", onStorage);
  };
}
