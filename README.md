# Classroom Conquest

Platform gamifikasi pembelajaran berbasis kelompok. Guru membuat sesi, papan menampilkan
**nomor soal 1..N** dari bank soal mapel, dan tiap tim menjawab nomor secara mandiri untuk
mengumpulkan poin. Soal bisa pilihan ganda, isian singkat/kode, atau menyusun kata. Papan
proyektor diperbarui secara real-time.

## Menjalankan

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>. Tanpa konfigurasi Supabase, aplikasi berjalan dalam **mode demo**
(data tersimpan di `localStorage` browser).

## Halaman

| Path | Peran |
| :--- | :--- |
| `/` | Beranda & pemilih peran |
| `/teacher` | Dashboard guru (buat sesi, impor soal, monitor) |
| `/play` | Antarmuka murid (join tim, jawab nomor soal, review) |
| `/display` | Papan proyektor real-time (`?code=XXXXXX`) |

## Dokumentasi

- [`docs/README.md`](docs/README.md) — indeks dokumentasi
- [`docs/SETUP.md`](docs/SETUP.md) — setup Supabase, env, deploy Vercel
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arsitektur & dual mode
- [`docs/GAME_RULES.md`](docs/GAME_RULES.md) — aturan main
- [`docs/PROMPT_GENERATE_SOAL.md`](docs/PROMPT_GENERATE_SOAL.md) — prompt generate bank soal
- [`plans/IMPLEMENTATION_PLAN.md`](plans/IMPLEMENTATION_PLAN.md) — rencana implementasi

Skema database: [`supabase/schema.sql`](supabase/schema.sql). Contoh bank soal:
[`supabase/sample-questions.json`](supabase/sample-questions.json).

## Tech Stack

Next.js 16 (App Router), React 19, TypeScript, TailwindCSS v4, Supabase (opsional).
