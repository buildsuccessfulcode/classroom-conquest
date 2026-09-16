# Arsitektur

## 1. Gambaran Umum

```
                       +---------------------------+
                       |        Browser            |
                       |                           |
  Guru  /teacher  ----> |  Client Components        |
  Murid /play     ----> |  (React 19)               |
  Layar /display  ----> |                           |
                       +------------+--------------+
                                    |
                  Server Actions    |    Realtime (WebSocket)
                  (mutasi, validasi)|    (baca, push)
                                    v
                       +---------------------------+
                       |   Next.js Server (Vercel) |
                       |   app/actions.ts          |
                       |   service role key        |
                       +------------+--------------+
                                    |
                                    v
                       +---------------------------+
                       |        Supabase           |
                       |  Postgres + Realtime      |
                       +---------------------------+
```

- **Baca + realtime** langsung dari browser memakai **anon key** (hanya `SELECT` lewat RLS).
- **Semua mutasi** melewati **Server Actions** dengan **service role key** yang tidak pernah
  dikirim ke browser. Validasi jawaban terjadi di server.
- **Demo mode** menggantikan seluruh lapisan di atas dengan `localStorage` + `BroadcastChannel`,
  dipilih otomatis bila env Supabase tidak ada.

## 2. Konsep Permainan

- Papan berisi **nomor soal 1..N**; N = jumlah seluruh soal mapel saat sesi dimulai.
- Snapshot nomor dibuat di `session_questions` (`ensureSlots`) saat **Mulai Sesi**.
- Tiap tim menjawab nomor secara **mandiri**; jawaban benar disimpan di `answers`.
- Peringkat dari total poin; tie-break `lastAnsweredAt` (lebih awal unggul).

## 3. Dual Mode (Supabase / Demo)

Deteksi dilakukan di `lib/config.ts`:

```ts
isSupabaseConfigured() // true bila NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY ada
```

Fasad di `lib/backend.ts` mengekspos fungsi yang sama untuk kedua mode:

| Fungsi | Supabase | Demo |
| :--- | :--- | :--- |
| `fetchGameState(code)` | Server Action → query Postgres | `demo/engine.ts` baca `localStorage` |
| `subscribe(id, cb)` | `supabase.channel().on('postgres_changes')` | `BroadcastChannel` + `storage` event |
| `createSession`, `joinTeam`, `requestQuestion`, `submitAnswer`, dll | Server Action | Engine lokal |

Konsekuensi: aplikasi bisa dicoba tanpa akun Supabase, tetapi data demo hanya hidup di satu
browser (satu perangkat). Untuk kelas nyata (banyak HP), gunakan Supabase.

## 4. Alur Data Satu Jawaban

```
Murid klik nomor
  -> backend.requestQuestion(code, teamId, slotNumber)
       Server Action -> RPC request_question: satu round-trip, ambil soal + solved +
       wrong_attempts, buang correct_answer, acak opsi/kata
  -> QuestionCard menampilkan soal (mode jawab, review, atau terkunci)
  -> murid submit
  -> UI langsung: tutup modal, suara + haptic lokal, state "memeriksa" (optimistis)
  -> backend.submitAnswer(...)
       Server Action -> RPC submit_answer: rate limit, tolak bila terkunci, validasi
       terhadap correct_answer, insert answers + score = score + gained + log, ATOMIK
       (gagal jaringan -> retry otomatis hingga 3x dengan backoff)
  -> Trigger `after insert on answers` -> realtime.send('answer.created') ke game-<id>
  -> Klien lain menerapkan delta `answers` langsung, lalu rekonsiliasi terkoalesi 200 ms
```

`correct_answer` **tidak pernah** meninggalkan server. `requestQuestion` mengembalikan objek
`PublicQuestion` (tanpa kunci jawaban). Jumlah percobaan salah dihitung di RPC dari
`activity_logs` agar tidak memerlukan tabel khusus.

## 5. Struktur Kode

```
app/
  actions.ts          Server Actions ("use server") — satu-satunya jalur tulis Supabase
  layout.tsx          Root layout (+ RuntimeOptimizations)
  page.tsx            Landing (server, force-static)
  teacher/page.tsx    Cek cookie (server) -> TeacherDashboard (client)
  play/page.tsx       Shell server -> PlayClient (client)
  display/page.tsx    Shell server -> DisplayClient (client)
  rules/page.tsx      Aturan (server, force-static)
components/            QuestionBoard, Leaderboard, ActivityLog, QuestionCard, form,
                       QuestionBankImporter, QuestionGenerator, AiSettingsPanel,
                       QuestionGroupList, Skeleton, RuntimeOptimizations
hooks/
  useGameState.ts     Langganan realtime (Broadcast) + delta + rekonsiliasi + state terpadu
  useServerNow.ts     Clock global bersama (satu interval)
  useLocalStorage.ts  useSyncExternalStore untuk localStorage
lib/
  game.ts             Logika murni (leaderboard, validasi, poin, timer)
  clock.ts            Offset waktu server (serverNow)
  feedback.ts         Suara (WebAudio) + haptic lokal
  questions.ts        Validasi impor bank soal
  ai/prompt.ts        Prompt + response schema Gemini
  ai/gemini.ts        Klien REST Gemini (list model, generate)
  backend.ts          Fasad mode Supabase/demo + tipe RealtimeEvent
  config.ts           Deteksi env
  types.ts            Tipe domain
  colors.ts           Palet warna tim
  supabase/           Client browser (dynamic import) & server
  demo/engine.ts      Engine demo
  demo/settings.ts    Pengaturan AI di localStorage (mode demo)
supabase/
  schema.sql          Skema + RLS + Broadcast + RPC + app_settings
  migration_optimizations.sql  Migrasi incremental untuk DB yang sudah ada
  seed.sql            Bank soal contoh
```

Prinsip: **logika game murni** (`lib/game.ts`) dipisah dari **I/O** (Supabase/demo) dan
**presentasi** (komponen), sehingga aturan main dapat diuji tanpa database.

## 6. Keputusan Desain

1. **Server Actions, bukan REST API.** Mengurangi boilerplate dan otomatis mendukung
   progressive enhancement. Tidak ada route handler khusus di versi ini.
2. **Anon hanya baca.** Realtime butuh `SELECT` untuk anon; tulis selalu via service role.
3. **Snapshot nomor soal per sesi.** Menjaga urutan nomor tetap sama di semua perangkat dan
   mencegah soal berubah saat sesi berjalan.
4. **Hanya jawaban benar yang disimpan.** Progress per tim = jumlah baris `answers`.
5. **Tie-break satu metrik.** `lastAnsweredAt` (lebih awal unggul) mencakup kasus semua benar
   (durasi tercepat).
6. **Timer dihitung dari `started_at` + `duration_minutes`.** Ditegakkan di server saat
   `requestQuestion`/`submitAnswer`; tidak perlu job scheduler.
7. **Next.js 16 async APIs.** `params`, `searchParams`, `cookies()`, `headers()` selalu
   di-`await`. Route handler dinamis secara default.
8. **Anti-kecurangan tanpa tabel baru.** Batas percobaan per nomor dihitung ulang dari
   `activity_logs` dengan format pesan stabil (`"... menjawab salah nomor N ..."`). Tidak ada
   penalti poin, jadi `buildLeaderboard` tetap dari `answers`. Opsi/kata diacak di server.
   Rate limit memakai `Map` level modul per-instance (best-effort di serverless).
9. **Realtime Broadcast hybrid.** Perubahan game dikirim sebagai Broadcast ringan dari trigger
   database (`realtime.send`) ke topik `game-<session_id>`, bukan `postgres_changes`. Payload
   berupa delta kecil; `activity_logs` tidak di-broadcast. Rekonsiliasi penuh berkala (15 detik)
   plus saat tab kembali fokus/`online` menjaga konsistensi.
10. **RPC atomik.** `request_question` dan `submit_answer` menggabungkan banyak query menjadi satu
    round-trip; `submit_answer` mengunci baris tim dan memakai `score = score + gained` sehingga
    bebas race condition. RPC hanya untuk `service_role`.
11. **Timer server-authoritative.** `started_at` disimpan server; klien menyinkronkan offset
    waktu sekali (`lib/clock.ts`) dan menghitung sisa waktu dari `serverNow()`, sehingga timer
    konsisten antar perangkat.

## 7. Batasan Kuota (Free Tier)

- Realtime: Broadcast, bukan `postgres_changes` → hemat WAL/RLS. Kuota Free: 200 koneksi
  bersamaan dan 100 pesan/detik; satu channel per room.
- Rekonsiliasi 15 detik memakai Server Action (bukan pesan Realtime).
- `activity_logs` dibatasi (mis. 50 entri terbaru) saat query.
- Supabase Storage/audio tidak dipakai; aset statis di `/public` + service worker.

## 8. Optimasi Performa

- **Bundle**: `@supabase/supabase-js` di-`dynamic import` (tidak ikut di mode demo); format
  gambar AVIF/WebP; font dipangkas; `npm run analyze` untuk cek budget.
- **Render**: `AnswerFeedback` (confetti) di-`dynamic import`; landing/rules `force-static`;
  server shell memisahkan client island.
- **Perangkat low-end**: `RuntimeOptimizations` mendeteksi `hardwareConcurrency`/`deviceMemory`/
  `prefers-reduced-motion` dan menyalakan `data-lite` (matikan confetti/float/blur).
- **Perceived performance**: skeleton screen, feedback lokal (<100 ms) via `lib/feedback.ts`,
  optimistic close modal, retry otomatis 3x.
- **Caching**: service worker `public/sw.js` (cache-first aset statis, offline fallback untuk
  navigasi).

## 9. Integrasi AI (Gemini)

```
Guru isi parameter (tab Bank Soal)
  -> backend.generateQuestions(input)
       Mode Supabase: Server Action baca key dari tabel app_settings (service role)
       Mode demo: key dari localStorage diteruskan ke Server Action
  -> lib/ai/prompt.ts menyusun prompt + responseSchema (JSON terstruktur)
  -> lib/ai/gemini.ts POST {model}:generateContent
  -> parseQuestionBank() memvalidasi ulang keluaran (jaminan format importer)
  -> preview + "Salin JSON" / "Kirim ke Impor" -> guru klik Impor Soal
```

- **Key tidak pernah ke browser.** UI hanya menampilkan `maskedKey`; aksi `getAiSettings` tidak
  mengembalikan nilai mentah. Di mode Supabase, RLS `app_settings` tanpa policy.
- **Mode demo** memakai `localStorage` (`classroom-conquest:ai:v1`), tetapi panggilan Gemini tetap
  melalui Server Action (menghindari CORS) dengan key yang dikirim dari klien.
- **Validasi berlapis**: input dibatasi di `app/actions.ts` (jumlah 1–50, tipe, distribusi) dan
  keluaran divalidasi `parseQuestionBank`; error ditampilkan per-nomor.
- **Tanpa dependency baru**: cukup `fetch`; model default `gemini-2.5-flash`, daftar model diambil
  dinamis dari endpoint `models`.
