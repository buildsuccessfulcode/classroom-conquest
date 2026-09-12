"use client";

import { useRef, useState } from "react";
import { importQuestions } from "@/lib/backend";
import { parseQuestionBank } from "@/lib/questions";
import type { SeedQuestion } from "@/lib/types";

const MAX_FILE_BYTES = 1_000_000;

export default function QuestionBankImporter({
  onImported,
}: {
  onImported?: () => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [subject, setSubject] = useState("English");
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setError(null);
    setNote(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Format file harus .json");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Ukuran file maksimal 1 MB");
      return;
    }
    try {
      const text = await file.text();
      const preview = parseQuestionBank(text);
      setRaw(text);
      setFileName(file.name);
      setNote(
        `${preview.length} soal terbaca dari ${file.name}. Klik "Impor Soal" untuk menyimpan.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNote(null);
    let questions: SeedQuestion[];
    try {
      questions = parseQuestionBank(raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Data soal tidak valid");
      return;
    }
    setBusy(true);
    try {
      const result = await importQuestions({ groupName, subject, questions });
      setNote(
        `${result.inserted} soal diimpor ke group ${result.groupName}.`,
      );
      setRaw("");
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor soal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Impor Bank Soal</h2>
        <a
          href="/sample-questions.json"
          download
          className="text-sm font-semibold text-indigo-600 underline dark:text-indigo-400"
        >
          Unduh contoh JSON
        </a>
      </div>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Nama group (mis. English Bab 1)"
          required
        />
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Mata pelajaran"
          required
        />
        <p className="text-xs text-slate-500">
          Nama group yang sudah ada akan ditambahi soal baru.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void readFile(file);
          }}
          className={[
            "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm transition",
            dragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-slate-800"
              : "border-slate-300 dark:border-slate-600",
          ].join(" ")}
        >
          <p className="text-slate-600 dark:text-slate-300">
            Seret file <span className="font-mono">.json</span> ke sini
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-indigo-600 underline dark:text-indigo-400"
          >
            atau pilih file
          </button>
          {fileName ? (
            <p className="font-mono text-xs text-slate-500">{fileName}</p>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </div>

        <textarea
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setFileName(null);
          }}
          rows={6}
          className="rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder='Atau tempel JSON di sini: [{"type":"MULTIPLE_CHOICE","difficulty":"EASY","question_text":"...","metadata":{"options":["A","B"]},"correct_answer":"A"}]'
        />

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-indigo-500 p-2 font-bold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-400 dark:hover:bg-slate-800"
        >
          {busy ? "Mengimpor..." : "Impor Soal"}
        </button>
        {note ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {note}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </form>
    </section>
  );
}
