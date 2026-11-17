"use client";

import { useEffect, useMemo, useState } from "react";
import { generateQuestions, getAiSettings } from "@/lib/backend";
import { pointsFor } from "@/lib/game";
import type {
  Difficulty,
  GeneratedQuestionBank,
  QuestionType,
  SeedQuestion,
} from "@/lib/types";
import { CopyIcon, KeyIcon, SparkleIcon, UploadIcon, WandIcon } from "./icons";

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Pilihan ganda" },
  { value: "SHORT_ANSWER", label: "Isian singkat" },
  { value: "REARRANGE_WORDS", label: "Susun kata" },
];

const ALL_TYPES: QuestionType[] = [
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "REARRANGE_WORDS",
];

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Pilihan ganda",
  SHORT_ANSWER: "Isian",
  REARRANGE_WORDS: "Susun kata",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Mudah",
  MEDIUM: "Sedang",
  HARD: "Sulit",
};

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: "bg-brand-soft text-brand-dark",
  MEDIUM: "bg-mango-soft text-mango-dark",
  HARD: "bg-cherry-soft text-cherry-dark",
};

function autoDistribution(count: number): {
  EASY: number;
  MEDIUM: number;
  HARD: number;
} {
  const safe = Math.max(1, Math.round(count) || 0);
  const easy = Math.max(1, Math.round(safe * 0.4));
  const medium = Math.max(1, Math.round(safe * 0.35));
  const hard = Math.max(1, safe - easy - medium);
  return { EASY: easy, MEDIUM: medium, HARD: hard };
}

function toTextDistribution(distribution: {
  EASY: number;
  MEDIUM: number;
  HARD: number;
}): Record<Difficulty, string> {
  return {
    EASY: String(distribution.EASY),
    MEDIUM: String(distribution.MEDIUM),
    HARD: String(distribution.HARD),
  };
}

function toInt(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export default function QuestionGenerator({
  onSendToImporter,
  onOpenSettings,
  refreshToken,
}: {
  onSendToImporter: (seed: {
    groupName: string;
    subject: string;
    raw: string;
  }) => void;
  onOpenSettings: () => void;
  refreshToken?: number;
}) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("");
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [countText, setCountText] = useState("10");
  const [distributionText, setDistributionText] = useState(() =>
    toTextDistribution(autoDistribution(10)),
  );
  const [types, setTypes] = useState<QuestionType[]>(ALL_TYPES);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedQuestionBank | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getAiSettings();
        setHasKey(settings.hasKey);
      } catch {
        setHasKey(false);
      }
    })();
  }, [refreshToken]);

  const count = countText.trim() ? Number(countText) : NaN;
  const distribution: Record<Difficulty, number> = {
    EASY: toInt(distributionText.EASY),
    MEDIUM: toInt(distributionText.MEDIUM),
    HARD: toInt(distributionText.HARD),
  };
  const distributionTotal =
    distribution.EASY + distribution.MEDIUM + distribution.HARD;
  const distributionValid =
    Number.isFinite(count) && count >= 1 && distributionTotal === count;
  const effectiveTypes = types.length > 0 ? types : ALL_TYPES;
  const canGenerate =
    hasKey === true &&
    subject.trim().length > 0 &&
    distributionValid &&
    !busy;

  const handleCountChange = (value: string) => {
    setCountText(value);
    const next = Number(value);
    if (value.trim() && Number.isFinite(next) && next >= 1) {
      setDistributionText(toTextDistribution(autoDistribution(next)));
    }
  };

  const handleDistributionChange = (key: Difficulty, value: string) => {
    setDistributionText((prev) => ({ ...prev, [key]: value }));
  };

  const handleEvenDistribution = () => {
    if (Number.isFinite(count) && count >= 1) {
      setDistributionText(toTextDistribution(autoDistribution(count)));
    }
  };

  const toggleType = (type: QuestionType) => {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  };

  const handleGenerate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canGenerate) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    void (async () => {
      try {
        const generated = await generateQuestions({
          subject: subject.trim(),
          topic: topic.trim(),
          grade: grade.trim(),
          language,
          count,
          distribution,
          types: effectiveTypes,
        });
        setResult(generated);
        setEditingIndex(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal generate soal");
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleCopy = () => {
    if (!result) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(result.raw);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Gagal menyalin. Salin manual dari kotak JSON.");
      }
    })();
  };

  const handleSend = () => {
    if (!result) return;
    const name =
      groupName.trim() ||
      `${subject.trim()} ${topic.trim()}`.trim() ||
      "Bank Soal AI";
    onSendToImporter({
      groupName: name,
      subject: subject.trim() || "Umum",
      raw: result.raw,
    });
  };

  const updateResult = (
    updater: (questions: SeedQuestion[]) => SeedQuestion[],
  ) => {
    setResult((prev) => {
      if (!prev) return prev;
      const questions = updater(prev.questions);
      return { ...prev, questions, raw: JSON.stringify(questions, null, 2) };
    });
  };

  const updateQuestion = (index: number, patch: Partial<SeedQuestion>) => {
    updateResult((list) =>
      list.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateOptions = (index: number, text: string) => {
    const options = text
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);
    updateResult((list) =>
      list.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, metadata: { ...(item.metadata ?? {}), options } }
          : item,
      ),
    );
  };

  const updateWords = (index: number, text: string) => {
    const words = text
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
    updateResult((list) =>
      list.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, metadata: { ...(item.metadata ?? {}), words } }
          : item,
      ),
    );
  };

  const removeGeneratedQuestion = (index: number) => {
    updateResult((list) => list.filter((_, itemIndex) => itemIndex !== index));
    setEditingIndex(null);
  };

  const distributionFields = useMemo(
    () =>
      (
        [
          ["EASY", "Mudah"],
          ["MEDIUM", "Sedang"],
          ["HARD", "Sulit"],
        ] as [Difficulty, string][]
      ).map(([key, label]) => ({ key, label })),
    [],
  );

  return (
    <section className="cc-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-grape-soft text-grape-dark">
            <WandIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="cc-display text-xl font-extrabold text-ink">
              Generate Soal AI
            </h2>
            <p className="text-xs font-semibold text-ink-soft">
              Buat template soal dengan Gemini, lalu impor.
            </p>
          </div>
        </div>
      </div>

      {hasKey === false ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-sun-dark">
            <KeyIcon className="h-4 w-4" />
            API key Gemini belum diatur.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="cc-btn border-sun-dark bg-sun px-3 py-2 text-xs text-ink"
          >
            Atur API Key
          </button>
        </div>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={handleGenerate}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
            Mata pelajaran
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="mis. English"
              required
              className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
            Jenjang / kelas
            <input
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              placeholder="mis. SMP kelas 8"
              className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
          <span>
            Materi / topik{" "}
            <span className="font-semibold text-ink-soft">(opsional)</span>
          </span>
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            rows={2}
            placeholder="mis. Recount Text — biarkan kosong agar AI memilih materi"
            className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
            Bahasa
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value === "en" ? "en" : "id")
              }
              className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
            >
              <option value="id">Indonesia</option>
              <option value="en">Inggris</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
            Jumlah soal
            <input
              type="number"
              min={1}
              max={50}
              value={countText}
              onChange={(event) => handleCountChange(event.target.value)}
              className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-ink">
              Distribusi kesulitan
            </span>
            <button
              type="button"
              onClick={handleEvenDistribution}
              className="text-xs font-extrabold text-ocean-dark underline"
            >
              Bagi rata
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {distributionFields.map(({ key, label }) => (
              <label
                key={key}
                className="flex flex-col gap-1 text-xs font-extrabold text-ink-soft"
              >
                {label}
                <input
                  type="number"
                  min={0}
                  value={distributionText[key]}
                  onChange={(event) =>
                    handleDistributionChange(key, event.target.value)
                  }
                  className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-2.5 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                />
              </label>
            ))}
          </div>
          {!distributionValid ? (
            <p className="text-xs font-bold text-cherry-dark">
              Total distribusi {distributionTotal} harus sama dengan jumlah soal{" "}
              {Number.isFinite(count) ? count : "yang valid"}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-ink">
            Tipe soal{" "}
            <span className="font-semibold text-ink-soft">(opsional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((option) => {
              const active = types.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleType(option.value)}
                  className={[
                    "cc-btn px-3 py-2 text-xs",
                    active
                      ? "border-ocean-dark bg-ocean-soft text-ocean-dark"
                      : "border-cloud bg-white text-ink-soft",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {types.length === 0 ? (
            <p className="text-xs font-semibold text-ink-soft">
              Tidak ada tipe dipilih, semua tipe akan dipakai.
            </p>
          ) : null}
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
          Nama group untuk impor
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="mis. English Bab 1"
            className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 text-sm font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
          />
        </label>

        <button
          type="submit"
          disabled={!canGenerate}
          className="cc-btn border-grape-dark bg-grape p-3.5 text-white"
        >
          <SparkleIcon className="h-4 w-4" />
          {busy ? "Membuat soal..." : "Generate Soal"}
        </button>

        {error ? (
          <p className="rounded-2xl bg-cherry-soft px-3 py-2 text-sm font-bold text-cherry-dark">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <div className="mt-5 flex flex-col gap-4 border-t-2 border-cloud pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="cc-display text-lg font-extrabold text-ink">
              Hasil ({result.questions.length} soal)
            </h3>
            <span className="rounded-full bg-grape-soft px-3 py-1 text-xs font-extrabold text-grape-dark">
              {result.model}
            </span>
          </div>

          <ul className="cc-scrollbar flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {result.questions.map((question, index) => (
              <li
                key={index}
                className="rounded-2xl border-2 border-cloud bg-snow px-3 py-2.5"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-ink-soft">
                    #{index + 1}
                  </span>
                  <span className="rounded-full bg-ocean-soft px-2 py-0.5 text-xs font-extrabold text-ocean-dark">
                    {TYPE_LABEL[question.type] ?? question.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                      DIFFICULTY_STYLE[question.difficulty] ??
                      "bg-cloud text-ink-soft"
                    }`}
                  >
                    {DIFFICULTY_LABEL[question.difficulty] ??
                      question.difficulty}
                  </span>
                  <span className="text-xs font-bold text-ink-soft">
                    {question.points} XP
                  </span>
                </div>
                {editingIndex === index ? (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-xs font-extrabold text-ink-soft">
                      Teks soal
                      <textarea
                        value={question.question_text}
                        onChange={(event) =>
                          updateQuestion(index, {
                            question_text: event.target.value,
                          })
                        }
                        rows={2}
                        className="w-full min-w-0 rounded-xl border-2 border-cloud bg-white p-2 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                      />
                    </label>
                    {question.type === "MULTIPLE_CHOICE" ? (
                      <label className="flex flex-col gap-1 text-xs font-extrabold text-ink-soft">
                        Opsi (satu per baris)
                        <textarea
                          value={(question.metadata?.options ?? []).join("\n")}
                          onChange={(event) =>
                            updateOptions(index, event.target.value)
                          }
                          rows={Math.max(2, question.metadata?.options?.length ?? 2)}
                          className="w-full min-w-0 rounded-xl border-2 border-cloud bg-white p-2 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                        />
                      </label>
                    ) : null}
                    {question.type === "REARRANGE_WORDS" ? (
                      <label className="flex flex-col gap-1 text-xs font-extrabold text-ink-soft">
                        Kata (pisahkan dengan koma)
                        <input
                          value={(question.metadata?.words ?? []).join(", ")}
                          onChange={(event) =>
                            updateWords(index, event.target.value)
                          }
                          className="w-full min-w-0 rounded-xl border-2 border-cloud bg-white p-2 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                        />
                      </label>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-extrabold text-ink-soft">
                        Jawaban benar
                        <input
                          value={question.correct_answer}
                          onChange={(event) =>
                            updateQuestion(index, {
                              correct_answer: event.target.value,
                            })
                          }
                          className="w-full min-w-0 rounded-xl border-2 border-cloud bg-white p-2 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-extrabold text-ink-soft">
                        Kesulitan
                        <select
                          value={question.difficulty}
                          onChange={(event) =>
                            updateQuestion(index, {
                              difficulty: event.target.value as Difficulty,
                              points: pointsFor(
                                event.target.value as Difficulty,
                              ),
                            })
                          }
                          className="w-full min-w-0 rounded-xl border-2 border-cloud bg-white p-2 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                        >
                          <option value="EASY">Mudah</option>
                          <option value="MEDIUM">Sedang</option>
                          <option value="HARD">Sulit</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="cc-btn border-brand-dark bg-brand px-3 py-1.5 text-xs text-white"
                      >
                        Selesai
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGeneratedQuestion(index)}
                        className="cc-btn border-cherry-dark bg-cherry-soft px-3 py-1.5 text-xs text-cherry-dark"
                      >
                        Hapus soal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink">
                      {question.question_text}
                    </p>
                    {question.metadata?.code_snippet ? (
                      <pre className="mt-1 overflow-x-auto rounded-xl bg-ink/90 p-2 font-mono text-xs text-white">
                        {question.metadata.code_snippet}
                      </pre>
                    ) : null}
                    {question.metadata?.options ? (
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {question.metadata.options.map((option, optionIndex) => (
                          <li
                            key={optionIndex}
                            className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-ink-soft"
                          >
                            {option}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {question.metadata?.words ? (
                      <p className="mt-1 text-xs font-semibold text-ink-soft">
                        Kata: {question.metadata.words.join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs font-extrabold text-brand-dark">
                      Jawaban: {question.correct_answer}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingIndex(index)}
                      className="mt-1 text-xs font-extrabold text-ocean-dark underline"
                    >
                      Ubah soal
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <textarea
            readOnly
            value={result.raw}
            rows={5}
            className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 font-mono text-xs text-ink outline-none"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="cc-btn border-cloud bg-white px-4 py-2.5 text-sm text-ink-soft"
            >
              <CopyIcon className="h-4 w-4" />
              {copied ? "Tersalin" : "Salin JSON"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="cc-btn border-brand-dark bg-brand px-4 py-2.5 text-sm text-white"
            >
              <UploadIcon className="h-4 w-4" />
              Kirim ke Impor
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
