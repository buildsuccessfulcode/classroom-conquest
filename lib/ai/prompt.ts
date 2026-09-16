import type { GenerateQuestionsInput, QuestionType } from "../types";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  SHORT_ANSWER: "SHORT_ANSWER",
  REARRANGE_WORDS: "REARRANGE_WORDS",
};

export const GEMINI_RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      subject: { type: "STRING" },
      type: {
        type: "STRING",
        enum: ["MULTIPLE_CHOICE", "SHORT_ANSWER", "REARRANGE_WORDS"],
      },
      difficulty: {
        type: "STRING",
        enum: ["EASY", "MEDIUM", "HARD"],
      },
      question_text: { type: "STRING" },
      metadata: {
        type: "OBJECT",
        properties: {
          options: { type: "ARRAY", items: { type: "STRING" } },
          words: { type: "ARRAY", items: { type: "STRING" } },
          code_snippet: { type: "STRING" },
        },
      },
      correct_answer: { type: "STRING" },
      points: { type: "INTEGER" },
    },
    required: [
      "subject",
      "type",
      "difficulty",
      "question_text",
      "correct_answer",
      "points",
    ],
  },
} as const;

export function buildQuestionPrompt(input: GenerateQuestionsInput): string {
  const language = input.language === "en" ? "Inggris" : "Indonesia";
  const types = input.types.map((type) => TYPE_LABEL[type]).join(", ");
  const grade = input.grade.trim() || "umum";
  const topic = input.topic.trim();
  const topicLine = topic
    ? `- Materi/topik: ${topic}`
    : "- Materi/topik: bebas (pilih cakupan materi yang sesuai dengan mata pelajaran)";
  return [
    'Kamu adalah pembuat bank soal untuk aplikasi gamifikasi kelas "Classroom Conquest".',
    "",
    "Buatkan bank soal dengan ketentuan:",
    `- Mata pelajaran: ${input.subject.trim()}`,
    topicLine,
    `- Jenjang/kelas: ${grade}`,
    `- Bahasa: ${language}`,
    `- Jumlah soal: ${input.count}`,
    `- Distribusi kesulitan: EASY ${input.distribution.EASY}, MEDIUM ${input.distribution.MEDIUM}, HARD ${input.distribution.HARD}`,
    `- Jenis soal yang dipakai: ${types}`,
    "",
    "Keluarkan HANYA array JSON yang valid, tanpa penjelasan, tanpa markdown, tanpa teks tambahan.",
    "Setiap elemen mengikuti skema berikut:",
    "{",
    `  "subject": "${input.subject.trim()}",`,
    '  "type": "MULTIPLE_CHOICE | SHORT_ANSWER | REARRANGE_WORDS",',
    '  "difficulty": "EASY | MEDIUM | HARD",',
    '  "question_text": "teks pertanyaan",',
    '  "metadata": { ... },',
    '  "correct_answer": "jawaban acuan",',
    '  "points": 100',
    "}",
    "",
    "Aturan metadata per tipe:",
    "- MULTIPLE_CHOICE: metadata WAJIB punya \"options\" berisi 4 pilihan teks. Hanya satu pilihan",
    "  yang benar. correct_answer HARUS sama persis dengan salah satu isi options.",
    "- SHORT_ANSWER: jawaban singkat (1-3 kata/angka). Boleh menambah \"code_snippet\" untuk soal kode.",
    "- REARRANGE_WORDS: metadata WAJIB punya \"words\" berisi daftar kata. correct_answer adalah",
    "  gabungan semua kata dalam urutan benar, dipisah satu spasi. Semua kata di words harus terpakai.",
    "",
    "Aturan penilaian:",
    "- points: EASY = 100, MEDIUM = 150, HARD = 200.",
    "",
    "Aturan kualitas:",
    `- Gunakan bahasa ${language} yang baku dan jelas.`,
    "- Hindari jawaban yang ambigu atau lebih dari satu pilihan benar.",
    "- Sebar materi secara merata dan sesuai tingkat kesulitan.",
    "- Jangan mengulang soal yang sama.",
    ...(topic
      ? []
      : [
          "- Karena materi tidak ditentukan, variasikan cakupan materi secara luas namun tetap",
          "  dalam mata pelajaran di atas.",
        ]),
  ].join("\n");
}
