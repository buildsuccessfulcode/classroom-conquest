# Product Requirement Document (PRD) & Technical Specification

## 1. Document Overview
* **Project Name:** Classroom Conquest (Platform Gamifikasi Pembelajaran Berbasis Kelompok)
* **Target Audience:** Guru & Murid (Bahasa Inggris, Coding, DDPK, dan Mapel Umum Lainnya)
* **Deployment Target:** Vercel (Frontend + Serverless API)
* **Database & Realtime Service:** Supabase (Free Tier)
* **Tech Stack:** Next.js (App Router), TailwindCSS, Supabase JS Client

---

## 2. Executive Summary & Goals
**Classroom Conquest** adalah web app gamifikasi interaktif berbasis kelompok yang mengubah ruang kelas menjadi arena strategi (papan wilayah). Aplikasi dirancang *lightweight*, fleksibel untuk semua mata pelajaran, dan tidak memerlukan backend server yang rumit.

### Key Objectives:
1. **Universal & Dynamic Questions:** Mendukung berbagai tipe soal (Pilihan Ganda, Isian Singkat/Coding Snippet, dan Menyusun Kalimat/Words Rearrange).
2. **Flexible Game Setup:** Ukuran peta (grid map) dan jumlah kelompok/tim bersifat dinamis sesuai kebutuhan kelas.
3. **Real-time & High Engagement:** Menampilkan papan permainan secara langsung di layar proyektor tanpa perlu *refresh*.
4. **Low Complexity Architecture:** Menggunakan arsitektur serverless (Vercel + Supabase) dengan penghematan kuota free-tier.

---

## 3. Game Concept & Rules

```
+-------------------------------------------------------------------------+
|                         PROYEKTOR DEPAN KELAS                           |
|                                                                         |
|   +----+----+----+----+     [LEADERBOARD KELOMPOK DINAMIS]              |
|   | A1 | A2 | A3 | B1 |     1. Tim Cyber    - 4 Wilayah (650 pt)        |
|   +----+----+----+----+     2. Tim Syntax   - 2 Wilayah (300 pt)        |
|   | B2 | B3 | C1 | C2 |     3. Tim Protocol - 1 Wilayah (100 pt)        |
|   +----+----+----+----+     ... (bisa N kelompok)                       |
|   [PETA WILAYAH KELAS]      [LIVE LOG ACTIVITAS]                        |
|   (3x3, 4x4, atau 5x5)      - Tim Cyber berhasil merebut A2!            |
+-------------------------------------------------------------------------+
```

1. **Konfigurasi Fleksibel Sesi (Guru):**
   * Guru memilih ukuran grid: **Small (3x3)**, **Medium (4x4)**, atau **Large (5x5)**.
   * Jumlah tim bebas (*unlimited*), mendaftar mandiri via aplikasi murid dengan warna unik yang di-generate sistem.

2. **Fase Klaim (Ekspansi):**
   * Kelompok memilih wilayah kosong, menjawab soal yang muncul di layar HP/Laptop tim.
   * Jika benar, wilayah menjadi milik kelompok (berubah warna) dan mendapat poin.

3. **Fase Menyerang (Conquest):**
   * Kelompok bisa memilih wilayah yang sudah dikuasai tim lawan.
   * Tingkat kesulitan soal lebih tinggi. Jika benar, wilayah berpindah tangan.

4. **Penentuan Pemenang:**
   * Pemenang ditentukan berdasarkan total wilayah terbanyak dan total poin terkumpul saat durasi sesi habis.

---

## 4. User Interface & Page Structure

Aplikasi terdiri dari 3 alur halaman utama:

| Path | Peran | Deskripsi |
| :--- | :--- | :--- |
| `/display` | **Proyektor Kelas** | Menampilkan peta grid interaktif (dinamis 3x3 s.d 5x5), papan peringkat (leaderboard) seluruh tim, dan log aktivitas *real-time*. |
| `/teacher` | **Dashboard Guru** | Panel kontrol untuk membuat sesi baru (pilih ukuran grid map & bank soal), monitor game, dan reset game. |
| `/play` | **Interface Murid** | Form *login* kelompok (nama tim & pendaftaran otomatis), peta wilayah ringkas, UI interaktif sesuai tipe soal. |

---

## 5. Dynamic Database Schema (Supabase PostgreSQL)

```sql
-- 1. Tabel Sessions (Sesi Permainan)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code VARCHAR(6) UNIQUE NOT NULL, -- Kode unik 6 karakter (misal: K3LH01)
    subject_name VARCHAR(100) NOT NULL,
    grid_size INT DEFAULT 4, -- Ukuran Grid Dinamis (misal: 3 untuk 3x3, 4 untuk 4x4, 5 untuk 5x5)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Teams (Kelompok/Pemain Dinamis)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    team_name VARCHAR(50) NOT NULL,
    color_code VARCHAR(7) NOT NULL, -- Format Hex Code (#FF5733)
    score INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Questions (Bank Soal Dynamic Type)
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject VARCHAR(50) NOT NULL, -- 'English', 'Coding', 'DDPK', dll.
    type VARCHAR(20) CHECK (type IN ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'REARRANGE_WORDS')) DEFAULT 'MULTIPLE_CHOICE',
    difficulty VARCHAR(10) CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    question_text TEXT NOT NULL,
    metadata JSONB, -- Tempat menyimpan opsi pilihan ganda ATAU daftar acakan kata
    correct_answer TEXT NOT NULL, -- Jawaban acuan (case-insensitive check)
    points INT DEFAULT 100
);

-- 4. Tabel Territories (Peta Wilayah Grid)
CREATE TABLE territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    tile_code VARCHAR(10) NOT NULL, -- Misal: 'A1', 'A2', 'B1'
    owner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    question_id UUID REFERENCES questions(id),
    status VARCHAR(20) DEFAULT 'UNCLAIMED', -- 'UNCLAIMED', 'CLAIMED', 'UNDER_ATTACK'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Supabase Realtime for Territories and Teams
ALTER PUBLICATION supabase_realtime ADD TABLE territories;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
```

---

## 6. Implementation Guide (Next.js + Supabase)

### Dynamic UI Rendering Based on Question Type (`/play/components/QuestionCard.tsx`)

```tsx
export default function QuestionCard({ question, onSubmit }: { question: any, onSubmit: (ans: string) => void }) {
  const [inputAnswer, setInputAnswer] = useState('');

  // 1. Render Pilihan Ganda
  if (question.type === 'MULTIPLE_CHOICE') {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-lg">{question.question_text}</p>
        {question.metadata.options.map((opt: string, idx: number) => (
          <button
            key={idx}
            onClick={() => onSubmit(opt)}
            className="p-3 bg-slate-100 hover:bg-indigo-50 text-left rounded-lg border border-slate-200"
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // 2. Render Short Answer / Code Snippet (Coding)
  if (question.type === 'SHORT_ANSWER') {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-semibold text-lg">{question.question_text}</p>
        {question.metadata?.code_snippet && (
          <pre className="p-4 bg-slate-900 text-green-400 rounded-lg font-mono text-sm">
            {question.metadata.code_snippet}
          </pre>
        )}
        <input
          type="text"
          value={inputAnswer}
          onChange={(e) => setInputAnswer(e.target.value)}
          placeholder="Tuliskan jawaban/code di sini..."
          className="p-3 border rounded-lg w-full"
        />
        <button
          onClick={() => onSubmit(inputAnswer)}
          className="p-3 bg-indigo-600 text-white font-bold rounded-lg"
        >
          Submit Jawaban
        </button>
      </div>
    );
  }

  return null;
}
```

---

## 7. Sample Multi-Type Bank Soal JSON Import

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
      "code_snippet": "const data = [];
console.log(Array.____(data)); // output: true"
    },
    "correct_answer": "isArray",
    "points": 150
  },
  {
    "subject": "DDPK",
    "type": "MULTIPLE_CHOICE",
    "difficulty": "EASY",
    "question_text": "Tindakan utama dalam pencegahan kecelakaan kerja K3LH di laboratorium komputer adalah...",
    "metadata": {
      "options": [
        "Membawa makanan ke dekat CPU",
        "Memastikan manajemen kabel rapi dan grounded",
        "Menyiram air saat terjadi korsleting",
        "Meninggalkan kabel terkelupas"
      ]
    },
    "correct_answer": "Memastikan manajemen kabel rapi dan grounded",
    "points": 100
  }
]
```

---

## 8. Deployment Checklist (Vercel)

1. **Supabase Project Setup:**
   * Eksekusi SQL skema terbaru di atas via *SQL Editor* Supabase.
   * Dapatkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Next.js Project Setup & Deployment:**
   * Deploy ke Vercel via GitHub Repository.
   * Daftarkan Environment Variables di Settings Vercel (`NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. **Uji Coba Kelas:**
   * Guru membuat sesi di `/teacher`, menentukan ukuran grid (3x3, 4x4, atau 5x5).
   * Proyektor membuka `/display`.
   * Berapapun kelompok yang ada tinggal *join* via HP ke `/play`.
