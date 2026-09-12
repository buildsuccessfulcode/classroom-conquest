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
- Bebas pilih nomor; salah tanpa penalti, bisa dicoba lagi.
- Poin: EASY 100, MEDIUM 150, HARD 200.
- Peringkat: poin desc → `lastAnsweredAt` asc → nama.
- Timer sesi ditegakkan di server.

## 3. Struktur Folder

```
app/
  layout.tsx / page.tsx / globals.css
  teacher/page.tsx           # dashboard guru (client)
  play/page.tsx              # antarmuka murid (client)
  display/page.tsx           # papan proyektor (client, ?code=XXXXXX)
  actions.ts                 # server actions (mutasi)
components/
  QuestionBoard.tsx          # papan nomor soal (display & play)
  Leaderboard.tsx            # peringkat poin + progres
  ActivityLog.tsx
  QuestionCard.tsx           # 3 tipe soal + mode read-only (review)
  QuestionBankImporter.tsx   # impor file/paste JSON
  ModeBadge.tsx
hooks/
  useGameState.ts            # state + realtime terpadu
  useLocalStorage.ts         # useSyncExternalStore
  useTeamIdentity.ts / useNow.ts
lib/
  types.ts / game.ts / questions.ts / backend.ts / config.ts
  colors.ts / format.ts / seed-questions.ts
  supabase/{client,server}.ts
  demo/engine.ts
supabase/
  schema.sql / seed.sql / sample-questions.json
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

## 5. Rencana Lanjutan (opsional)

- QR code di `/display` menuju `/play?code=XXXXXX` dan `/play` membaca `?code=`.
- Tombol "Muat ulang soal" untuk menyusun ulang snapshot tanpa membuat sesi baru.
- Ekspor hasil akhir (CSV) untuk dokumentasi nilai.
- Autentikasi guru (PIN / Supabase Auth) bila perlu proteksi.
- Dukungan impor CSV selain JSON.

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
| :--- | :--- |
| Kuota Supabase free-tier | Query ringan, realtime 3 tabel, tanpa polling. |
| Jawaban bocor ke client | `correct_answer` tidak pernah dikirim; validasi server. |
| RLS terlalu terbuka | Anon hanya SELECT; semua tulis via service role. |
| Snapshot soal berubah | Snapshot dibuat sekali saat mulai; reset tidak mengubahnya. |
| Next 16 breaking changes | Selalu `await params`/`cookies()`; route handler dinamis default. |
