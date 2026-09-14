# Aturan Game

## 1. Persiapan

1. Guru membuka `/teacher`, membuat sesi: mata pelajaran dan durasi. Sistem membuat
   `session_code` 6 karakter.
2. Guru memastikan bank soal untuk mapel tersebut tersedia (impor JSON bila perlu).
3. Proyektor membuka `/display` dan memasukkan kode sesi.
4. Setiap kelompok membuka `/play`, memasukkan kode sesi + nama tim. Sistem memberi warna unik.
   Jumlah tim tidak dibatasi. Bergabung hanya bisa saat sesi berstatus **LOBBY** (sebelum guru
   menekan **Mulai**).
5. Guru menekan **Mulai**. Sistem membuat snapshot bank soal menjadi nomor **1..N**
   (N = jumlah seluruh soal mapel saat itu).

## 2. Papan Nomor

- Papan menampilkan angka **1 sampai N**; tiap angka = satu soal.
- Semua tim melihat nomor yang sama.
- Di `/display`, tiap nomor menampilkan **titik warna tim** yang sudah menjawab benar + jumlah.
- Di `/play`, nomor yang sudah dijawab benar ditandai warna tim + centang dan bisa dibuka
  lagi untuk review (read-only) beserta kunci jawabannya.
- Nomor soal yang sedang dibuka disimpan di URL (`/play?slot=N`), sehingga reload halaman
  tidak menutup popup dan nomor tersebut otomatis dibuka lagi.

## 3. Alur Menjawab

1. Tim memilih nomor mana saja yang tersedia (bebas).
2. Soal muncul sesuai tipe: pilihan ganda, isian singkat/kode, atau menyusun kata.
   Urutan opsi pilihan ganda dan kata acak diacak di server setiap kali soal diminta,
   sehingga urutan tidak sama antar tim.
3. Jika jawaban **benar**:
   - tercatat di tabel `answers` (sekali saja per nomor per tim),
   - `teams.score += question.points`,
   - log: `"Tim X menjawab benar nomor 3 (+150)"`,
   - saat nomor dibuka lagi, kunci jawaban hanya ditampilkan ke tim yang sudah menjawab
     benar nomor tersebut.
4. Jika **salah**: tidak ada penalti, nomor tetap tersedia untuk dicoba lagi, log mencatat
   percobaan gagal beserta nomornya (`"Tim X menjawab salah nomor 3 (percobaan 1/2)"`).
5. **Batas percobaan:** tiap nomor hanya bisa dicoba maksimal `MAX_ATTEMPTS_PER_SLOT` kali
   per tim (default 2). Setelah batas tercapai, nomor **terkunci** untuk tim tersebut;
   permintaan soal dan pengiriman jawaban ditolak di server.
6. Tim boleh melanjutkan ke nomor lain kapan saja, tanpa harus berurutan.

## 4. Tipe Soal

| Tipe | Tampilan | Validasi |
| :--- | :--- | :--- |
| `MULTIPLE_CHOICE` | Tombol opsi dari `metadata.options` | Samakan dengan `correct_answer` |
| `SHORT_ANSWER` | Input teks; `metadata.code_snippet` opsional | Case-insensitive, trim spasi |
| `REARRANGE_WORDS` | Kata acak dari `metadata.words`, disusun | Gabungan kata (spasi tunggal) sama dengan acuan |

Normalisasi jawaban: huruf kecil, rapikan spasi ganda, buang tanda baca tepi.

## 5. Penilaian & Peringkat

- **Poin** = akumulasi poin soal yang dijawab benar.
- Bobot poin: EASY 100, MEDIUM 150, HARD 200.
- **Peringkat**:
  1. Poin terbanyak.
  2. Jika poin sama → **waktu jawaban benar terakhir paling awal** yang unggul. Untuk tim yang
     menjawab semua soal dengan benar, ini sama dengan total durasi tercepat.
  3. Jika masih sama → nama tim (A–Z).

## 6. Timer

- Durasi diatur guru (5–120 menit). Timer dihitung dari `started_at + duration_minutes`.
- Setelah waktu habis, permintaan soal dan pengiriman jawaban ditolak di server.
- Guru juga dapat menekan **Akhiri** untuk menghentikan lebih awal.

## 7. Reset & Akhir Sesi

- **Reset**: menghapus semua `answers`, `activity_logs`, dan `teams` (peserta dikeluarkan),
  `status = LOBBY`, `started_at = null`, timer berhenti. Snapshot nomor soal tetap sama.
  Guru harus menekan **Mulai** lagi dan murid harus bergabung ulang.
- **Akhiri**: `status = ENDED`, `ended_at = now()`. Papan menampilkan pemenang (read-only).
- **Hapus**: menghapus sesi beserta tim, nomor soal, jawaban, dan log (cascade).

## 8. Parameter yang Mudah Diubah

Semua di `lib/game.ts`:

- `pointsFor(difficulty)` — bobot poin.
- `isAnswerCorrect()` — normalisasi jawaban.
- `buildLeaderboard()` — tie-break.
- `MAX_ATTEMPTS_PER_SLOT` — batas percobaan salah per nomor per tim.
- `RAPID_FIRE_INTERVAL_MS` — ambang deteksi jawaban terlalu cepat.
- `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` — batas laju permintaan per tim.

Snapshot soal ada di `ensureSlots()` (`app/actions.ts` dan `lib/demo/engine.ts`).

## 9. Anti-Kecurangan

- **Batas percobaan + kunci** per nomor per tim (lihat bagian 3).
- **Acak opsi & kata** di server agar jawaban tidak mudah dibagikan antar tim.
- **Deteksi anomali:** jawaban benar setelah hampir mencapai batas percobaan, atau jawaban
  benar beruntun dalam `< RAPID_FIRE_INTERVAL_MS`, dicatat sebagai log `ERROR`
  (`"[PERINGATAN] ..."`) sehingga tampil merah di panel Aktivitas guru.
- **Rate limit** permintaan per tim; kelebihan ditolak dengan pesan
  `"Terlalu banyak permintaan. Tunggu sebentar."`
- **Deteksi meninggalkan tab:** saat sesi `PLAYING`, klien memantau
  `visibilitychange`, `blur`, `focus`, dan `pagehide`. Begitu tim meninggalkan tab, server
  langsung mencatat log `ERROR` `[PERINGATAN] Tim X meninggalkan tab permainan` (muncul realtime
  di panel guru). Bila tim kembali setelah pergi **≥ 10 detik**, dicatat log tambahan berisi
  durasinya. Laporan dibatasi maksimal satu per 10 detik per tim. Hanya catatan untuk guru,
  tanpa penalti otomatis.
- Batas ini tidak mencegah siswa membuka browser/aplikasi lain di perangkatnya, dan **tidak
  dapat mendeteksi perangkat kedua** (mis. HP untuk bertanya ke AI). Untuk itu diperlukan
  pengawasan kelas, mode kiosk perangkat, atau filter jaringan.

## 10. Contoh Perhitungan

| Aksi | Poin | Total |
| :--- | :--- | :--- |
| Benar nomor 1 (EASY) | +100 | 100 |
| Benar nomor 2 (MEDIUM) | +150 | 250 |
| Salah nomor 3 | +0 | 250 |
| Benar nomor 4 (HARD) | +200 | 450 |

Jika Tim A dan Tim B sama-sama 450 poin, tim yang jawaban benar terakhirnya lebih awal menang.
