# Setup & Deployment

## 1. Prasyarat

- Node.js 20.9+ (dites di Node 24)
- npm
- Akun Supabase (opsional; tanpa ini aplikasi berjalan di **mode demo**)

## 2. Menjalankan Lokal (Mode Demo)

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>. Karena `.env.local` belum diisi, aplikasi otomatis memakai demo
mode (data di `localStorage` browser). Cocok untuk mencoba alur tanpa Supabase.

## 3. Menghubungkan Supabase (Mode Kelas Nyata)

1. Buat project di <https://supabase.com> (free tier cukup).
2. Buka **SQL Editor**, jalankan isi [`supabase/schema.sql`](../supabase/schema.sql).
3. (Opsional) Jalankan [`supabase/seed.sql`](../supabase/seed.sql) untuk bank soal contoh.
4. Salin kredensial dari **Project Settings → API**:
   - `Project URL`
   - `anon public key`
   - `service_role key` (rahasia, server-only)
5. Buat `.env.local` dari `.env.example`:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

6. Restart `npm run dev`. Indikator mode di halaman `/` akan berubah menjadi **Supabase**.

> **Penting:** `SUPABASE_SERVICE_ROLE_KEY` hanya boleh ada di server (tanpa prefix
> `NEXT_PUBLIC_`). Jangan pernah commit `.env.local` (sudah masuk `.gitignore`).

## 4. Deploy ke Vercel

1. Push repo ke GitHub.
2. Import project di Vercel.
3. Tambahkan Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Tidak ada konfigurasi build khusus.

## 5. Uji Coba di Kelas

1. Guru buka `/teacher`, impor **group soal** lebih dulu bila belum ada.
2. Guru buat sesi dengan memilih group (mis. `English Bab 1`, 30 menit), catat kode.
3. Proyektor buka `/display`, masukkan kode.
4. Murid buka `/play` di HP, masukkan kode + nama tim.
5. Guru menekan **Mulai Sesi** saat siap; nomor soal 1..N sudah dibuat saat sesi dibuat.
6. Tim memilih nomor, menjawab, papan ter-update otomatis.
7. Guru **Akhiri Sesi** untuk mengunci hasil, atau **Reset** untuk main lagi.

## 6. Impor Bank Soal

Guru mengisi bank soal dari halaman `/teacher` dengan mengisi **Nama Group** dan **Mata
Pelajaran**, lalu salah satu cara:

1. **Unggah file** `.json` (tombol "pilih file" atau seret ke area unggah).
2. **Tempel JSON** langsung ke textarea.

Nama group yang sudah ada akan ditambahi soal baru (append). Group dan soal bisa dihapus lewat
panel **Group Soal**; penghapusan ditolak bila group/soal masih dipakai sesi.

Unduh template di tautan **"Unduh contoh JSON"** pada panel impor (file
[`public/sample-questions.json`](../public/sample-questions.json)). Validasi dilakukan di
`lib/questions.ts` (`parseQuestionBank`): tipe, tingkat kesulitan, dan metadata per tipe soal
(`options` untuk pilihan ganda, `words` untuk menyusun kata) diperiksa dengan pesan error
bernomor. Batas 500 soal dan ukuran file maksimal 1 MB per impor.

Contoh isi file:

```json
[
  {
    "subject": "English",
    "type": "MULTIPLE_CHOICE",
    "difficulty": "EASY",
    "question_text": "Which sentence is correct?",
    "metadata": { "options": ["A", "B", "C", "D"] },
    "correct_answer": "A",
    "points": 100
  }
]
```

## 7. Perintah

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Server pengembangan (Turbopack) |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Cek tipe |

## 8. Troubleshooting

| Gejala | Penyebab & solusi |
| :--- | :--- |
| Papan tidak ter-update | Pastikan Realtime aktif dan tabel `answers`, `teams`, `activity_logs` sudah ditambahkan ke publication. |
| `Sesi tidak ditemukan` | Kode salah / sesi terhapus. Buat ulang di `/teacher`. |
| `Group soal kosong` saat buat sesi | Group belum punya soal. Impor di `/teacher`. |
| Nomor soal tidak berubah setelah impor | Snapshot dibuat saat sesi dibuat. Buat sesi baru setelah impor. |
| `Group/Soal sedang dipakai sesi` saat hapus | Hapus sesi yang memakai group/soal tersebut lebih dulu. |
| Selalu mode demo | Env `NEXT_PUBLIC_*` belum terisi atau server belum di-restart. |
| `permission denied for table questions` di server | `SUPABASE_SERVICE_ROLE_KEY` belum diisi. |
