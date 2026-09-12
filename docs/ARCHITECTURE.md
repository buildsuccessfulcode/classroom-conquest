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
       server: rate limit, ambil soal dari session_questions, buang correct_answer,
               acak opsi/kata, hitung sisa percobaan + status kunci, tandai solved
  -> QuestionCard menampilkan soal (mode jawab, review, atau terkunci)
  -> murid submit
  -> backend.submitAnswer(...)
       server: rate limit, tolak bila nomor terkunci, validasi jawaban terhadap correct_answer
       server: bila salah -> activity_logs (nomor percobaan) + sisa percobaan
       server: bila benar -> insert answers + teams.score + activity_logs
       server: deteksi anomali -> activity_logs kind ERROR
  -> Realtime push ke /display dan /play semua tim
```

`correct_answer` **tidak pernah** meninggalkan server. `requestQuestion` mengembalikan objek
`PublicQuestion` (tanpa kunci jawaban). Jumlah percobaan salah tidak disimpan di tabel khusus,
melainkan dihitung ulang dari `activity_logs` agar tidak memerlukan perubahan skema.

## 5. Struktur Kode

```
app/
  actions.ts          Server Actions ("use server") — satu-satunya jalur tulis Supabase
  layout.tsx          Root layout
  page.tsx            Landing
  teacher/page.tsx    Dashboard guru (client)
  play/page.tsx       Antarmuka murid (client)
  display/page.tsx    Papan proyektor (client)
components/            QuestionBoard, Leaderboard, ActivityLog, QuestionCard, form,
                       QuestionBankImporter, QuestionGroupList
hooks/
  useGameState.ts     Langganan realtime + state terpadu
  useLocalStorage.ts  useSyncExternalStore untuk localStorage
lib/
  game.ts             Logika murni (leaderboard, validasi, poin, timer)
  questions.ts        Validasi impor bank soal
  backend.ts          Fasad mode Supabase/demo
  config.ts           Deteksi env
  types.ts            Tipe domain
  colors.ts           Palet warna tim
  supabase/           Client browser & server
  demo/engine.ts      Engine demo
supabase/
  schema.sql          Skema + RLS + realtime
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

## 7. Batasan Kuota (Free Tier)

- Realtime hanya pada `answers`, `teams`, `activity_logs`.
- Tidak ada polling; state awal diambil sekali lalu diperbarui via push.
- `activity_logs` dibatasi (mis. 50 entri terbaru) saat query.
