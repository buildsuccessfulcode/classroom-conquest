# Classroom Conquest — Rencana Implementasi

Dokumen teknis pendukung: [`docs/`](../docs/).

> **Catatan revisi:** versi awal memakai konsep peta wilayah (grid 3x3–5x5, klaim/serang).
> Konsep itu **diganti** dengan papan nomor soal karena dinilai lebih adil. Rencana di bawah
> adalah versi terkini.

## 1. Ringkasan Keputusan

| Topik | Keputusan |
| :--- | :--- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | TailwindCSS v4 (`@import "tailwindcss"`) |
| Backend | Supabase (PostgreSQL + Realtime) — mode utama |
| Mode cadangan | Demo/offline `localStorage` + `BroadcastChannel` |
| Bahasa UI | Bahasa Indonesia |
| Mutasi data | Server Actions memakai service role (server-only) |
| Baca + realtime | Supabase browser client (anon key, RLS SELECT) |
| Jawaban benar | Tidak pernah dikirim ke browser; divalidasi di server/demo |

## 2. Konsep Permainan

- Tidak ada peta. Papan = **nomor soal 1..N**, N = seluruh bank soal mapel.
- Snapshot nomor dibuat saat **Mulai Sesi** (`session_questions`).
- Tiap tim menjawab semua nomor secara **mandiri** (bukan rebutan).
- Bebas pilih nomor; salah tanpa penalti, maksimal 2 percobaan per nomor lalu terkunci
  (`MAX_ATTEMPTS_PER_SLOT`).
- Poin: EASY 100, MEDIUM 150, HARD 200.
- Peringkat: poin desc → `lastAnsweredAt` asc → nama.
- Timer sesi ditegakkan di server.

## 3. Struktur Folder

```
app/
  layout.tsx / page.tsx / globals.css
  teacher/page.tsx           # cek cookie (server) -> TeacherDashboard (client)
  play/page.tsx              # shell server -> PlayClient.tsx (client)
  display/page.tsx           # shell server -> DisplayClient.tsx (client, ?code=XXXXXX)
  actions.ts                 # server actions (mutasi, RPC)
components/
  QuestionBoard.tsx          # papan nomor soal (display & play)
  Leaderboard.tsx            # peringkat poin + progres
  ActivityLog.tsx
  QuestionCard.tsx           # 3 tipe soal + mode read-only (review)
  QuestionBankImporter.tsx   # impor file/paste JSON
  Skeleton.tsx / RuntimeOptimizations.tsx
  ModeBadge.tsx
hooks/
  useGameState.ts            # state + Broadcast + delta + rekonsiliasi
  useServerNow.ts            # clock global bersama
  useLocalStorage.ts         # useSyncExternalStore
  useTeamIdentity.ts
lib/
  types.ts / game.ts / questions.ts / backend.ts / config.ts
  clock.ts / feedback.ts / colors.ts / format.ts
  supabase/{client,server}.ts
  demo/engine.ts
public/
  sw.js                      # service worker cache aset statis
supabase/
  schema.sql / migration_optimizations.sql / seed.sql / sample-questions.json
docs/ plans/
```

## 4. Fase Pengerjaan (status)

### Fase 0 — Fondasi
- [x] Baca dokumentasi Next.js 16 lokal.
- [x] Arsitektur dual-mode.
- [x] `plans/` dan `docs/`.
- [x] Konfigurasi opencode hemat token.

### Fase 1 — Redesain konsep (nomor soal)
- [x] `lib/types.ts`: `SessionSlot`, `Answer`, `GameState` baru; hapus tipe wilayah.
- [x] `lib/game.ts`: `buildLeaderboard` (poin + tie-break `lastAnsweredAt`); hapus tile.
- [x] `supabase/schema.sql`: `session_questions`, `answers`; hapus `territories`/`grid_size`.
- [x] `app/actions.ts`: `ensureSlots`, `requestQuestion`, `submitAnswer` baru; timer di server.
- [x] `lib/demo/engine.ts` (v2) + `lib/backend.ts` disesuaikan.
- [x] `components/QuestionBoard.tsx`; `Leaderboard` diperbarui; `QuestionCard` mode review.
- [x] Halaman `/teacher`, `/play`, `/display`, landing disesuaikan.
- [x] `GridMap.tsx` dihapus.

### Fase 2 — Impor bank soal
- [x] `lib/questions.ts` (`parseQuestionBank`) validasi per tipe.
- [x] `components/QuestionBankImporter.tsx` (unggah file, drag & drop, paste, template).
- [x] `public/sample-questions.json`.

### Fase 3 — Dokumen
- [x] `docs/PROMPT_GENERATE_SOAL.md` (prompt generate soal per mapel & materi).
- [x] Perbarui ARCHITECTURE, DATABASE, GAME_RULES, API, CONTEXT, SETUP, README.
- [x] Perbarui plans + README root.

### Fase 4 — Verifikasi
- [x] `npm run lint`
- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] Smoke test dev (semua rute 200, mode demo)

### Fase 5 — Optimasi performa realtime (Sprint 1–2)
- [x] Realtime hybrid: trigger `realtime.send` (`answer.created`, `team.joined`,
  `session.updated`) + hapus `postgres_changes`; `activity_logs` tidak di-broadcast.
- [x] `useGameState`: koalesensi 200 ms, guard urutan, delta patch, rekonsiliasi 15 s,
  refetch saat fokus/`online`.
- [x] Clock server: `lib/clock.ts` + `hooks/useServerNow.ts` (satu interval global);
  `CountdownTimer`/`TimeWarningBanner` pakai `serverNow`, progress pakai `transform`.
- [x] RPC atomik `request_question` + `submit_answer` (fix race skor, pangkas round-trip).
- [x] Index tambahan: `sessions(status)`, `activity_logs(session_id, team_id, created_at desc)`,
  `questions(group_id, difficulty)`.
- [x] `app/actions.ts`: buang `SELECT *`, hapus helper mati, RPC.
- [x] `lib/backend.ts`: `subscribe` async + tipe `RealtimeEvent`; Supabase `dynamic import`.
- [x] Next: format gambar AVIF/WebP, `optimizePackageImports`, `@next/bundle-analyzer`
  (`npm run analyze`); font dipangkas.
- [x] Server/Client split `/play` & `/display`; `force-static` landing + rules;
  `AnswerFeedback` di-`dynamic import`.
- [x] Optimistic UI (tutup modal instan) + retry 3x + suara/haptic lokal (`lib/feedback.ts`).
- [x] Mode Lite (`RuntimeOptimizations` → `data-lite`) + skeleton screen.
- [x] Service worker `public/sw.js` (cache aset statis + fallback navigasi offline).
- [x] Migrasi incremental `supabase/migration_optimizations.sql`.
- [x] Perbarui CONTEXT, ARCHITECTURE, DATABASE, API, plans.

### Fase 6 — Generator Soal AI + Redesain Halaman Guru
- [x] `lib/ai/prompt.ts` (prompt + response schema Gemini) & `lib/ai/gemini.ts` (REST: list model,
  generate, `maskApiKey`).
- [x] Tabel `app_settings` di `schema.sql` + `migration_optimizations.sql` (RLS tanpa policy).
- [x] `app/actions.ts`: `getAiSettings`, `saveAiSettings`, `clearAiKey`, `listGeminiModels`,
  `generateQuestions` (key server-side, rate limit, validasi `parseQuestionBank`).
- [x] `lib/demo/settings.ts` + fasad AI di `lib/backend.ts` (dual-mode).
- [x] `components/QuestionGenerator.tsx` (parameter, preview, salin JSON, kirim ke impor) &
  `components/AiSettingsPanel.tsx` (API key + model).
- [x] `QuestionBankImporter` mendukung prefill; `TeacherDashboard` di-redesain menjadi tab
  `Sesi` / `Bank Soal` / `Pengaturan`.
- [x] Perbarui CONTEXT, ARCHITECTURE, DATABASE, API, SETUP, PROMPT_GENERATE_SOAL, plans.
- [x] Verifikasi `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## 5. Rencana Lanjutan (opsional)

- QR code di `/display` menuju `/play?code=XXXXXX` dan `/play` membaca `?code=`.
- Tombol "Muat ulang soal" untuk menyusun ulang snapshot tanpa membuat sesi baru.
- Ekspor hasil akhir (CSV) untuk dokumentasi nilai.
- Autentikasi guru (PIN / Supabase Auth) bila perlu proteksi.
- Dukungan impor CSV selain JSON.
- Presence Supabase untuk indikator pemain online di room.
- IndexedDB untuk cache soal + offline-first penuh (Sprint 3).

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
| :--- | :--- |
| Kuota Supabase free-tier | Broadcast (bukan `postgres_changes`), rekonsiliasi 15 s, tanpa polling. |
| Jawaban bocor ke client | `correct_answer` tidak pernah dikirim; validasi di RPC server. |
| RLS terlalu terbuka | Anon hanya SELECT; RPC di-revoke dari anon; semua tulis via service role. |
| Snapshot soal berubah | Snapshot dibuat sekali saat mulai; reset tidak mengubahnya. |
| Next 16 breaking changes | Selalu `await params`/`cookies()`; route handler dinamis default. |
| Broadcast tidak terkirim | Rekonsiliasi berkala + refetch saat fokus/`online` menjaga state. |
