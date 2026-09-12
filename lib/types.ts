export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "SHORT_ANSWER"
  | "REARRANGE_WORDS";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type SessionStatus = "LOBBY" | "PLAYING" | "ENDED";

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

export interface GameState {
  session: Session;
  teams: Team[];
  slots: SessionSlot[];
  answers: Answer[];
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
  attemptsLeft: number;
  locked: boolean;
}

export interface AnswerResult {
  correct: boolean;
  message: string;
  gainedPoints: number;
  attemptsLeft: number;
  locked: boolean;
}
