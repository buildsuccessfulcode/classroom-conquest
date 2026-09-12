# API — Server Actions & Tipe

Semua mutasi diekspos sebagai Server Actions di [`app/actions.ts`](../app/actions.ts). Fungsi
client-safe di [`lib/backend.ts`](../lib/backend.ts) memilih implementasi Supabase atau demo.

## 1. Tipe Domain (`lib/types.ts`)

```ts
type QuestionType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'REARRANGE_WORDS'
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type SessionStatus = 'LOBBY' | 'PLAYING' | 'ENDED'
type LogKind = 'INFO' | 'CLAIM' | 'ATTACK' | 'JOIN' | 'SYSTEM' | 'ERROR'

interface QuestionMetadata {
  options?: string[]
  code_snippet?: string
  words?: string[]
}

interface Question {
  id: string; group_id: string; subject: string; type: QuestionType
  difficulty: Difficulty; question_text: string; metadata: QuestionMetadata | null
  correct_answer: string; points: number
}

type PublicQuestion = Omit<Question, 'correct_answer'>

interface QuestionGroup {
  id: string; name: string; subject: string; created_at: string
}

interface QuestionGroupSummary extends QuestionGroup {
  question_count: number
}

interface Session {
  id: string; session_code: string; group_id: string; subject_name: string
  is_active: boolean; status: SessionStatus; duration_minutes: number
  started_at: string | null; ended_at: string | null; created_at: string
}

interface Team {
  id: string; session_id: string; team_name: string; color_code: string
  score: number; joined_at: string
}

interface SessionSlot {
  id: string; session_id: string; slot_number: number
  question_id: string; created_at: string
}

interface Answer {
  id: string; session_id: string; team_id: string; slot_number: number
  question_id: string; points: number; answered_at: string
}

interface ActivityLog {
  id: string; session_id: string; team_id: string | null
  message: string; kind: LogKind; created_at: string
}

interface GameState {
  session: Session
  teams: Team[]
  slots: SessionSlot[]
  answers: Answer[]
  logs: ActivityLog[]
  serverTime: string
}

interface LeaderboardEntry {
  team: Team; points: number; correct: number; total: number
  lastAnsweredAt: string | null; rank: number
}

interface SlotQuestion {
  slotNumber: number
  question: PublicQuestion
  solved: boolean
  attemptsLeft: number
  locked: boolean
}

interface AnswerResult {
  correct: boolean
  message: string
  gainedPoints: number
  attemptsLeft: number
  locked: boolean
}
```

`requestQuestion` mengacak `metadata.options` dan `metadata.words` di server. `attemptsLeft`
dihitung dari `activity_logs` (maks `MAX_ATTEMPTS_PER_SLOT`); `locked` menandakan nomor sudah
terkunci untuk tim tersebut.

## 2. Server Actions

| Action | Input | Output |
| :--- | :--- | :--- |
| `createSession` | `{ groupId, durationMinutes? }` | `{ code: string }` |
| `listSessions` | — | `Session[]` |
| `listQuestionGroups` | — | `QuestionGroupSummary[]` |
| `listGroupQuestions` | `groupId: string` | `PublicQuestion[]` |
| `joinTeam` | `{ sessionCode, teamName }` | `{ team: Team }` |
| `fetchGameState` | `sessionCode: string` | `GameState \| null` |
| `requestQuestion` | `{ sessionCode, teamId, slotNumber }` | `SlotQuestion` |
| `submitAnswer` | `{ sessionCode, teamId, slotNumber, answer }` | `AnswerResult` |
| `importQuestions` | `{ groupName, subject, questions }` | `{ groupId, groupName, inserted, created }` |
| `deleteQuestionGroup` | `groupId: string` | `void` |
| `deleteQuestion` | `questionId: string` | `void` |
| `startSession` | `sessionCode` | `void` |
| `resetSession` | `sessionCode` | `void` |
| `endSession` | `sessionCode` | `void` |
| `deleteSession` | `sessionCode` | `void` |

### Contoh

```ts
await importQuestions({ groupName: 'English Bab 1', subject: 'English', questions })
const groups = await listQuestionGroups()
const { code } = await createSession({ groupId: groups[0].id, durationMinutes: 30 })
await joinTeam({ sessionCode: code, teamName: 'Tim Cyber' })
await startSession(code) // snapshot sudah dibuat saat createSession

const turn = await requestQuestion({ sessionCode: code, teamId, slotNumber: 2 })
// turn.solved = apakah tim ini sudah menjawab benar (mode review)

const res = await submitAnswer({ sessionCode: code, teamId, slotNumber: 2, answer: 'bought' })
// res.correct === true -> poin bertambah, realtime memperbarui papan
```

## 3. Aturan Error

- Action melempar `Error` dengan pesan berbahasa Indonesia yang aman ditampilkan
  (mis. `"Sesi tidak ditemukan"`, `"Soal ini sudah Anda jawab benar"`, `"Waktu sesi sudah habis"`).
- `fetchGameState` mengembalikan `null` bila kode tidak ada (bukan throw).
- `requestQuestion` / `submitAnswer` menolak bila sesi belum `PLAYING`, waktu habis, atau nomor
  tidak valid.
- `requestQuestion` / `submitAnswer` menolak dengan `"Terlalu banyak permintaan. Tunggu sebentar."`
  bila melewati rate limit per tim (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS`).
- `submitAnswer` hanya menyimpan jawaban benar; percobaan salah dicatat di log lengkap dengan
  nomor percobaan.
- `submitAnswer` mengembalikan `{ locked: true }` (bukan throw) bila nomor sudah terkunci setelah
  `MAX_ATTEMPTS_PER_SLOT` percobaan salah.
- Jawaban benar dengan indikasi mencurigakan (hampir habis percobaan atau terlalu cepat)
  menambah `activity_logs` kind `ERROR` berawalan `[PERINGATAN]`.
- `deleteQuestionGroup` / `deleteQuestion` menolak bila group/soal sedang dipakai sesi
  (`"Group sedang dipakai sesi..."` / `"Soal sedang dipakai sesi..."`).

## 4. Snapshot Nomor Soal

`createSession` memanggil `ensureSlots`: mengambil seluruh soal dalam group (`order by created_at,
id`), lalu membuat `session_questions` bernomor `1..N`. `startSession` dan `resetSession` tidak
mengubah snapshot. Jika group kosong, action melempar error.

## 5. Dukungan Demo

`lib/backend.ts` mengekspor fungsi dengan tanda tangan sama. Bila Supabase tidak dikonfigurasi,
implementasi `lib/demo/engine.ts` (kunci `classroom-conquest:demo:v3`) yang dipakai.

- Data demo tersimpan di `localStorage` browser (satu perangkat).
- Sinkronisasi antar-tab memakai `BroadcastChannel`.
