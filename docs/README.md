# Dokumentasi Classroom Conquest

Platform gamifikasi pembelajaran berbasis kelompok. Guru membuat sesi, papan menampilkan
**nomor soal 1..N** (dari bank soal mapel), dan tiap tim menjawab nomor secara mandiri untuk
mengumpulkan poin. Papan proyektor diperbarui secara real-time.

## Daftar Dokumen

| Dokumen | Isi |
| :--- | :--- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Arsitektur, alur data, mode Supabase vs demo, keputusan desain |
| [`DATABASE.md`](./DATABASE.md) | Skema database, ekstensi, RLS, realtime, cara migrasi |
| [`GAME_RULES.md`](./GAME_RULES.md) | Aturan main, alur menjawab, penilaian, tie-break |
| [`API.md`](./API.md) | Kontrak server actions dan tipe data |
| [`SETUP.md`](./SETUP.md) | Setup lokal, Supabase, env, deploy Vercel, uji coba kelas |
| [`PROMPT_GENERATE_SOAL.md`](./PROMPT_GENERATE_SOAL.md) | Contoh prompt untuk generate bank soal per mapel & materi |
| [`CONTEXT.md`](./CONTEXT.md) | Konteks ringkas untuk agen AI (hemat token) |

## Peta Cepat Halaman

| Path | Peran | Ringkasan |
| :--- | :--- | :--- |
| `/` | Umum | Landing + pemilih peran |
| `/rules` | Umum | Aturan permainan lengkap + panduan guru |
| `/teacher` | Guru | Buat sesi, impor bank soal, monitor, reset, akhiri |
| `/play` | Murid | Join tim, pilih nomor, jawab soal, review |
| `/display` | Proyektor | Papan nomor, leaderboard, live log, timer (`?code=XXXXXX`) |

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- TailwindCSS v4
- Supabase (PostgreSQL + Realtime) — opsional; ada mode demo offline
- Deploy target: Vercel
