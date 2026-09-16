import { parseQuestionBank } from "../questions";
import type {
  GeneratedQuestionBank,
  GenerateQuestionsInput,
  GeminiModel,
} from "../types";
import { GEMINI_RESPONSE_SCHEMA, buildQuestionPrompt } from "./prompt";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 60_000;

export function sanitizeApiKey(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:api[_-]?key=|key=|bearer)/i, "");
}

export function maskApiKey(apiKey: string): string {
  const trimmed = sanitizeApiKey(apiKey);
  if (trimmed.length <= 4) return "••••";
  return `••••••••${trimmed.slice(-4)}`;
}

interface GeminiApiError {
  error?: { message?: string; status?: string };
}

async function request(
  url: string,
  apiKey: string,
  init?: RequestInit,
): Promise<unknown> {
  const key = sanitizeApiKey(apiKey);
  if (!key) {
    throw new Error("API key Gemini belum diatur. Buka tab Pengaturan.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Permintaan ke Gemini timeout. Coba lagi.");
    }
    throw new Error("Gagal menghubungi Gemini. Periksa koneksi internet.");
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    const message = (body as GeminiApiError | null)?.error?.message;
    const lower = (message ?? "").toLowerCase();
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      if (lower.includes("api key not valid") || lower.includes("api_key_invalid")) {
        throw new Error(
          "API key Gemini tidak valid. Salin ulang key dari Google AI Studio di tab Pengaturan.",
        );
      }
      if (
        lower.includes("has not been used") ||
        lower.includes("disabled") ||
        lower.includes("permission")
      ) {
        throw new Error(
          "API key tidak punya akses. Pastikan Generative Language API aktif untuk project key tersebut.",
        );
      }
      throw new Error(
        message ?? "API key Gemini tidak valid atau tidak punya akses.",
      );
    }
    if (response.status === 429) {
      throw new Error("Kuota Gemini habis. Tunggu sebentar lalu coba lagi.");
    }
    throw new Error(message ?? `Gemini gagal (HTTP ${response.status}).`);
  }
  return body;
}

export async function listGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  const body = (await request(`${API_BASE}/models`, apiKey)) as {
    models?: {
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }[];
  };
  return (body.models ?? [])
    .filter((model) =>
      (model.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((model) => ({
      id: (model.name ?? "").replace(/^models\//, ""),
      displayName: model.displayName ?? (model.name ?? "").replace(/^models\//, ""),
    }))
    .filter((model) => model.id.length > 0);
}

function extractArray(text: string): string {
  const trimmed = text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Gemini tidak mengembalikan JSON yang valid. Coba lagi.");
    }
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  }
  if (Array.isArray(parsed)) return JSON.stringify(parsed);
  if (parsed && typeof parsed === "object") {
    const nested = Object.values(parsed).find((value) => Array.isArray(value));
    if (nested) return JSON.stringify(nested);
  }
  throw new Error("Gemini tidak mengembalikan array soal. Coba lagi.");
}

export async function generateQuestions(
  apiKey: string,
  model: string,
  input: GenerateQuestionsInput,
): Promise<GeneratedQuestionBank> {
  const body = (await request(
    `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildQuestionPrompt(input) }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
    },
  )) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (body.promptFeedback?.blockReason) {
    throw new Error(
      "Permintaan diblokir oleh filter keamanan Gemini. Ubah materi lalu coba lagi.",
    );
  }

  const candidate = body.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini tidak menghasilkan soal. Coba lagi.");
  }

  const questions = parseQuestionBank(extractArray(text));
  return { questions, raw: JSON.stringify(questions, null, 2), model };
}
