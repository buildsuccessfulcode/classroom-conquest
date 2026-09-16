import { sanitizeApiKey } from "../ai/gemini";
import { GEMINI_DEFAULT_MODEL } from "../ai/prompt";

const STORAGE_KEY = "classroom-conquest:ai:v1";

export interface DemoAiSettings {
  apiKey: string;
  model: string;
}

function empty(): DemoAiSettings {
  return { apiKey: "", model: GEMINI_DEFAULT_MODEL };
}

export function readDemoAiSettings(): DemoAiSettings {
  if (typeof window === "undefined") return empty();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<DemoAiSettings>;
    return {
      apiKey:
        typeof parsed.apiKey === "string" ? sanitizeApiKey(parsed.apiKey) : "",
      model:
        typeof parsed.model === "string" && parsed.model.trim()
          ? parsed.model.trim()
          : GEMINI_DEFAULT_MODEL,
    };
  } catch {
    return empty();
  }
}

export function writeDemoAiSettings(patch: Partial<DemoAiSettings>): void {
  if (typeof window === "undefined") return;
  const current = readDemoAiSettings();
  const next: DemoAiSettings = {
    apiKey:
      patch.apiKey !== undefined ? sanitizeApiKey(patch.apiKey) : current.apiKey,
    model:
      patch.model !== undefined && patch.model.trim()
        ? patch.model.trim()
        : current.model,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearDemoAiKey(): void {
  if (typeof window === "undefined") return;
  const current = readDemoAiSettings();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ apiKey: "", model: current.model }),
  );
}
