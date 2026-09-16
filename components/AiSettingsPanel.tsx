"use client";

import { useEffect, useState } from "react";
import {
  clearAiKey,
  getAiSettings,
  listGeminiModels,
  saveAiSettings,
} from "@/lib/backend";
import type { AiSettings, GeminiModel } from "@/lib/types";
import { CheckIcon, KeyIcon, RefreshIcon, RobotIcon, TrashIcon } from "./icons";

export default function AiSettingsPanel({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const current = await getAiSettings();
        setSettings(current);
        setModel(current.model);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat pengaturan");
      }
    })();
  }, []);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    void (async () => {
      try {
        const next = await saveAiSettings({
          apiKey: apiKey.trim() || undefined,
          model: model.trim() || undefined,
        });
        setSettings(next);
        setModel(next.model);
        setApiKey("");
        setMessage("Pengaturan Gemini disimpan.");
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyimpan");
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleClear = () => {
    if (!window.confirm("Hapus API key Gemini yang tersimpan?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    void (async () => {
      try {
        const next = await clearAiKey();
        setSettings(next);
        setMessage("API key dihapus.");
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menghapus");
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleLoadModels = () => {
    setLoadingModels(true);
    setError(null);
    setMessage(null);
    void (async () => {
      try {
        const list = await listGeminiModels(apiKey.trim() || undefined);
        setModels(list);
        setMessage(`${list.length} model tersedia.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat model");
      } finally {
        setLoadingModels(false);
      }
    })();
  };

  return (
    <section className="cc-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ocean-soft text-ocean-dark">
          <RobotIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="cc-display text-xl font-extrabold text-ink">
            Integrasi Gemini
          </h2>
          <p className="text-xs font-semibold text-ink-soft">
            API key dipakai server untuk generate soal.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-snow px-4 py-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            settings?.hasKey
              ? "bg-brand-soft text-brand-dark"
              : "bg-cloud text-ink-soft"
          }`}
        >
          <KeyIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-ink">
            {settings?.hasKey ? "API key aktif" : "API key belum diatur"}
          </p>
          <p className="truncate font-mono text-xs font-semibold text-ink-soft">
            {settings?.maskedKey ?? "Belum ada key tersimpan"}
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSave}>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
          API key Gemini
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
            placeholder={
              settings?.hasKey ? "Kosongkan bila tidak ingin mengganti" : "AIza..."
            }
            className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 font-mono text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
          Model
          <input
            list="gemini-models"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="gemini-2.5-flash"
            className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 font-mono text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          />
          <datalist id="gemini-models">
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </datalist>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleLoadModels}
            disabled={loadingModels || busy}
            className="cc-btn border-cloud bg-white px-4 py-2.5 text-sm text-ink-soft"
          >
            <RefreshIcon className="h-4 w-4" />
            {loadingModels ? "Memuat..." : "Muat daftar model"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="cc-btn border-ocean-dark bg-ocean px-4 py-2.5 text-sm text-white"
          >
            <CheckIcon className="h-4 w-4" />
            Simpan
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={busy || !settings?.hasKey}
            className="cc-btn border-cherry-dark bg-cherry px-4 py-2.5 text-sm text-white"
          >
            <TrashIcon className="h-4 w-4" />
            Hapus API Key
          </button>
        </div>

        {message ? (
          <p className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-bold text-brand-dark">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
            {error}
          </p>
        ) : null}
      </form>

      <p className="mt-4 text-xs font-semibold text-ink-soft">
        Dapatkan API key gratis di Google AI Studio. Di mode Supabase, key
        disimpan di tabel <span className="font-mono">app_settings</span> dan
        hanya bisa dibaca server. Di mode demo, key disimpan di localStorage
        perangkat ini.
      </p>
    </section>
  );
}
