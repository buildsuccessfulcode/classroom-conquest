# Prompt Generate Template Soal

Dokumen ini berisi contoh prompt siap pakai untuk meminta AI (ChatGPT, Gemini, Claude, dsb.)
membuatkan bank soal dalam format JSON yang langsung bisa diimpor di `/teacher`.

> **Baru:** aplikasi kini punya generator bawaan di tab **Bank Soal** (`/teacher`) yang memakai
> Gemini. Isi parameter (mapel, materi, jumlah, distribusi, tipe), lalu **Generate Soal**.
> Prompt di dokumen ini adalah acuan yang dipakai generator tersebut, dan tetap berguna bila
> ingin memakai AI lain secara manual.

## 1. Cara Pakai

1. Salin **Template Prompt** di bawah.
2. Ganti semua placeholder `{...}` sesuai kebutuhan (mapel, materi, jenjang, jumlah, distribusi).
3. Tempel ke AI, lalu salin **hanya** keluaran JSON-nya.
4. Simpan sebagai file `.json` atau tempel di panel **Impor Bank Soal** pada `/teacher`.
5. Jika ada error validasi, minta AI memperbaiki sesuai pesan error (nomor soal disebutkan).

## 2. Template Prompt

```text
Kamu adalah pembuat bank soal untuk aplikasi gamifikasi kelas "Classroom Conquest".

Buatkan bank soal dengan ketentuan:
- Mata pelajaran: {MAPEL}
- Materi/topik: {MATERI}
- Jenjang/kelas: {JENJANG}
- Bahasa: {BAHASA}
- Jumlah soal: {JUMLAH}
- Distribusi kesulitan: EASY {EASY}, MEDIUM {MEDIUM}, HARD {HARD}
- Jenis soal yang dipakai: {TIPE_SOAL}
  (pilih dari: MULTIPLE_CHOICE, SHORT_ANSWER, REARRANGE_WORDS)

Keluarkan HANYA array JSON yang valid, tanpa penjelasan, tanpa markdown, tanpa teks tambahan.
Setiap elemen mengikuti skema berikut:
{
  "subject": "{MAPEL}",
  "type": "MULTIPLE_CHOICE | SHORT_ANSWER | REARRANGE_WORDS",
  "difficulty": "EASY | MEDIUM | HARD",
  "question_text": "teks pertanyaan",
  "metadata": { ... },
  "correct_answer": "jawaban acuan",
  "points": 100
}

Aturan metadata per tipe:
- MULTIPLE_CHOICE: metadata WAJIB punya "options" berisi 4 pilihan teks. Hanya satu pilihan
  yang benar. correct_answer HARUS sama persis dengan salah satu isi options.
- SHORT_ANSWER: jawaban singkat (1-3 kata/angka). Boleh menambah "code_snippet" untuk soal kode.
- REARRANGE_WORDS: metadata WAJIB punya "words" berisi daftar kata. correct_answer adalah
  gabungan semua kata dalam urutan benar, dipisah satu spasi. Semua kata di words harus terpakai.

Aturan penilaian:
- points: EASY = 100, MEDIUM = 150, HARD = 200.

Aturan kualitas:
- Bahasa Indonesia yang baku dan jelas, kecuali soal bahasa Inggris memakai bahasa Inggris.
- Hindari jawaban yang ambigu atau lebih dari satu pilihan benar.
- Sebar materi secara merata dan sesuai tingkat kesulitan.
- Jangan mengulang soal yang sama.
```

## 3. Contoh Prompt Terisi

### a. Bahasa Inggris — Recount Text

```text
Kamu adalah pembuat bank soal untuk aplikasi gamifikasi kelas "Classroom Conquest".
Buatkan 10 soal mata pelajaran English, materi Recount Text, jenjang SMP kelas 8,
bahasa Inggris. Distribusi: EASY 4, MEDIUM 4, HARD 2. Gunakan campuran MULTIPLE_CHOICE
dan REARRANGE_WORDS. Keluarkan HANYA array JSON valid sesuai skema (subject, type,
difficulty, question_text, metadata, correct_answer, points). points: EASY 100,
MEDIUM 150, HARD 200.
```

### b. Coding — Array JavaScript

```text
Kamu adalah pembuat bank soal untuk aplikasi gamifikasi kelas "Classroom Conquest".
Buatkan 8 soal mata pelajaran Coding, materi Array pada JavaScript, jenjang SMK kelas 10,
bahasa Indonesia. Distribusi: EASY 3, MEDIUM 3, HARD 2. Gunakan campuran MULTIPLE_CHOICE
dan SHORT_ANSWER (sertakan metadata.code_snippet bila relevan). Keluarkan HANYA array JSON
valid sesuai skema. points: EASY 100, MEDIUM 150, HARD 200.
```

### c. DDPK — K3LH Laboratorium Komputer

```text
Kamu adalah pembuat bank soal untuk aplikasi gamifikasi kelas "Classroom Conquest".
Buatkan 10 soal mata pelajaran DDPK, materi K3LH di laboratorium komputer, jenjang SMK
kelas 10, bahasa Indonesia. Distribusi: EASY 5, MEDIUM 3, HARD 2. Gunakan MULTIPLE_CHOICE
dan SHORT_ANSWER. Keluarkan HANYA array JSON valid sesuai skema. points: EASY 100,
MEDIUM 150, HARD 200.
```

## 4. Contoh Keluaran yang Benar

```json
[
  {
    "subject": "English",
    "type": "MULTIPLE_CHOICE",
    "difficulty": "EASY",
    "question_text": "Which sentence is grammatically CORRECT for past activities?",
    "metadata": {
      "options": [
        "She goes to school yesterday.",
        "She went to school yesterday.",
        "She is going to school yesterday.",
        "She has go to school yesterday."
      ]
    },
    "correct_answer": "She went to school yesterday.",
    "points": 100
  },
  {
    "subject": "Coding",
    "type": "SHORT_ANSWER",
    "difficulty": "MEDIUM",
    "question_text": "Isi bagian kosong agar tipe data variabel terdeteksi sebagai array:",
    "metadata": {
      "code_snippet": "const data = [];\nconsole.log(Array.____(data)); // output: true"
    },
    "correct_answer": "isArray",
    "points": 150
  },
  {
    "subject": "English",
    "type": "REARRANGE_WORDS",
    "difficulty": "MEDIUM",
    "question_text": "Susun menjadi kalimat yang benar.",
    "metadata": {
      "words": ["The", "students", "are", "reading", "a", "book"]
    },
    "correct_answer": "The students are reading a book",
    "points": 150
  }
]
```

## 5. Checklist Sebelum Impor

- [ ] Keluaran berupa **array** JSON (dibuka `[` dan ditutup `]`), bukan objek tunggal.
- [ ] Setiap `type` valid: `MULTIPLE_CHOICE`, `SHORT_ANSWER`, atau `REARRANGE_WORDS`.
- [ ] Setiap `difficulty` valid: `EASY`, `MEDIUM`, atau `HARD`.
- [ ] `MULTIPLE_CHOICE` punya `metadata.options` (idealnya 4) dan `correct_answer` sama persis
      dengan salah satu opsi.
- [ ] `REARRANGE_WORDS` punya `metadata.words` dan `correct_answer` adalah gabungan semua kata.
- [ ] Tidak ada soal duplikat.
- [ ] Maksimal 500 soal dan ukuran file maksimal 1 MB per impor.
- [ ] Simpan dengan ekstensi `.json` lalu unggah di `/teacher`.

## 6. Tips

- Ingin porsi lebih banyak? Minta AI membuat dalam beberapa batch, lalu gabungkan array-nya.
- Untuk mencocokkan mapel sesi, kolom `subject` boleh apa saja karena sistem akan memakai
  **mata pelajaran yang diisi di panel impor**. Namun sebaiknya tetap diisi agar rapi.
- Jika ingin mengubah bobot poin, minta AI menyesuaikan `points` (mis. HARD 250).
- Contoh file lengkap: [`public/sample-questions.json`](../public/sample-questions.json).
