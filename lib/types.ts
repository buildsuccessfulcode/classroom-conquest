export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "SHORT_ANSWER"
  | "REARRANGE_WORDS";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type SessionStatus = "LOBBY" | "PLAYING" | "ENDED";

export type GameMode = "CLASSIC" | "SNAKES";

export type BoardPreset = "MUDAH" | "NORMAL" | "SULIT";

export type FinishRule = "OVERSHOOT" | "EXACT";

export interface BoardLink {
  from: number;
  to: number;
}

export interface BoardConfig {
  goal: number;
  preset: BoardPreset;
  seed: number;
  finishRule?: FinishRule;
  ladders: BoardLink[];
  snakes: BoardLink[];
}

export type LogKind =
  | "INFO"
  | "CLAIM"
  | "ATTACK"
  | "JOIN"
  | "SYSTEM"
  | "ERROR";

export interface QuestionMetadata {
  options?: string[];
  code_snippet?: string;
  words?: string[];
}

export interface QuestionGroup {
  id: string;
  name: string;
  subject: string;
  created_at: string;
}

export interface QuestionGroupSummary extends QuestionGroup {
  question_count: number;
}

export interface Question {
  id: string;
  group_id: string;
  subject: string;
  type: QuestionType;
  difficulty: Difficulty;
  question_text: string;
  metadata: QuestionMetadata | null;
  correct_answer: string;
  points: number;
}

export type PublicQuestion = Omit<Question, "correct_answer">;

export interface Session {
  id: string;
  session_code: string;
  group_id: string;
  subject_name: string;
  is_active: boolean;
  status: SessionStatus;
  game_mode: GameMode;
  board_config: BoardConfig | null;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  session_id: string;
  team_name: string;
  color_code: string;
  avatar: string | null;
  position: number;
  finished_at: string | null;
  score: number;
  joined_at: string;
}

export interface SessionSlot {
  id: string;
  session_id: string;
  slot_number: number;
  question_id: string;
  created_at: string;
}

export interface Answer {
  id: string;
  session_id: string;
  team_id: string;
  slot_number: number;
  question_id: string;
  points: number;
  answered_at: string;
}

export interface ActivityLog {
  id: string;
  session_id: string;
  team_id: string | null;
  message: string;
  kind: LogKind;
  created_at: string;
}

export interface SlotAttempt {
  session_id: string;
  team_id: string;
  slot_number: number;
  attempts: number;
  last_attempt_at: string;
}

export interface Move {
  id: string;
  session_id: string;
  team_id: string;
  slot_number: number;
  question_id: string;
  correct: boolean;
  points: number;
  delta: number;
  from_position: number;
  to_position: number;
  jump: number;
  created_at: string;
}

export interface SlotInfo {
  slot_number: number;
  question_id: string;
  type: QuestionType;
  difficulty: Difficulty;
  points: number;
}

export interface GameState {
  session: Session;
  teams: Team[];
  slots: SessionSlot[];
  answers: Answer[];
  moves: Move[];
  slotInfo: SlotInfo[];
  attempts: SlotAttempt[];
  logs: ActivityLog[];
  serverTime: string;
}

export interface SeedQuestion {
  subject: string;
  type: QuestionType;
  difficulty: Difficulty;
  question_text: string;
  metadata?: QuestionMetadata | null;
  correct_answer: string;
  points?: number;
}

export interface LeaderboardEntry {
  team: Team;
  points: number;
  correct: number;
  total: number;
  lastAnsweredAt: string | null;
  rank: number;
}

export interface SlotQuestion {
  slotNumber: number;
  question: PublicQuestion;
  solved: boolean;
  used: boolean;
  attemptsLeft: number;
  locked: boolean;
  correctAnswer?: string;
}

export interface AnswerResult {
  correct: boolean;
  message: string;
  gainedPoints: number;
  attemptsLeft: number;
  locked: boolean;
  delta?: number;
  position?: number;
  jump?: number;
  finished?: boolean;
  streak?: number;
  bounced?: boolean;
  createdAt?: string;
}

export interface BoardStanding {
  team: Team;
  position: number;
  rank: number;
  finishedAt: string | null;
}

export type JoinTeamResult =
  | { ok: true; team: Team }
  | { ok: false; error: string };

export interface AiSettings {
  hasKey: boolean;
  maskedKey: string | null;
  model: string;
}

export interface GeminiModel {
  id: string;
  displayName: string;
}

export interface GenerateQuestionsInput {
  subject: string;
  topic: string;
  grade: string;
  language: "id" | "en";
  count: number;
  distribution: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
  types: QuestionType[];
}

export interface GeneratedQuestionBank {
  questions: SeedQuestion[];
  raw: string;
  model: string;
}
