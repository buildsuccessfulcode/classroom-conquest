import type {
  Difficulty,
  QuestionMetadata,
  QuestionType,
  SeedQuestion,
} from "./types";

export const MAX_IMPORT_QUESTIONS = 500;

const QUESTION_TYPES: QuestionType[] = [
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "REARRANGE_WORDS",
];

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(
  value: unknown,
  type: QuestionType,
  label: string,
): QuestionMetadata | null {
  if (value === undefined || value === null) {
    if (type === "MULTIPLE_CHOICE") {
      throw new Error(`${label}: metadata.options wajib untuk MULTIPLE_CHOICE`);
    }
    if (type === "REARRANGE_WORDS") {
      throw new Error(`${label}: metadata.words wajib untuk REARRANGE_WORDS`);
    }
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`${label}: metadata harus berupa objek`);
  }
  const metadata: QuestionMetadata = {};
  if (value.options !== undefined) {
    if (
      !Array.isArray(value.options) ||
      value.options.some((option) => typeof option !== "string")
    ) {
      throw new Error(`${label}: metadata.options harus berupa array teks`);
    }
    metadata.options = value.options as string[];
  }
  if (value.words !== undefined) {
    if (
      !Array.isArray(value.words) ||
      value.words.some((word) => typeof word !== "string")
    ) {
      throw new Error(`${label}: metadata.words harus berupa array teks`);
    }
    metadata.words = value.words as string[];
  }
  if (value.code_snippet !== undefined) {
    if (typeof value.code_snippet !== "string") {
      throw new Error(`${label}: metadata.code_snippet harus berupa teks`);
    }
    metadata.code_snippet = value.code_snippet;
  }
  if (
    type === "MULTIPLE_CHOICE" &&
    (!metadata.options || metadata.options.length === 0)
  ) {
    throw new Error(`${label}: metadata.options wajib untuk MULTIPLE_CHOICE`);
  }
  if (
    type === "REARRANGE_WORDS" &&
    (!metadata.words || metadata.words.length === 0)
  ) {
    throw new Error(`${label}: metadata.words wajib untuk REARRANGE_WORDS`);
  }
  return metadata;
}

function parseItem(item: unknown, index: number): SeedQuestion {
  const label = `Soal ke-${index + 1}`;
  if (!isRecord(item)) {
    throw new Error(`${label}: format soal tidak valid`);
  }
  const type = item.type;
  if (
    typeof type !== "string" ||
    !QUESTION_TYPES.includes(type as QuestionType)
  ) {
    throw new Error(
      `${label}: type harus salah satu dari ${QUESTION_TYPES.join(", ")}`,
    );
  }
  const difficulty = item.difficulty;
  if (
    typeof difficulty !== "string" ||
    !DIFFICULTIES.includes(difficulty as Difficulty)
  ) {
    throw new Error(`${label}: difficulty harus EASY, MEDIUM, atau HARD`);
  }
  const questionText = item.question_text;
  if (typeof questionText !== "string" || !questionText.trim()) {
    throw new Error(`${label}: question_text wajib diisi`);
  }
  const correctAnswer = item.correct_answer;
  if (typeof correctAnswer !== "string" || !correctAnswer.trim()) {
    throw new Error(`${label}: correct_answer wajib diisi`);
  }
  const metadata = parseMetadata(
    item.metadata,
    type as QuestionType,
    label,
  );
  const points =
    typeof item.points === "number" && Number.isFinite(item.points)
      ? Math.max(0, Math.round(item.points))
      : undefined;
  return {
    subject: typeof item.subject === "string" ? item.subject : "",
    type: type as QuestionType,
    difficulty: difficulty as Difficulty,
    question_text: questionText.trim(),
    metadata,
    correct_answer: correctAnswer.trim(),
    points,
  };
}

export function parseQuestionBank(raw: string): SeedQuestion[] {
  if (!raw.trim()) {
    throw new Error("Belum ada data soal untuk diimpor");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File bukan JSON yang valid");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Isi file harus berupa array soal");
  }
  if (parsed.length === 0) {
    throw new Error("File tidak memuat soal");
  }
  if (parsed.length > MAX_IMPORT_QUESTIONS) {
    throw new Error(`Maksimal ${MAX_IMPORT_QUESTIONS} soal per impor`);
  }
  return parsed.map((item, index) => parseItem(item, index));
}
