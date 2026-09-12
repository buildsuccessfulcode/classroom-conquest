<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Classroom Conquest — Panduan Agen

Baca [`docs/CONTEXT.md`](docs/CONTEXT.md) untuk konteks ringkas. Detail: `docs/`, rencana: `plans/`.

- Stack: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Supabase.
- Next 16 async: `await params`, `await searchParams`, `await cookies()`, `await headers()`.
- Tulis data hanya via Server Actions di `app/actions.ts`; logika murni di `lib/game.ts`.
- Jangan pernah kirim `questions.correct_answer` ke client; gunakan `PublicQuestion`.
- Dukung mode Supabase dan mode demo (`localStorage`) lewat `lib/backend.ts`.
- UI Bahasa Indonesia. Tanpa komentar kode dan tanpa emoji.
- Verifikasi: `npm run lint` lalu `npx tsc --noEmit`; build dengan `npm run build`.
