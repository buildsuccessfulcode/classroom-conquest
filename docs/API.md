# API — Server Actions & Tipe

Semua mutasi diekspos sebagai Server Actions di [`app/actions.ts`](../app/actions.ts). Fungsi
client-safe di [`lib/backend.ts`](../lib/backend.ts) memilih implementasi Supabase atau demo.

## 1. Tipe Domain (`lib/types.ts`)

```ts
type QuestionType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'REARRANGE_WORDS'
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type SessionStatus = 'LOBBY' | 'PLAYING' | 'ENDED'
type GameMode = 'CLASSIC' | 'SNAKES'
type BoardPreset = 'MUDAH' | 'NORMAL' | 'SULIT'
type FinishRule = 'OVERSHOOT' | 'EXACT'
type LogKind = 'INFO' | 'CLAIM' | 'ATTACK' | 'JOIN' | 'SYSTEM' | 'ERROR'

interface BoardLink { from: number; to: number }
interface BoardConfig {
  goal: number; preset: BoardPreset; seed: number; finishRule?: FinishRule
  ladders: BoardLink[]; snakes: BoardLink[]
}

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
  is_active: boolean; status: SessionStatus; game_mode: GameMode
  board_config: BoardConfig | null; duration_minutes: number
  started_at: string | null; ended_at: string | null; created_at: string
}

interface Team {
  id: string; session_id: string; team_name: string; color_code: string
  avatar: string | null; position: number; finished_at: string | null
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

interface Move {
  id: string; session_id: string; team_id: string; slot_number: number
  question_id: string; correct: boolean; points: number; delta: number
  from_position: number; to_position: number; jump: number; created_at: string
}

interface SlotInfo {
  slot_number: number; question_id: string
  type: QuestionType; difficulty: Difficulty; points: number
}

interface GameState {
  session: Session
  teams: Team[]
  slots: SessionSlot[]
  answers: Answer[]
  moves: Move[]
  slotInfo: SlotInfo[]
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
  used: boolean
  attemptsLeft: number
  locked: boolean
  correctAnswer?: string
}

interface AnswerResult {
  correct: boolean
  message: string
  gainedPoints: number
  attemptsLeft: number
  locked: boolean
  delta?: number
  position?: number
  jump?: number
  finished?: boolean
  streak?: number
  bounced?: boolean
}

interface BoardStanding {
  team: Team; position: number; rank: number; finishedAt: string | null
}

type JoinTeamResult =
  | { ok: true; team: Team }
  | { ok: false; error: string }

interface AiSettings {
  hasKey: boolean
  maskedKey: string | null
  model: string
}

interface GeminiModel {
  id: string
  displayName: string
}

interface GenerateQuestionsInput {
  subject: string; topic: string; grade: string
  language: 'id' | 'en'
  count: number
  distribution: { EASY: number; MEDIUM: number; HARD: number }
  types: QuestionType[]
}

interface GeneratedQuestionBank {
  questions: SeedQuestion[]
  raw: string
  model: string
}
```

`requestQuestion` mengacak `metadata.options` dan `metadata.words` di server. `attemptsLeft`
dihitung dari `activity_logs` (maks `MAX_ATTEMPTS_PER_SLOT`); `locked` menandakan nomor sudah
terkunci untuk tim tersebut. `used` menandakan soal sudah dipakai di mode Ular Tangga.
`correctAnswer` diisi bila `solved === true` atau (mode klasik) `locked === true` (mode review),
yaitu saat tim tersebut sudah menjawab benar nomor itu atau percobaannya sudah habis; selain
itu `undefined`.

Sejak optimasi, `requestQuestion`, `submitAnswer`, dan `submitMove` didelegasikan ke RPC
Postgres (`request_question`, `submit_answer`, `submit_move`) sehingga hanya satu round-trip
dan mutasi bersifat atomik. Kontrak input/output tetap sama. RPC hanya dapat dipanggil oleh
`service_role`.

`submitMove` hanya untuk sesi `game_mode = 'SNAKES'`. Hasilnya memuat `delta` (langkah total
hasil undian), `position` (posisi akhir setelah ular/tangga atau pantulan), `jump` (efek
ular/tangga atau pantulan), `finished`, `streak`, dan `bounced`. Rentang langkah: Mudah 2-4,
Sedang 5-8, Sulit 9-12 petak. `finishRule` pada `board_config` menentukan finis: `OVERSHOOT`
(melewati finis menang) atau `EXACT` (wajib pas; kelebihan mantul mundur). Satu soal hanya
bisa dipakai sekali per tim; jawaban salah tidak memindahkan bidak.
`requestQuestion` mengembalikan `used` untuk menandai soal yang sudah hangus.

## 2. Server Actions

| Action | Input | Output |
| :--- | :--- | :--- |
| `createSession` | `{ groupId, durationMinutes?, mode?, boardPreset?, boardGoal?, finishRule? }` | `{ code: string }` |
| `listSessions` | — | `Session[]` |
| `listQuestionGroups` | — | `QuestionGroupSummary[]` |
| `listGroupQuestions` | `groupId: string` | `Question[]` |
| `joinTeam` | `{ sessionCode, teamName, avatar? }` | `JoinTeamResult` |
| `getSessionPreview` | `sessionCode: string` | `{ mode, status } \| null` |
| `fetchGameState` | `sessionCode: string` | `GameState \| null` |
| `requestQuestion` | `{ sessionCode, teamId, slotNumber }` | `SlotQuestion` |
| `submitAnswer` | `{ sessionCode, teamId, slotNumber, answer }` | `AnswerResult` |
| `submitMove` | `{ sessionCode, teamId, slotNumber, answer }` | `AnswerResult` |
| `reportFocusEvent` | `{ sessionCode, teamId, awayMs, reason? }` | `void` |
| `importQuestions` | `{ groupName, subject, questions }` | `{ groupId, groupName, inserted, created }` |
| `deleteQuestionGroup` | `groupId: string` | `void` |
| `deleteQuestion` | `questionId: string` | `void` |
| `getAiSettings` | — | `AiSettings` |
| `saveAiSettings` | `{ apiKey?, model? }` | `AiSettings` |
| `clearAiKey` | — | `AiSettings` |
| `listGeminiModels` | `apiKey?: string` | `GeminiModel[]` |
| `generateQuestions` | `GenerateQuestionsInput` | `GeneratedQuestionBank` |
| `startSession` | `sessionCode` | `void` |
| `resetSession` | `sessionCode` | `void` |
| `endSession` | `sessionCode` | `void` |
| `deleteSession` | `sessionCode` | `void` |

`listGroupQuestions` hanya untuk guru (`requireTeacher`) sehingga menyertakan `correct_answer`
agar jawaban bisa ditampilkan di tab Bank Soal.

### Contoh

```ts
await importQuestions({ groupName: 'English Bab 1', subject: 'English', questions })
const groups = await listQuestionGroups()
const { code } = await createSession({ groupId: groups[0].id, durationMinutes: 30 })
await joinTeam({ sessionCode: code, teamName: 'Tim Cyber' })
await startSession(code) // snapshot sudah dibuat saat createSession

const turn = await requestQuestion({ sessionCode: code, teamId, slotNumber: 2 })
// turn.solved = apakah tim ini sudah menjawab benar (mode review)
// turn.correctAnswer = kunci jawaban, ada bila turn.solved atau turn.locked

const res = await submitAnswer({ sessionCode: code, teamId, slotNumber: 2, answer: 'bought' })
// res.correct === true -> poin bertambah, realtime memperbarui papan
```

## 3. Aturan Error

- Action melempar `Error` dengan pesan berbahasa Indonesia yang aman ditampilkan
  (mis. `"Sesi tidak ditemukan"`, `"Soal ini sudah Anda jawab benar"`, `"Waktu sesi sudah habis"`).
- `fetchGameState` mengembalikan `null` bila kode tidak ada (bukan throw).
- `joinTeam` hanya berhasil saat sesi `LOBBY`; untuk sesi tidak ditemukan, `ENDED`, sudah
  `PLAYING`, atau nama kosong ia mengembalikan `{ ok: false, error }` (bukan throw) agar pesan
  dapat ditampilkan di klien.
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
- `reportFocusEvent` dipanggil klien saat tim meninggalkan tab permainan (`reason: "leave"`),
  kembali setelah pergi ≥ 10 detik (`reason: "return"`), atau keluar/menutup tab
  (`reason: "exit"`). Setiap laporan menambah `activity_logs` kind `ERROR` berawalan
  `[PERINGATAN]`. Bila sesi tidak `PLAYING`, waktu habis, atau tim tidak terdaftar, action ini
  diam (tidak throw) agar tidak mengganggu permainan.
- `deleteQuestionGroup` / `deleteQuestion` menolak bila group/soal sedang dipakai sesi
  (`"Group sedang dipakai sesi..."` / `"Soal sedang dipakai sesi..."`).

## 4. Snapshot Nomor Soal

`createSession` memanggil `ensureSlots`: mengambil seluruh soal dalam group (`order by created_at,
id`), lalu membuat `session_questions` bernomor `1..N`. `startSession` dan `resetSession` tidak
mengubah snapshot. Jika group kosong, action melempar error. `resetSession` menghapus tim,
jawaban, dan log, lalu mengembalikan sesi ke `LOBBY` (`started_at = null`) sehingga guru harus
menekan **Mulai** lagi.

## 5. Dukungan Demo

`lib/backend.ts` mengekspor fungsi dengan tanda tangan sama. Bila Supabase tidak dikonfigurasi,
implementasi `lib/demo/engine.ts` (kunci `classroom-conquest:demo:v4`, dengan fallback baca
`v3`) yang dipakai.

- Data demo tersimpan di `localStorage` browser (satu perangkat).
- Sinkronisasi antar-tab memakai `BroadcastChannel`.

## 6. Realtime

`lib/backend.ts` juga mengekspor `subscribe(sessionId, onEvent): Promise<() => void>` dengan tipe
`RealtimeEvent`:

```ts
type RealtimeEvent =
  | { type: 'answer.created'; answer: Answer }
  | { type: 'team.joined'; team: Team }
  | { type: 'team.moved'; team: Team }
  | { type: 'session.updated'; session: Session }
  | { type: 'log.created'; log: ActivityLog }
  | { type: 'refresh' }
```

Mode Supabase memakai Broadcast (`answer.created`, `team.joined`, `team.moved`,
`session.updated`, `log.created`); mode demo
selalu memancarkan `{ type: 'refresh' }`. `useGameState` menerapkan delta untuk `answer.created`
dan `team.joined`, memperbarui `session.updated`, lalu menjadwalkan rekonsiliasi terkoalesi.

## 7. Integrasi AI (Gemini)

Fasad `lib/backend.ts` juga mengekspor `getAiSettings`, `saveAiSettings`, `clearAiKey`,
`listGeminiModels`, dan `generateQuestions`.

- **Mode Supabase**: key dibaca/ditulis di tabel `app_settings` lewat Server Action; `generateQuestions`
  memakai key tersimpan (tidak ada key yang dikirim klien).
- **Mode demo**: key dibaca dari `localStorage` (`classroom-conquest:ai:v1`) lalu diteruskan ke
  Server Action yang sama, sehingga pemanggilan Gemini tetap dari server (bebas CORS).
- `getAiSettings` **tidak pernah** mengembalikan key mentah; hanya `maskedKey` (4 karakter terakhir).
- `generateQuestions` memvalidasi input (mapel wajib; materi opsional; jumlah 1–50; tipe valid,
  kosong = semua tipe; distribusi), menerapkan rate limit, memanggil `lib/ai/gemini.ts`, lalu
  memvalidasi ulang keluaran dengan `parseQuestionBank`.
- `listGeminiModels` memakai endpoint `models` Gemini dan menyaring model yang mendukung
  `generateContent`. Default model: `gemini-2.5-flash`.
