# CONTEXT — Konteks Ringkas Proyek

> File ini untuk agen AI. Baca ini dulu sebelum menelusuri repo. Jaga tetap ringkas.

## Tujuan

Classroom Conquest: gamifikasi kelas berbasis kelompok. Guru membuat sesi, papan menampilkan
**nomor soal 1..N** (N = seluruh bank soal mapel), tiap tim menjawab semua nomor secara mandiri
untuk mengumpulkan poin, papan proyektor realtime.

## Konsep Permainan (versi terkini)

- Tidak ada peta/wilayah. Papan = nomor soal 1..N.
- Bank soal disimpan per **group soal** (nama + mapel). Impor dengan nama group sama menambah soal.
- Guru dapat men-generate template soal via **Gemini** (tab Bank Soal), lalu menyalin/mengimpor
  JSON-nya. API key diatur di tab Pengaturan.
- Guru membuat sesi dengan **memilih group**; nomor soal 1..N = seluruh soal group, snapshot
  dibuat saat sesi dibuat.
- Tiap tim menjawab semua nomor secara **mandiri** (bukan rebutan); satu nomor bisa benar untuk
  banyak tim.
- Bebas pilih nomor; jawaban salah tanpa penalti, maksimal `MAX_ATTEMPTS_PER_SLOT` kali per
  nomor lalu nomor terkunci untuk tim itu.
- Poin = akumulasi `points` soal yang dijawab benar (EASY 100, MEDIUM 150, HARD 200).
- Peringkat: poin desc → `lastAnsweredAt` asc (tim yang menjawab benar lebih dulu unggul) → nama.
- Timer sesi tetap ada; jawaban setelah waktu habis ditolak.
- Join hanya saat sesi `LOBBY`. Reset mengeluarkan peserta (hapus tim, jawaban, log) dan
  mengembalikan status ke `LOBBY`; guru harus menekan **Mulai** lagi.
- **Mode Ular Tangga** (`sessions.game_mode = 'SNAKES'`) berjalan berdampingan dengan mode
  klasik. Siswa memilih avatar SVG saat join. Langkah mengikuti kesulitan: Mudah 2–4,
  Sedang 5–8, Sulit 9–12 petak; server mengundi saat jawaban benar dan UI menampilkan
  animasi dua dadu sebelum bidak bergerak. Jawaban salah membuat bidak tetap dan soal
  hangus. Ular/tangga aktif hanya bila bidak berhenti tepat di petaknya. Komposisi papan
  memakai kepadatan tetap per ukuran
  (30/50/100), rasio tangga/ular per preset, span berskala, zona ular, tangga comeback, dan
  net-forward guard. Guru memilih aturan finis `OVERSHOOT` (lewat finis menang) atau `EXACT`
  (wajib pas; kelebihan mantul mundur). Tim pertama yang mencapai finis memenangkan sesi;
  bila waktu habis tanpa finis, tim dengan petak terjauh menang (tie-break: lebih dulu
  mencapai petak itu, lalu nama). Jumlah soal minimal 50% dari panjang papan (papan 30 butuh
  minimal 15 soal); pilihan guru (30/50/100) dibatasi bila terlalu panjang, dengan papan
  minimum 10 petak.

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
app/{play,display}/page.tsx  shell server -> {Play,Display}Client.tsx (client)
app/teacher/page.tsx   cek cookie (server) -> TeacherDashboard (client)
app/rules/page.tsx     halaman aturan publik (server, force-static)
components/            QuestionBoard, Leaderboard, ActivityLog, QuestionCard, form,
                       SnakesBoard, BoardStandings, SnakesQuestionGrid, DiceRoll,
                       Avatar, AvatarPicker, QuestionBankImporter, QuestionGenerator,
                       AiSettingsPanel, QuestionGroupList, Skeleton,
                       PressureBanner, RuntimeOptimizations
hooks/useGameState.ts  state + realtime Broadcast + delta + rekonsiliasi
hooks/useServerNow.ts  clock global bersama (offset server)
hooks/useLocalStorage.ts  useSyncExternalStore untuk localStorage
lib/game.ts            leaderboard, validasi jawaban, poin, timer, logika papan,
                       komposisi ular/tangga, aturan finis
lib/avatars.ts         daftar avatar SVG (tanpa emoji)
lib/clock.ts           offset waktu server (serverNow)
lib/feedback.ts        suara WebAudio + haptic lokal
lib/questions.ts       validasi impor bank soal (parseQuestionBank)
lib/ai/prompt.ts       prompt + response schema Gemini
lib/ai/gemini.ts       klien REST Gemini (list model, generate, maskApiKey)
lib/backend.ts         fasad supabase/demo + tipe RealtimeEvent
lib/supabase/{client,server}.ts  client di-dynamic import
lib/demo/engine.ts     engine demo (localStorage v4, fallback baca v3)
lib/demo/settings.ts   pengaturan AI demo (localStorage)
supabase/schema.sql    skema + RLS + Broadcast + RPC + app_settings
supabase/migration_optimizations.sql  migrasi untuk DB yang sudah ada
docs/                  dokumentasi (baca sesuai kebutuhan)
plans/                 rencana
```

## Tabel Penting

- `question_groups`: group bank soal (`name` unik, `subject`).
- `sessions` (tanpa grid_size) dengan `game_mode` (`CLASSIC`/`SNAKES`) + `board_config`
  (`goal`, `preset`, `seed`, `finishRule`, `ladders`, `snakes`); `teams` dengan `avatar`,
  `position`, `finished_at`; `questions` (ber-`group_id`).
- `session_questions`: snapshot nomor soal per sesi (`slot_number`, `question_id`).
- `answers`: hanya jawaban **benar** mode klasik (`team_id`, `slot_number`, `points`, `answered_at`).
- `moves`: riwayat langkah mode Ular Tangga (satu baris per soal per tim); sumber kebenaran
  posisi selain `teams.position`.
- `activity_logs`.
- `app_settings`: pengaturan server (`gemini_api_key`, `gemini_model`); RLS tanpa policy → hanya
  service role. Key tidak pernah dikirim ke client.

## Perintah

```bash
npm run dev            # dev
npm run lint           # eslint
npx tsc --noEmit       # typecheck
npm run build          # build
npm run analyze        # bundle analyzer
```

## Aturan Penting

1. `questions.correct_answer` TIDAK BOLEH sampai ke client saat bermain. Gunakan
   `PublicQuestion`. Pengecualian mode review: `SlotQuestion.correctAnswer` hanya diisi bila
   tim itu sudah menjawab benar nomor tersebut atau nomornya sudah terkunci (habis percobaan).
2. Anon hanya `SELECT`; semua tulis lewat service role di server. RPC `request_question`,
   `submit_answer`, dan `submit_move` di-`revoke` dari anon (hanya `service_role`).
3. Realtime memakai **Broadcast** dari trigger DB (`answer.created`, `team.joined`,
   `team.moved`, `session.updated`, `log.created`) ke topik `game-<session_id>`; `team.moved`
   hanya dikirim saat `position`/`finished_at` berubah (mode klasik tidak terganggu);
   `activity_logs` hanya di-broadcast bila `kind = 'ERROR'` (mis. tim keluar) agar panel
   proyektor bisa memberi peringatan seketika.
4. Snapshot nomor soal dibuat saat `createSession`; start/reset tidak mengubah snapshot.
5. Hapus group/soal ditolak bila masih dipakai sesi.
6. Perubahan skema harus disinkronkan ke `supabase/schema.sql`,
   `supabase/migration_optimizations.sql`, + `docs/DATABASE.md`.
7. Anti-kecurangan tanpa tabel baru: batas percobaan dihitung dari `activity_logs`
   (`lib/game.ts` + RPC `submit_answer`), opsi/kata diacak di server, anomali dilog kind `ERROR`,
   rate limit per-instance di `app/actions.ts` + `lib/demo/engine.ts`.
8. Timer server-authoritative: sinkronkan `syncServerClock(state.serverTime)`, tampilkan via
   `useServerNow()`; jangan pakai `Date.now()` langsung untuk sisa waktu.
9. API key Gemini tidak pernah dikirim ke client; hanya `maskedKey`. Mode Supabase menyimpan di
   `app_settings` (service role), mode demo di `localStorage`. Generate lewat Server Action.

## Detail Rujukan

- Arsitektur & alur: `docs/ARCHITECTURE.md`
- Skema & RLS: `docs/DATABASE.md`
- Aturan main: `docs/GAME_RULES.md`
- Kontrak action & tipe: `docs/API.md`
- Setup & deploy: `docs/SETUP.md`
- Prompt generate soal: `docs/PROMPT_GENERATE_SOAL.md`
