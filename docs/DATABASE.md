# Database

Skema Supabase (PostgreSQL). File yang dieksekusi: [`supabase/schema.sql`](../supabase/schema.sql)
dan data contoh [`supabase/seed.sql`](../supabase/seed.sql).

> Versi ini menggantikan konsep wilayah. Tabel `territories` sudah **tidak dipakai** dan tidak
> lagi ada di skema. Jalankan skema pada database baru (DB lama dihapus).

## 1. Tabel

### `sessions`
Satu sesi permainan kelas.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `session_code` | `varchar(6)` | UNIQUE, kode join (mis. `K3LH01`) |
| `group_id` | `uuid` | FK → `question_groups` `ON DELETE RESTRICT` |
| `subject_name` | `varchar(100)` | Mata pelajaran (disalin dari group) |
| `is_active` | `boolean` | `true` selama sesi berjalan |
| `status` | `varchar(20)` | `LOBBY` / `PLAYING` / `ENDED` |
| `duration_minutes` | `int` | 5–120, default 30 |
| `started_at` | `timestamptz` | Diisi saat sesi dimulai |
| `ended_at` | `timestamptz` | Diisi saat sesi diakhiri |
| `created_at` | `timestamptz` | Default `now()` |

### `teams`
Tim/kelompok yang mendaftar mandiri.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `team_name` | `varchar(50)` | UNIQUE per sesi |
| `color_code` | `varchar(7)` | Hex, mis. `#FF5733` |
| `score` | `int` | Default 0 (disinkronkan dari `answers`) |
| `joined_at` | `timestamptz` | |

### `question_groups`
Group bank soal. Dibuat saat impor; nama group unik (impor dengan nama sama menambah soal).

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `name` | `varchar(100)` | UNIQUE, nama group (mis. `English Bab 1`) |
| `subject` | `varchar(50)` | Mata pelajaran group |
| `created_at` | `timestamptz` | Default `now()` |

### `questions`
Bank soal, terikat ke satu group.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `group_id` | `uuid` | FK → `question_groups` `ON DELETE CASCADE` |
| `subject` | `varchar(50)` | `English`, `Coding`, `DDPK`, … |
| `type` | `varchar(20)` | `MULTIPLE_CHOICE`, `SHORT_ANSWER`, `REARRANGE_WORDS` |
| `difficulty` | `varchar(10)` | `EASY`, `MEDIUM`, `HARD` |
| `question_text` | `text` | Pertanyaan |
| `metadata` | `jsonb` | `{ options: [] }`, `{ words: [] }`, atau `{ code_snippet }` |
| `correct_answer` | `text` | Acuan, dibandingkan case-insensitive |
| `points` | `int` | Default 100 |

### `session_questions`
Snapshot nomor soal per sesi. Dibuat otomatis **saat sesi dibuat**: seluruh soal dalam group
diberi nomor `1..N`.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `slot_number` | `int` | Nomor yang tampil di papan |
| `question_id` | `uuid` | FK → `questions` `ON DELETE CASCADE` |
| `created_at` | `timestamptz` | |

Batasan: UNIQUE `(session_id, slot_number)` dan `(session_id, question_id)`.

### `answers`
Jawaban **benar** per tim. Jawaban salah tidak disimpan di sini (hanya di log).

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `team_id` | `uuid` | FK → `teams` `ON DELETE CASCADE` |
| `slot_number` | `int` | Nomor soal |
| `question_id` | `uuid` | FK → `questions` `ON DELETE CASCADE` |
| `points` | `int` | Poin yang didapat |
| `answered_at` | `timestamptz` | Dipakai untuk tie-break |

Batasan: UNIQUE `(session_id, team_id, slot_number)` mencegah poin ganda.

### `activity_logs`
Feed untuk panel "Log Aktivitas".

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `team_id` | `uuid` | FK → `teams` `ON DELETE SET NULL` |
| `message` | `text` | Teks log |
| `kind` | `varchar(20)` | `INFO` / `CLAIM` / `ATTACK` / `JOIN` / `SYSTEM` / `ERROR` |
| `created_at` | `timestamptz` | |

Jawaban benar memakai `kind = CLAIM` (hijau), jawaban salah memakai `kind = INFO` (kuning).

### `app_settings`
Pengaturan aplikasi (khusus server), mis. `gemini_api_key` dan `gemini_model`.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `key` | `varchar(50)` | PK, nama pengaturan (mis. `gemini_api_key`) |
| `value` | `text` | Nilai pengaturan |
| `updated_at` | `timestamptz` | Default `now()` |

## 2. Keamanan (RLS)

- RLS **aktif** di semua tabel.
- **Anon/authenticated**: hanya `SELECT` pada `sessions`, `teams`, `session_questions`,
  `answers`, `activity_logs` (dibutuhkan realtime).
- **`questions` dan `question_groups`**: tanpa policy baca untuk anon → `correct_answer` tidak
  dapat diakses browser. Daftar group/soal di UI guru dibaca lewat Server Action (service role)
  dan hanya mengembalikan kolom aman (`PublicQuestion`).
- **`app_settings`**: RLS aktif tanpa policy apa pun → hanya `service_role` (Server Action) yang
  dapat membaca/menulis. Dipakai menyimpan `gemini_api_key`; key tidak pernah dikirim ke browser
  (UI hanya menampilkan versi tersamarkan).
- **Semua tulis** lewat service role di Server Actions (service role melewati RLS).
- **RPC `request_question` / `submit_answer`** di-`revoke` dari `public`, `anon`, dan
  `authenticated`; hanya `service_role` yang boleh `execute`. Tanpa ini, klien bisa memanggil
  `submit_answer` lewat PostgREST dan menebak kunci jawaban dari nilai `correct`.
- Tidak ada autentikasi (sesuai PRD); jaga kode sesi tetap di dalam kelas.

## 3. Realtime (Broadcast hybrid)

Klien **tidak lagi memakai `postgres_changes`**. Perubahan game dikirim sebagai **Broadcast**
ringan dari database lewat trigger → `realtime.send()` ke topik `game-<session_id>`:

| Event | Trigger | Payload |
| :--- | :--- | :--- |
| `answer.created` | `after insert on answers` | `{ answer: {...} }` (delta satu jawaban) |
| `team.joined` | `after insert on teams` | `{ team: {...} }` |
| `session.updated` | `after update on sessions` | `{ session: {...} }` |
| `log.created` | `after insert on activity_logs` (kind `ERROR`) | `{ log: {...} }` |

- `activity_logs` hanya di-broadcast saat `kind = 'ERROR'` (mis. tim meninggalkan/keluar dari
  permainan) agar panel proyektor bisa menampilkan peringatan seketika tanpa lonjakan pesan.
  Log lain diperbarui lewat rekonsiliasi berkala (15 detik) dan saat event jawaban.
- Klien menerapkan delta secara langsung (`answer.created` menambah `answers`,
  `team.joined` menambah `teams`, `log.created` menambah `logs`) lalu menjadwalkan rekonsiliasi
  terkoalesi (200 ms).
- Rekonsiliasi penuh (`fetchGameState`) juga dipicu saat tab kembali fokus (`visibilitychange`)
  dan saat koneksi `online`.
- `session_questions` tidak di-realtime (dibaca lewat `fetchGameState`).

Fungsi `broadcast_game_change()` dan `normalize_answer()` dibuat di skema. Trigger:
`broadcast_answers`, `broadcast_teams`, `broadcast_sessions`, `broadcast_activity_logs`.

## 4. Fungsi RPC

| Fungsi | Kegunaan |
| :--- | :--- |
| `normalize_answer(text)` | Normalisasi jawaban (identik dengan `lib/game.ts`) |
| `request_question(code, team_id, slot)` | Ambil soal + `solved` + `wrong_attempts` dalam satu round-trip |
| `submit_answer(code, team_id, slot, answer)` | Validasi + `insert answers` + `score = score + gained` + log, atomik |
| `broadcast_game_change()` | Trigger Broadcast |

`submit_answer` mengunci baris tim (`for update`) sehingga penambahan skor tidak lagi
read-modify-write dan bebas race condition.

## 5. Cara Migrasi

### Database baru
1. Buka Supabase → **SQL Editor**, jalankan `supabase/schema.sql`.
2. (Opsional) Jalankan `supabase/seed.sql` untuk bank soal contoh.
3. Isi `.env.local` (lihat `docs/SETUP.md`).

### Database yang sudah ada
Jalankan `supabase/migration_optimizations.sql` (hanya menambah index, trigger, dan RPC; aman
diulang). Skema `schema.sql` juga idempoten, tetapi migrasi ini lebih ringkas dan tidak menyentuh
tabel/policy.

## 6. Catatan Kuota

- Index: `answers(session_id)`, `answers(team_id)`, `session_questions(session_id)`,
  `sessions(group_id)`, `sessions(status)`, `questions(group_id)`,
  `questions(group_id, difficulty)`, `activity_logs(session_id, created_at desc)`,
  `activity_logs(session_id, team_id, created_at desc)`.
- Query log dibatasi 50 entri terbaru.
- Realtime memakai Broadcast (bukan `postgres_changes`) sehingga tidak membebani WAL/RLS
  per perubahan; kuota Free tier adalah 200 koneksi & 100 pesan/detik.
- Tidak ada polling; rekonsiliasi 15 detik memakai Server Action, bukan pesan Realtime.
