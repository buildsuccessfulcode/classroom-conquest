export const LITE_STORAGE_KEY = "classroom-conquest:lite";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeLite(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LITE_STORAGE_KEY) applyLitePreference();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function liteSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.lite === "true";
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

function autoLite(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }
  const nav = navigator as NavigatorWithHints;
  const connection = nav.connection;
  if (connection?.saveData) return true;
  if (
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "3g"
  ) {
    return true;
  }
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) {
    return true;
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) {
    return true;
  }
  return false;
}

export function shouldUseLite(): boolean {
  if (typeof window === "undefined") return false;
  const override = window.localStorage.getItem(LITE_STORAGE_KEY);
  if (override === "on") return true;
  if (override === "off") return false;
  return autoLite();
}

export function applyLitePreference(): boolean {
  if (typeof window === "undefined") return false;
  const lite = shouldUseLite();
  document.documentElement.dataset.lite = lite ? "true" : "false";
  notify();
  return lite;
}
