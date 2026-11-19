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
| `game_mode` | `varchar(10)` | `CLASSIC` (default) / `SNAKES` |
| `board_config` | `jsonb` | Konfigurasi papan Ular Tangga: `{ goal, preset, seed, finishRule, ladders, snakes }` (`finishRule`: `OVERSHOOT`/`EXACT`; sesi lama tanpa field ini dianggap `OVERSHOOT`) |
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
| `avatar` | `varchar(30)` | Id avatar SVG (mode Ular Tangga), null di mode klasik |
| `position` | `int` | Petak bidak saat ini (mode Ular Tangga), default 0 |
| `finished_at` | `timestamptz` | Diisi saat bidak mencapai finis |
| `score` | `int` | Default 0 (mode klasik; disinkronkan dari `answers`) |
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
Jawaban **benar** per tim. Jawaban salah dicatat di `slot_attempts`.

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

### `slot_attempts`
Hitungan percobaan salah per nomor per tim (mode klasik). Menggantikan parsing teks log.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `team_id` | `uuid` | FK → `teams` `ON DELETE CASCADE` |
| `slot_number` | `int` | Nomor soal |
| `attempts` | `int` | Jumlah percobaan salah |
| `last_attempt_at` | `timestamptz` | Waktu percobaan terakhir |

Primary key `(session_id, team_id, slot_number)`.

### `moves`
Riwayat langkah mode Ular Tangga. Satu baris per soal per tim (benar maupun salah).

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `team_id` | `uuid` | FK → `teams` `ON DELETE CASCADE` |
| `slot_number` | `int` | Nomor soal |
| `question_id` | `uuid` | FK → `questions` `ON DELETE CASCADE` |
| `correct` | `boolean` | Hasil jawaban |
| `points` | `int` | Poin soal mentah |
| `delta` | `int` | Perubahan petak hasil undian sesuai kesulitan (Mudah 2–4, Sedang 5–8, Sulit 9–12; 0 saat salah) |
| `from_position` | `int` | Posisi sebelum langkah |
| `to_position` | `int` | Posisi akhir setelah ular/tangga |
| `jump` | `int` | Efek ular/tangga (positif naik, negatif turun) |
| `created_at` | `timestamptz` | |

Batasan: UNIQUE `(session_id, team_id, slot_number)` membuat soal hangus setelah dipakai.

### `activity_logs`
Audit kecurangan dan peristiwa sesi. Panel guru/proyektor hanya menampilkan `ERROR` dan
`SYSTEM`.

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions` `ON DELETE CASCADE` |
| `team_id` | `uuid` | FK → `teams` `ON DELETE SET NULL` |
| `message` | `text` | Teks log |
| `kind` | `varchar(20)` | `INFO` / `CLAIM` / `ATTACK` / `JOIN` / `SYSTEM` / `ERROR` |
| `created_at` | `timestamptz` | |

`ERROR` dipakai untuk peringatan (meninggalkan tab, jawaban benar mencurigakan). `SYSTEM`
dipakai untuk peristiwa sesi (mulai, selesai, reset, waktu habis, pemenang). Kode baru tidak
lagi menulis `CLAIM`, `INFO`, `JOIN`, atau `ATTACK`.

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
  `answers`, `moves`, `activity_logs` (dibutuhkan realtime).
- **`questions` dan `question_groups`**: tanpa policy baca untuk anon → `correct_answer` tidak
  dapat diakses browser. Daftar group/soal di UI guru dibaca lewat Server Action (service role)
  dan hanya mengembalikan kolom aman (`PublicQuestion`).
- **`app_settings`**: RLS aktif tanpa policy apa pun → hanya `service_role` (Server Action) yang
  dapat membaca/menulis. Dipakai menyimpan `gemini_api_key`; key tidak pernah dikirim ke browser
  (UI hanya menampilkan versi tersamarkan).
- **`slot_attempts`**: RLS aktif tanpa policy → hanya `service_role` yang mengaksesnya.
- **Semua tulis** lewat service role di Server Actions (service role melewati RLS).
- **RPC `request_question` / `submit_answer` / `submit_move` / `fetch_game_state` /
  `create_session` / `report_focus_event`** di-`revoke` dari `public`, `anon`, dan
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
| `team.moved` | `after update on teams` (hanya saat `position`/`finished_at` berubah) | `{ team: {...} }` |
| `move.created` | `after insert on moves` | `{ move: {...} }` |
| `attempt.updated` | `after insert or update on slot_attempts` | `{ attempt: {...} }` |
| `session.updated` | `after update on sessions` | `{ session: {...} }` |
| `log.created` | `after insert on activity_logs` | `{ log: {...} }` |

- `activity_logs` hanya menyimpan `ERROR` dan `SYSTEM`, sehingga semuanya aman disiarkan.
- Klien menerapkan delta secara langsung dan **tidak** melakukan full reload per event. Event
  dikumpulkan lalu diterapkan sekali per ~80 ms.
- Rekonsiliasi penuh (`fetch_game_state`) dipicu berkala (20 detik, hanya saat tab visible),
  saat tab kembali fokus, saat `online`, dan saat `session.updated` (reset/start/end).
- `session_questions`, `answers`, `moves`, dan `slot_attempts` awal dibaca lewat
  `fetch_game_state`.

Fungsi `broadcast_game_change()` dan `normalize_answer()` dibuat di skema. Trigger:
`broadcast_answers`, `broadcast_teams`, `broadcast_teams_moved`, `broadcast_moves`,
`broadcast_slot_attempts`, `broadcast_sessions`, `broadcast_activity_logs`.

## 4. Fungsi RPC

| Fungsi | Kegunaan |
| :--- | :--- |
| `normalize_answer(text)` | Normalisasi jawaban (identik dengan `lib/game.ts`) |
| `request_question(code, team_id, slot)` | Ambil soal + `solved` + `wrong_attempts` dari `slot_attempts` |
| `submit_answer(code, team_id, slot, answer)` | Validasi + `insert answers` + skor + upsert `slot_attempts`, atomik |
| `submit_move(code, team_id, slot, answer)` | Validasi + hitung langkah + ular/tangga/pantulan finis + `insert moves` + update posisi/finis + `createdAt`, atomik |
| `fetch_game_state(code, team_id?)` | Seluruh state sesi dalam satu JSON (termasuk auto-end sesi kedaluwarsa) |
| `create_session(code, group_id, duration, mode, board_config)` | Insert sesi + snapshot `session_questions` + log `SYSTEM`, atomik |
| `report_focus_event(code, team_id, away_ms, reason)` | Catat peringatan fokus/tab sebagai `ERROR` |
| `broadcast_game_change()` | Trigger Broadcast |

`submit_answer` mengunci baris tim (`for update`) sehingga penambahan skor tidak lagi
read-modify-write dan bebas race condition. `submit_answer` hanya menulis log `ERROR` untuk
indikasi mencurigakan; jawaban benar/salah tidak lagi membuat log.

## 5. Cara Migrasi

### Database baru
1. Buka Supabase → **SQL Editor**, jalankan `supabase/schema.sql`.
2. (Opsional) Jalankan `supabase/seed.sql` untuk bank soal contoh.
3. Isi `.env.local` (lihat `docs/SETUP.md`).

### Database yang sudah ada
Jalankan `supabase/migration_optimizations.sql` (menambah tabel `moves`, `slot_attempts`,
index, trigger, dan RPC baru; aman diulang). Skema `schema.sql` juga idempoten, tetapi migrasi
ini lebih ringkas. **Jalankan migrasi sebelum men-deploy kode baru** karena kode membaca
`slot_attempts` dan RPC `fetch_game_state`/`create_session`/`report_focus_event`.
Migrasi tidak menghapus log lama; log `CLAIM`/`INFO` lama tetap tersimpan tetapi tidak dibaca
panel dan tidak dihitung lagi.

## 6. Catatan Kuota

- Index: `answers(session_id, answered_at)`, `answers(team_id)`,
  `session_questions(session_id)`, `sessions(group_id)`, `sessions(status)`,
  `sessions(created_at desc)`, `teams(session_id, joined_at)`, `moves(session_id, created_at)`,
  `questions(group_id)`, `questions(group_id, created_at, id)`,
  `questions(group_id, difficulty)`, `activity_logs(session_id, created_at desc)`,
  `activity_logs(session_id, kind, created_at desc)`.
- Query log dibatasi 50 entri terbaru (`ERROR`/`SYSTEM`).
- Realtime memakai Broadcast (bukan `postgres_changes`) sehingga tidak membebani WAL/RLS
  per perubahan; kuota Free tier adalah 200 koneksi & 100 pesan/detik.
- Tidak ada polling; rekonsiliasi 20 detik memakai RPC `fetch_game_state`, bukan pesan Realtime.
