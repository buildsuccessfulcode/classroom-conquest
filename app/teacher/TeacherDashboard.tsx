"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { logoutTeacher } from "@/app/actions";
import ActivityLog from "@/components/ActivityLog";
import BoardStandings from "@/components/BoardStandings";
import CountdownTimer from "@/components/CountdownTimer";
import Leaderboard from "@/components/Leaderboard";
import Mascot from "@/components/Mascot";
import ModeBadge from "@/components/ModeBadge";
import type { ImporterSeed } from "@/components/QuestionBankImporter";
import QuestionBoard from "@/components/QuestionBoard";
import TimeWarningBanner from "@/components/TimeWarningBanner";

const AiSettingsPanel = dynamic(
  () => import("@/components/AiSettingsPanel"),
  { ssr: false },
);
const QuestionBankImporter = dynamic(
  () => import("@/components/QuestionBankImporter"),
  { ssr: false },
);
const QuestionGenerator = dynamic(
  () => import("@/components/QuestionGenerator"),
  { ssr: false },
);
const QuestionGroupList = dynamic(
  () => import("@/components/QuestionGroupList"),
  { ssr: false },
);
const SnakesBoard = dynamic(() => import("@/components/SnakesBoard"), {
  ssr: false,
});
import {
  ArrowLeftIcon,
  BookIcon,
  LogOutIcon,
  PlayIcon,
  RefreshIcon,
  SettingsIcon,
  StopIcon,
  TrashIcon,
} from "@/components/icons";
import { useGameState } from "@/hooks/useGameState";
import { useStoredValue, writeStoredValue } from "@/hooks/useLocalStorage";
import {
  createSession,
  deleteSession,
  endSession,
  listQuestionGroups,
  listSessions,
  resetSession,
  startSession,
} from "@/lib/backend";
import { formatDateTime } from "@/lib/format";
import {
  boardLinkTargets,
  buildBoardStandings,
  goalFromQuestionCount,
  minQuestionsForBoard,
} from "@/lib/game";
import type {
  BoardPreset,
  FinishRule,
  GameMode,
  QuestionGroupSummary,
  Session,
} from "@/lib/types";

const TEACHER_CODE_KEY = "classroom-conquest:teacher:code";
const TEACHER_TAB_KEY = "classroom-conquest:teacher:tab";

type Tab = "sesi" | "bank" | "settings";

const TABS: { id: Tab; label: string; icon: typeof PlayIcon }[] = [
  { id: "sesi", label: "Sesi", icon: PlayIcon },
  { id: "bank", label: "Bank Soal", icon: BookIcon },
  { id: "settings", label: "Pengaturan", icon: SettingsIcon },
];

const STATUS_LABEL: Record<string, string> = {
  LOBBY: "Menunggu",
  PLAYING: "Berjalan",
  ENDED: "Berakhir",
};

const STATUS_STYLE: Record<string, string> = {
  LOBBY: "bg-sun-soft text-sun-dark",
  PLAYING: "bg-brand-soft text-brand-dark",
  ENDED: "bg-cloud text-ink-soft",
};

export default function TeacherDashboard({
  initialSessions = null,
  initialGroups = null,
}: {
  initialSessions?: Session[] | null;
  initialGroups?: QuestionGroupSummary[] | null;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions ?? []);
  const selectedCode = useStoredValue(TEACHER_CODE_KEY);
  const setSelectedCode = useCallback((code: string | null) => {
    writeStoredValue(TEACHER_CODE_KEY, code);
  }, []);
  const storedTab = useStoredValue(TEACHER_TAB_KEY);
  const tab: Tab =
    storedTab === "bank" || storedTab === "settings" ? storedTab : "sesi";
  const setTab = useCallback((next: Tab) => {
    writeStoredValue(TEACHER_TAB_KEY, next);
  }, []);
  const [duration, setDuration] = useState("30");
  const [mode, setMode] = useState<GameMode>("CLASSIC");
  const [boardPreset, setBoardPreset] = useState<BoardPreset>("NORMAL");
  const [boardGoal, setBoardGoal] = useState("auto");
  const [finishRule, setFinishRule] = useState<FinishRule>("OVERSHOOT");
  const [groups, setGroups] = useState<QuestionGroupSummary[]>(
    initialGroups ?? [],
  );
  const [groupsLoaded, setGroupsLoaded] = useState(initialGroups !== null);
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importSeed, setImportSeed] = useState<ImporterSeed | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [bankResetToken, setBankResetToken] = useState(0);
  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedQuestionCount = selectedGroup?.question_count ?? 0;
  const maxBoardForGroup = goalFromQuestionCount(selectedQuestionCount);
  const previewGoal =
    boardGoal !== "auto" && Number(boardGoal)
      ? Math.min(Number(boardGoal), maxBoardForGroup)
      : maxBoardForGroup;
  const linkPreview =
    selectedQuestionCount >= minQuestionsForBoard()
      ? boardLinkTargets(previewGoal, boardPreset)
      : null;

  const { state, loading, error: stateError, reload } = useGameState(
    tab === "sesi" ? selectedCode : null,
  );
  const standings = useMemo(
    () => (state ? buildBoardStandings(state.teams, state.moves) : []),
    [state],
  );

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    }
  }, []);

  const refreshGroups = useCallback(async () => {
    try {
      setGroups(await listQuestionGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat group soal");
    } finally {
      setGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (initialSessions !== null && initialGroups !== null) return;
    void (async () => {
      const [sessionsResult, groupsResult] = await Promise.allSettled([
        listSessions(),
        listQuestionGroups(),
      ]);
      if (sessionsResult.status === "fulfilled") {
        setSessions(sessionsResult.value);
      } else {
        setError(
          sessionsResult.reason instanceof Error
            ? sessionsResult.reason.message
            : "Gagal memuat sesi",
        );
      }
      if (groupsResult.status === "fulfilled") {
        setGroups(groupsResult.value);
      } else {
        setError(
          groupsResult.reason instanceof Error
            ? groupsResult.reason.message
            : "Gagal memuat group soal",
        );
      }
      setGroupsLoaded(true);
    })();
  }, [initialGroups, initialSessions]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { code } = await createSession({
        groupId,
        durationMinutes: duration.trim() ? Number(duration) : 30,
        mode,
        boardPreset: mode === "SNAKES" ? boardPreset : undefined,
        boardGoal:
          mode === "SNAKES" && boardGoal !== "auto"
            ? Number(boardGoal)
            : undefined,
        finishRule: mode === "SNAKES" ? finishRule : undefined,
      });
      setSelectedCode(code);
      setMessage(`Sesi ${code} berhasil dibuat.`);
      await refreshSessions();
    });
  };

  const handleSessionAction = (
    action: "start" | "reset" | "end" | "delete",
  ) => {
    if (!selectedCode) return;
    void run(async () => {
      if (action === "start") await startSession(selectedCode);
      if (action === "reset") {
        const confirmed = window.confirm(
          "Reset sesi akan menghapus semua peserta, skor, dan log. Sesi kembali ke ruang tunggu dan harus dimulai ulang. Lanjutkan?",
        );
        if (!confirmed) return;
        await resetSession(selectedCode);
      }
      if (action === "end") await endSession(selectedCode);
      if (action === "delete") {
        await deleteSession(selectedCode);
        setSelectedCode(null);
      }
      await Promise.all([refreshSessions(), reload()]);
    });
  };

  const handleLogout = () => {
    void (async () => {
      await logoutTeacher();
      router.refresh();
    })();
  };

  const handleSendToImporter = (seed: {
    groupName: string;
    subject: string;
    raw: string;
  }) => {
    setImportSeed({ ...seed, token: Date.now() });
    setTab("bank");
  };

  const handleResetBank = () => {
    const confirmed = window.confirm(
      "Reset semua isian di halaman Bank Soal? Isian yang belum diimpor akan hilang.",
    );
    if (!confirmed) return;
    setImportSeed(null);
    setBankResetToken((value) => value + 1);
    setMessage(null);
    setError(null);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Mascot mood="happy" size={56} />
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-ocean-dark"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Beranda
            </Link>
            <h1 className="cc-display text-2xl font-extrabold text-ink sm:text-3xl">
              Dashboard Guru
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge />
          <button
            type="button"
            onClick={handleLogout}
            className="cc-btn border-cloud bg-white px-3 py-2 text-xs text-ink-soft"
          >
            <LogOutIcon className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-3xl border-2 border-cloud bg-white p-1.5">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "cc-btn flex-1 px-4 py-2.5 text-sm",
                active
                  ? "border-ocean-dark bg-ocean-soft text-ocean-dark"
                  : "border-transparent bg-transparent text-ink-soft",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {message ? (
        <p className="rounded-2xl border-2 border-brand-soft bg-brand-soft/50 px-4 py-2 text-sm font-bold text-brand-dark">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border-2 border-cherry-soft bg-cherry-soft/50 px-4 py-2 text-sm font-bold text-cherry-dark">
          {error}
        </p>
      ) : null}

      {tab === "sesi" && state ? <TimeWarningBanner session={state.session} /> : null}

      {tab === "sesi" ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="cc-card p-5">
              <h2 className="cc-display mb-4 text-xl font-extrabold text-ink">
                Buat Sesi Baru
              </h2>
              <form className="flex flex-col gap-4" onSubmit={handleCreate}>
                <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                  Group Soal
                  <select
                    value={groupId}
                    onChange={(event) => setGroupId(event.target.value)}
                    className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                    required
                  >
                    <option value="" disabled>
                      Pilih group soal
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.subject}) · {group.question_count} soal
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                  Mode Permainan
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["CLASSIC", "Klasik", "Kumpulkan poin"],
                        ["SNAKES", "Ular Tangga", "Balapan finis"],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={[
                          "flex flex-col items-start gap-0.5 rounded-2xl border-2 px-3 py-2 text-left transition",
                          mode === value
                            ? "border-ocean bg-ocean-soft"
                            : "border-cloud bg-white hover:border-ocean/60",
                        ].join(" ")}
                      >
                        <span className="text-sm font-extrabold text-ink">
                          {label}
                        </span>
                        <span className="text-[11px] font-semibold text-ink-soft">
                          {hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {mode === "SNAKES" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                      Kesulitan Papan
                      <select
                        value={boardPreset}
                        onChange={(event) =>
                          setBoardPreset(event.target.value as BoardPreset)
                        }
                        className="w-full rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                      >
                        <option value="MUDAH">Mudah</option>
                        <option value="NORMAL">Normal</option>
                        <option value="SULIT">Sulit</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                      Ukuran Papan
                      <select
                        value={boardGoal}
                        onChange={(event) => setBoardGoal(event.target.value)}
                        className="w-full rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                      >
                        <option value="auto">Otomatis</option>
                        <option value="30">30 petak</option>
                        <option value="50">50 petak</option>
                        <option value="100">100 petak</option>
                      </select>
                    </label>
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                      Aturan Finis
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            [
                              "OVERSHOOT",
                              "Lewat finis = menang",
                              "Cepat dan tegas",
                            ],
                            [
                              "EXACT",
                              "Finis Sempurna",
                              "Wajib pas, kelebihan mantul",
                            ],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFinishRule(value)}
                            className={[
                              "flex flex-col items-start gap-0.5 rounded-2xl border-2 px-3 py-2 text-left transition",
                              finishRule === value
                                ? "border-ocean bg-ocean-soft"
                                : "border-cloud bg-white hover:border-ocean/60",
                            ].join(" ")}
                          >
                            <span className="text-sm font-extrabold text-ink">
                              {label}
                            </span>
                            <span className="text-[11px] font-semibold text-ink-soft">
                              {hint}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
                  Durasi (menit)
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    className="w-full min-w-0 rounded-2xl border-2 border-cloud bg-snow p-3 font-bold text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/20"
                  />
                </label>
                <p className="text-xs font-semibold text-ink-soft">
                  {mode === "SNAKES"
                    ? "Langkah: soal Mudah 2-4, Sedang 5-8, Sulit 9-12 petak. Jumlah soal minimal 50% dari panjang papan. Komposisi tangga/ular mengikuti preset; mode Finis Sempurna bisa memperpanjang sesi."
                    : "Nomor soal mengikuti seluruh soal dalam group, dibuat otomatis saat sesi dibuat."}
                </p>
                {mode === "SNAKES" && groupId ? (
                  selectedQuestionCount < minQuestionsForBoard() ? (
                    <p className="rounded-2xl bg-cherry-soft px-3 py-2 text-xs font-bold text-cherry-dark">
                      Group ini punya {selectedQuestionCount} soal. Mode Ular
                      Tangga butuh minimal {minQuestionsForBoard()} soal.
                    </p>
                  ) : (
                    <p className="rounded-2xl bg-grape-soft px-3 py-2 text-xs font-bold text-grape-dark">
                      Dengan {selectedQuestionCount} soal, papan maksimal{" "}
                      {maxBoardForGroup} petak (jumlah soal = 50% bidang).
                      {linkPreview
                        ? ` Komposisi ${previewGoal} petak: ${linkPreview.ladders} tangga, ${linkPreview.snakes} ular.`
                        : ""}
                    </p>
                  )
                ) : null}
                {groupsLoaded && groups.length === 0 ? (
                  <p className="rounded-2xl bg-sun-soft px-3 py-2 text-xs font-bold text-sun-dark">
                    Belum ada group soal. Impor soal di tab Bank Soal.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !groupsLoaded || groups.length === 0}
                  suppressHydrationWarning
                  className="cc-btn border-brand-dark bg-brand p-3.5 text-white"
                >
                  Buat Sesi
                </button>
              </form>
            </section>

            <section className="cc-card p-5">
              <h2 className="cc-display mb-4 text-xl font-extrabold text-ink">
                Sesi Terbaru
              </h2>
              <ul className="flex flex-col gap-2">
                {sessions.length === 0 ? (
                  <li className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
                    Belum ada sesi.
                  </li>
                ) : (
                  sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCode(session.session_code)}
                        className={[
                          "flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border-2 px-3 py-2.5 text-left text-sm transition",
                          selectedCode === session.session_code
                            ? "border-ocean bg-ocean-soft"
                            : "border-cloud bg-white hover:border-ocean/60",
                        ].join(" ")}
                      >
                        <span className="shrink-0 font-mono font-extrabold text-ink">
                          {session.session_code}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink-soft">
                          {session.subject_name}
                        </span>
                        <span className="shrink-0 rounded-full bg-snow px-2 py-0.5 text-[10px] font-extrabold text-ink-soft">
                          {session.game_mode === "SNAKES" ? "Ular" : "Klasik"}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-ink-soft">
                          {formatDateTime(session.created_at)}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <section className="cc-card p-5">
              {!selectedCode ? (
                <p className="rounded-2xl bg-snow px-4 py-10 text-center text-sm font-bold text-ink-soft">
                  Pilih atau buat sesi untuk mulai memantau.
                </p>
              ) : loading && !state ? (
                <p className="text-sm font-bold text-ink-soft">Memuat sesi...</p>
              ) : stateError || !state ? (
                <p className="text-sm font-bold text-cherry-dark">
                  {stateError ?? "Sesi tidak ditemukan"}
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                        Kode Sesi
                      </p>
                      <p className="cc-display font-mono text-4xl font-extrabold tracking-[0.2em] text-ocean-dark">
                        {state.session.session_code}
                      </p>
                      <p className="text-xs font-bold text-ink-soft">
                        {state.session.game_mode === "SNAKES"
                          ? `Mode Ular Tangga · ${
                              state.session.board_config?.goal ?? "-"
                            } petak`
                          : "Mode Klasik"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
                          STATUS_STYLE[state.session.status] ??
                          "bg-cloud text-ink-soft"
                        }`}
                      >
                        {STATUS_LABEL[state.session.status] ?? state.session.status}
                      </span>
                      <CountdownTimer
                        session={state.session}
                        size="md"
                        onExpire={() => void reload()}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || state.session.status === "PLAYING"}
                      onClick={() => handleSessionAction("start")}
                      className="cc-btn border-brand-dark bg-brand px-4 py-2.5 text-sm text-white"
                    >
                      <PlayIcon className="h-4 w-4" />
                      Mulai
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSessionAction("reset")}
                      className="cc-btn border-mango-dark bg-mango px-4 py-2.5 text-sm text-white"
                    >
                      <RefreshIcon className="h-4 w-4" />
                      Reset
                    </button>
                    <button
                      type="button"
                      disabled={busy || state.session.status === "ENDED"}
                      onClick={() => handleSessionAction("end")}
                      className="cc-btn border-cloud bg-white px-4 py-2.5 text-sm text-ink-soft"
                    >
                      <StopIcon className="h-4 w-4" />
                      Akhiri
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSessionAction("delete")}
                      className="cc-btn border-cherry-dark bg-cherry px-4 py-2.5 text-sm text-white"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Hapus
                    </button>
                  </div>

                  {state.session.game_mode === "SNAKES" ? (
                    state.session.board_config ? (
                      <div className="grid min-w-0 gap-4 md:grid-cols-[1.2fr_1fr]">
                        <div className="min-w-0">
                          <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                            Papan Ular Tangga (
                            {state.session.board_config.goal} petak)
                          </h3>
                          <SnakesBoard
                            config={state.session.board_config}
                            teams={state.teams}
                            moves={state.moves}
                          />
                          <p className="mt-2 text-xs font-semibold text-ink-soft">
                            Garis hijau = tangga naik, garis merah = ular turun.
                            Efek hanya aktif bila bidak berhenti tepat di
                            petaknya.
                          </p>
                        </div>
                        <div className="flex min-w-0 flex-col gap-4">
                          <div>
                            <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                              Posisi Tim
                            </h3>
                            <BoardStandings
                              teams={state.teams}
                              config={state.session.board_config}
                              moves={state.moves}
                              standings={standings}
                            />
                          </div>
                          <div>
                            <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                              Aktivitas
                            </h3>
                            <ActivityLog logs={state.logs} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
                        Papan ular tangga belum tersedia.
                      </p>
                    )
                  ) : state.slots.length === 0 ? (
                    <p className="rounded-2xl bg-snow px-4 py-6 text-center text-sm font-bold text-ink-soft">
                      Sesi ini belum memiliki nomor soal. Buat sesi baru dari
                      group yang sudah berisi soal.
                    </p>
                  ) : (
                    <div className="grid min-w-0 gap-4 md:grid-cols-[1.2fr_1fr]">
                      <div className="min-w-0">
                        <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                          Papan Nomor ({state.slots.length} soal)
                        </h3>
                        <QuestionBoard
                          mode="display"
                          totalSlots={state.slots.length}
                          teams={state.teams}
                          answers={state.answers}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-4">
                        <div>
                          <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                            Peringkat
                          </h3>
                          <Leaderboard
                            teams={state.teams}
                            answers={state.answers}
                            totalSlots={state.slots.length}
                            variant="list"
                          />
                        </div>
                        <div>
                          <h3 className="cc-display mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                            Aktivitas
                          </h3>
                          <ActivityLog logs={state.logs} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === "bank" ? (
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-soft">
              Generate atau impor soal, lalu kelola group yang tersimpan.
            </p>
            <button
              type="button"
              onClick={handleResetBank}
              className="cc-btn border-cloud bg-white px-3 py-2 text-xs text-ink-soft"
            >
              <RefreshIcon className="h-4 w-4" />
              Reset Isian
            </button>
          </div>
          <QuestionGenerator
            key={`generator-${bankResetToken}`}
            onSendToImporter={handleSendToImporter}
            onOpenSettings={() => setTab("settings")}
            refreshToken={settingsVersion}
          />
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <QuestionBankImporter
              key={`${importSeed?.token ?? "importer"}:${bankResetToken}`}
              onImported={refreshGroups}
              initialGroupName={importSeed?.groupName}
              initialSubject={importSeed?.subject}
              initialRaw={importSeed?.raw}
            />
            <QuestionGroupList groups={groups} onChanged={refreshGroups} />
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_1fr]">
          <AiSettingsPanel onChanged={() => setSettingsVersion((v) => v + 1)} />
          <section className="cc-card p-5">
            <h2 className="cc-display mb-4 text-xl font-extrabold text-ink">
              Bantuan Cepat
            </h2>
            <ul className="flex flex-col gap-3 text-sm font-semibold text-ink-soft">
              <li>
                Buat API key gratis di{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="font-extrabold text-ocean-dark underline"
                >
                  Google AI Studio
                </a>
                , lalu tempel di kolom API key.
              </li>
              <li>
                Soal yang di-generate tetap dapat disalin dan diimpor manual di
                tab Bank Soal.
              </li>
              <li>
                Ingin menyusun soal sendiri? Unduh{" "}
                <a
                  href="/sample-questions.json"
                  download
                  className="font-extrabold text-ocean-dark underline"
                >
                  contoh JSON
                </a>{" "}
                sebagai acuan format.
              </li>
              <li>
                Panduan lengkap format soal ada di{" "}
                <span className="font-mono">docs/PROMPT_GENERATE_SOAL.md</span>.
              </li>
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}
