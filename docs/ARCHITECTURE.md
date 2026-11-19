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
- Snapshot nomor dibuat di `session_questions` saat **sesi dibuat**.
- Tiap tim menjawab nomor secara mandiri; jawaban benar disimpan di `answers`.
- Jawaban salah dicatat di `slot_attempts` (bukan log) dan tidak mengurangi poin.
- Peringkat dari total poin; tie-break `lastAnsweredAt` (lebih awal unggul).
- **Mode Ular Tangga** (`game_mode = 'SNAKES'`) berjalan di samping mode klasik: papan petak
  dengan ular/tangga, bidak = avatar tim. Langkah mengikuti kesulitan: Mudah 2–4, Sedang
  5–8, Sulit 9–12 petak; server mengundi saat jawaban benar dan klien menampilkan animasi
  dua dadu sebelum memperbarui papan. Jawaban salah membuat bidak tetap dan soal hangus
  (satu baris `moves` per soal per tim). Posisi disimpan di `teams.position`; riwayat di
  `moves`. Ular/tangga aktif hanya saat bidak berhenti tepat di petaknya. Komposisi
  tangga/ular memakai kepadatan tetap
  per ukuran papan (30/50/100) dengan rasio per preset, span berskala papan, zona ular,
  jaminan tangga comeback, dan net-forward guard. Guru memilih `finishRule`:
  `OVERSHOOT` (melewati finis menang) atau `EXACT` (wajib pas; kelebihan mantul mundur).
  Jumlah soal minimal 50% dari panjang papan dan papan minimal 10 petak. Finis pertama
  mengakhiri sesi; bila timer habis tanpa finis, petak terjauh menang.
  Papan diacak deterministik saat sesi dibuat (`board_config`) agar sama di semua perangkat.

## 3. Dual Mode (Supabase / Demo)

Deteksi dilakukan di `lib/config.ts`:

```ts
isSupabaseConfigured() // true bila NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY ada
```

Fasad di `lib/backend.ts` mengekspos fungsi yang sama untuk kedua mode:

| Fungsi | Supabase | Demo |
| :--- | :--- | :--- |
| `fetchGameState(code, teamId?)` | Server Action → RPC `fetch_game_state` | `demo/engine.ts` baca `localStorage` |
| `subscribe(id, cb)` | `supabase.channel().on('postgres_changes')` | `BroadcastChannel` + `storage` event |
| `createSession`, `joinTeam`, `requestQuestion`, `submitAnswer`, dll | Server Action | Engine lokal |

Konsekuensi: aplikasi bisa dicoba tanpa akun Supabase, tetapi data demo hanya hidup di satu
browser (satu perangkat). Untuk kelas nyata (banyak HP), gunakan Supabase.

## 4. Alur Data Satu Jawaban

```
Murid klik nomor
  -> backend.requestQuestion(code, teamId, slotNumber)
       Server Action -> RPC request_question: satu round-trip, ambil soal + solved +
       wrong_attempts dari slot_attempts, buang correct_answer, acak opsi/kata
  -> QuestionCard menampilkan soal (mode jawab, review, atau terkunci)
  -> murid submit
  -> UI langsung: tutup modal, suara + haptic lokal
  -> backend.submitAnswer(...)
       Server Action -> RPC submit_answer: rate limit, tolak bila terkunci, validasi
       terhadap correct_answer, insert answers + score + upsert slot_attempts, ATOMIK
       (gagal jaringan -> retry otomatis hingga 3x dengan backoff)
  -> Trigger `after insert on answers` -> realtime.send('answer.created') ke game-<id>
  -> Trigger `after insert/update on slot_attempts` -> 'attempt.updated'
  -> Klien menerapkan delta (dibatched ~80 ms); tanpa full reload per jawaban
```

`correct_answer` **tidak pernah** meninggalkan server. `requestQuestion` mengembalikan objek
`PublicQuestion` (tanpa kunci jawaban). Percobaan salah dihitung dari `slot_attempts`, bukan
parsing teks log.

Mode Ular Tangga memakai jalur tulis terpisah: `submitMove` → RPC `submit_move`. RPC mengunci
baris tim, memvalidasi jawaban, mengundi langkah sesuai kesulitan, menerapkan ular/tangga (sekali, hanya saat
maju), menulis `moves`, memperbarui `teams.position`/`finished_at`, dan mengakhiri sesi bila
finis — semuanya atomik. Trigger `after insert on moves` mengirim Broadcast `move.created`, dan
trigger `after update on teams` mengirim `team.moved` hanya saat `position`/`finished_at`
berubah. Klien memakai `move.created` untuk animasi tanpa fetch ulang.

## 5. Struktur Kode

```
app/
  actions.ts          Server Actions ("use server") — satu-satunya jalur tulis Supabase
  layout.tsx          Root layout (+ RuntimeOptimizations)
  page.tsx            Landing (server, force-static)
  teacher/page.tsx    Cek cookie + prefetch sesi/group (server) -> TeacherDashboard (client)
  play/page.tsx       Shell server -> PlayClient (client)
  display/page.tsx    Shell server -> DisplayClient (client)
  rules/page.tsx      Aturan (server, force-static)
components/            QuestionBoard, Leaderboard, ActivityLog, QuestionCard, form,
                       QuestionBankImporter, QuestionGenerator, AiSettingsPanel,
                       QuestionGroupList, Skeleton, RuntimeOptimizations
hooks/
  useGameState.ts     Langganan realtime + delta batch + rekonsiliasi + state terpadu
  useServerNow.ts     Clock global bersama (satu interval)
  useLocalStorage.ts  useSyncExternalStore untuk localStorage
  useLiteMode.ts      Status mode ringan (auto + override)
lib/
  game.ts             Logika murni (leaderboard, validasi, poin, timer)
  clock.ts            Offset waktu server (serverNow)
  feedback.ts         Suara (WebAudio) + haptic lokal
  lite.ts             Deteksi perangkat lemah + preferensi mode ringan
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
8. **Anti-kecurangan dengan `slot_attempts`.** Batas percobaan per nomor disimpan di tabel
   `slot_attempts`; tidak ada penalti poin. Opsi/kata diacak di server. Anomali (keluar tab,
   jawaban benar mencurigakan) dicatat sebagai `activity_logs` kind `ERROR`; log jawaban
   benar/salah tidak lagi ditulis. Rate limit per-instance memakai bucket terpisah untuk
   request/jawaban/move/focus.
9. **Realtime Broadcast hybrid.** Perubahan game dikirim sebagai Broadcast ringan dari trigger
   database (`realtime.send`) ke topik `game-<session_id>`: `answer.created`, `team.joined`,
   `team.moved`, `move.created`, `attempt.updated`, `session.updated`, `log.created`. Payload
   berupa delta kecil. Klien menerapkan delta secara langsung dan membatch event (~80 ms);
   rekonsiliasi penuh (20 detik, saat fokus/online, dan saat reset) memakai RPC
   `fetch_game_state`.
10. **RPC atomik.** `request_question`, `submit_answer`, `submit_move`, `fetch_game_state`,
    `create_session`, dan `report_focus_event` menggabungkan banyak query menjadi satu
    round-trip; `submit_answer`/`submit_move` mengunci baris tim sehingga bebas race condition.
11. **Timer server-authoritative.** `started_at` disimpan server; klien menyinkronkan offset
    waktu sekali (`lib/clock.ts`) dan menghitung sisa waktu dari `serverNow()`, sehingga timer
    konsisten antar perangkat.

## 7. Batasan Kuota (Free Tier)

- Realtime: Broadcast, bukan `postgres_changes` → hemat WAL/RLS. Kuota Free: 200 koneksi
  bersamaan dan 100 pesan/detik; satu channel per room.
- Rekonsiliasi 20 detik memakai RPC `fetch_game_state` (bukan pesan Realtime).
- `activity_logs` dibatasi (mis. 50 entri terbaru) saat query.
- Supabase Storage/audio tidak dipakai; aset statis di `/public` + service worker.

## 8. Optimasi Performa

- **Bundle**: `@supabase/supabase-js` di-`dynamic import` (tidak ikut di mode demo); komponen
  mode Ular Tangga dan panel tab guru di-`dynamic import`; format gambar AVIF/WebP; font
  dipangkas; `npm run analyze` untuk cek budget.
- **Render**: event realtime dibatch (~80 ms) dan memakai `startTransition`; komponen berat
  (`SnakesBoard`, `QuestionBoard`, `Leaderboard`, `BoardStandings`, `ActivityLog`) dimemo;
  geometri statis `SnakesBoard` di-`useMemo`; reorder papan memakai satu perhitungan standings.
- **Navigasi**: `?slot=` diperbarui dengan `history.replaceState` agar tidak memicu permintaan
  RSC setiap buka/tutup soal.
- **Perangkat low-end**: `RuntimeOptimizations` mendeteksi `hardwareConcurrency`/`deviceMemory`/
  `saveData`/`effectiveType`/`prefers-reduced-motion` dan menyalakan `data-lite` (matikan
  confetti/float/blur). Siswa dapat menimpa lewat tombol Mode Ringan.
- **Perceived performance**: skeleton screen, feedback lokal (<100 ms) via `lib/feedback.ts`,
  optimistic close modal, retry otomatis 3x.
- **Caching**: service worker `public/sw.js` (cache-first aset statis, offline fallback untuk
  navigasi); `preconnect` ke origin Supabase untuk mempercepat koneksi realtime.

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
