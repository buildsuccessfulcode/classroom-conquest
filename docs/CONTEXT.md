# CONTEXT — Konteks Ringkas Proyek

> File ini untuk agen AI. Baca ini dulu sebelum menelusuri repo. Jaga tetap ringkas.

## Tujuan

Classroom Conquest: gamifikasi kelas berbasis kelompok. Guru membuat sesi, papan menampilkan
**nomor soal 1..N** (N = seluruh bank soal mapel), tiap tim menjawab semua nomor secara mandiri
untuk mengumpulkan poin, papan proyektor realtime. PRD awal: `Classroom_Conquest_PRD_and_Schema.md`
(sebagian sudah tidak relevan — konsep wilayah diganti nomor soal).

## Konsep Permainan (versi terkini)

- Tidak ada peta/wilayah. Papan = nomor soal 1..N.
- Bank soal disimpan per **group soal** (nama + mapel). Impor dengan nama group sama menambah soal.
- Guru membuat sesi dengan **memilih group**; nomor soal 1..N = seluruh soal group, snapshot
  dibuat saat sesi dibuat.
- Tiap tim menjawab semua nomor secara **mandiri** (bukan rebutan); satu nomor bisa benar untuk
  banyak tim.
- Bebas pilih nomor; jawaban salah tanpa penalti, maksimal `MAX_ATTEMPTS_PER_SLOT` kali per
  nomor lalu nomor terkunci untuk tim itu.
- Poin = akumulasi `points` soal yang dijawab benar (EASY 100, MEDIUM 150, HARD 200).
- Peringkat: poin desc → `lastAnsweredAt` asc (tim yang menjawab benar lebih dulu unggul) → nama.
- Timer sesi tetap ada; jawaban setelah waktu habis ditolak.

## Stack & Konvensi

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4.
- **Next 16 async:** selalu `await params`, `await searchParams`, `await cookies()`, `await headers()`.
- Tipe prop global: `PageProps<'/path'>`, `LayoutProps<'/path'>`, `RouteContext<'/path'>`.
- UI Bahasa Indonesia. **Tanpa komentar kode** kecuali diminta. Tanpa emoji.
- Server Actions di `app/actions.ts` (`"use server"`) = satu-satunya jalur tulis.
- Logika murni di `lib/game.ts` (tanpa I/O). Jangan campur dengan Supabase.
- Dua mode: Supabase (env ada) dan demo (`localStorage`). Deteksi via `lib/config.ts`.

## Peta File

```
app/actions.ts         mutasi (create/join/start/request/submit/reset/end/import/delete)
app/{teacher,play,display}/page.tsx  halaman client
components/            QuestionBoard, Leaderboard, ActivityLog, QuestionCard, form,
                       QuestionBankImporter, QuestionGroupList
hooks/useGameState.ts  state + realtime (Supabase atau demo)
hooks/useLocalStorage.ts  useSyncExternalStore untuk localStorage
lib/game.ts            leaderboard, validasi jawaban, poin, timer
lib/questions.ts       validasi impor bank soal (parseQuestionBank)
lib/backend.ts         fasad supabase/demo
lib/supabase/{client,server}.ts
lib/demo/engine.ts     engine demo (localStorage v3)
supabase/schema.sql    skema + RLS + realtime
docs/                  dokumentasi (baca sesuai kebutuhan)
plans/                 rencana
```

## Tabel Penting

- `question_groups`: group bank soal (`name` unik, `subject`).
- `sessions` (tanpa grid_size), `teams`, `questions` (ber-`group_id`).
- `session_questions`: snapshot nomor soal per sesi (`slot_number`, `question_id`).
- `answers`: hanya jawaban **benar** (`team_id`, `slot_number`, `points`, `answered_at`).
- `activity_logs`.

## Perintah

```bash
npm run dev            # dev
npm run lint           # eslint
npx tsc --noEmit       # typecheck
npm run build          # build
```

## Aturan Penting

1. `questions.correct_answer` TIDAK BOLEH sampai ke client saat bermain. Gunakan
   `PublicQuestion`. Pengecualian mode review: `SlotQuestion.correctAnswer` hanya diisi bila
   tim itu sudah menjawab benar nomor tersebut.
2. Anon hanya `SELECT`; semua tulis lewat service role di server.
3. Realtime hanya `answers`, `teams`, `activity_logs`.
4. Snapshot nomor soal dibuat saat `createSession`; start/reset tidak mengubah snapshot.
5. Hapus group/soal ditolak bila masih dipakai sesi.
6. Perubahan skema harus disinkronkan ke `supabase/schema.sql` + `docs/DATABASE.md`.
7. Anti-kecurangan tanpa tabel baru: batas percobaan dihitung dari `activity_logs`
   (`lib/game.ts`), opsi/kata diacak di server, anomali dilog kind `ERROR`, rate limit
   per-instance di `app/actions.ts` + `lib/demo/engine.ts`.

## Detail Rujukan

- Arsitektur & alur: `docs/ARCHITECTURE.md`
- Skema & RLS: `docs/DATABASE.md`
- Aturan main: `docs/GAME_RULES.md`
- Kontrak action & tipe: `docs/API.md`
- Setup & deploy: `docs/SETUP.md`
- Prompt generate soal: `docs/PROMPT_GENERATE_SOAL.md`
