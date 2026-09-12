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

## 2. Keamanan (RLS)

- RLS **aktif** di semua tabel.
- **Anon/authenticated**: hanya `SELECT` pada `sessions`, `teams`, `session_questions`,
  `answers`, `activity_logs` (dibutuhkan realtime).
- **`questions` dan `question_groups`**: tanpa policy baca untuk anon → `correct_answer` tidak
  dapat diakses browser. Daftar group/soal di UI guru dibaca lewat Server Action (service role)
  dan hanya mengembalikan kolom aman (`PublicQuestion`).
- **Semua tulis** lewat service role di Server Actions (service role melewati RLS).
- Tidak ada autentikasi (sesuai PRD); jaga kode sesi tetap di dalam kelas.

## 3. Realtime

```sql
alter publication supabase_realtime add table public.answers;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.activity_logs;
```

Browser berlangganan `postgres_changes` dengan filter `session_id=eq.<uuid>` pada ketiga tabel.
`session_questions` tidak di-realtime (dibaca lewat `fetchGameState`).

## 4. Cara Migrasi

1. Buat database Supabase baru (atau hapus tabel lama).
2. Buka Supabase → **SQL Editor**, jalankan `supabase/schema.sql`.
3. (Opsional) Jalankan `supabase/seed.sql` untuk bank soal contoh (membuat group `Contoh ...`).
4. Isi `.env.local` (lihat `docs/SETUP.md`).

Untuk database lama yang sudah berisi soal, tambahkan `group_id`: buat group dari
`distinct subject`, isi `questions.group_id` dan `sessions.group_id`, baru ubah kolom menjadi
`not null`. Aplikasi demo memakai kunci penyimpanan `classroom-conquest:demo:v3` (data `v2`
diabaikan).

## 5. Catatan Kuota

- Index pada `answers(session_id)`, `answers(team_id)`, `session_questions(session_id)`,
  `sessions(group_id)`, `questions(group_id)`.
- Query log dibatasi 50 entri terbaru.
- Tidak ada trigger berat.
