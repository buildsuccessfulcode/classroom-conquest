"use client";

import { useRef, useState } from "react";
import { importQuestions } from "@/lib/backend";
import { parseQuestionBank } from "@/lib/questions";
import type { SeedQuestion } from "@/lib/types";
import { UploadIcon } from "./icons";

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
      setNote(`${result.inserted} soal diimpor ke group ${result.groupName}.`);
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
    <section className="cc-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="cc-display text-xl font-extrabold text-ink">
          Impor Bank Soal
        </h2>
        <a
          href="/sample-questions.json"
          download
          className="text-sm font-extrabold text-ocean-dark underline"
        >
          Unduh contoh JSON
        </a>
      </div>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          className="rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          placeholder="Nama group (mis. English Bab 1)"
          required
        />
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          placeholder="Mata pelajaran"
          required
        />
        <p className="text-xs font-semibold text-ink-soft">
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
            "flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-5 text-center text-sm font-semibold transition",
            dragging
              ? "border-ocean bg-ocean-soft"
              : "border-cloud bg-snow text-ink-soft",
          ].join(" ")}
        >
          <UploadIcon className="h-6 w-6 text-ocean" />
          <p>
            Seret file <span className="font-mono">.json</span> ke sini
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-extrabold text-ocean-dark underline"
          >
            atau pilih file
          </button>
          {fileName ? (
            <p className="font-mono text-xs text-ink-soft">{fileName}</p>
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
          className="rounded-2xl border-2 border-cloud bg-snow p-3 font-mono text-xs text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          placeholder='Atau tempel JSON di sini: [{"type":"MULTIPLE_CHOICE","difficulty":"EASY","question_text":"...","metadata":{"options":["A","B"]},"correct_answer":"A"}]'
        />

        <button
          type="submit"
          disabled={busy}
          className="cc-btn border-ocean-dark bg-ocean p-3 text-white"
        >
          {busy ? "Mengimpor..." : "Impor Soal"}
        </button>
        {note ? (
          <p className="rounded-2xl bg-brand-soft px-3 py-2 text-sm font-bold text-brand-dark">
            {note}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
