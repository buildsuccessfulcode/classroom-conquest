-- Classroom Conquest — Skema Database (Supabase / PostgreSQL)
-- Konsep: tanpa peta wilayah. Papan berisi nomor soal 1..N; setiap tim
-- menjawab semua nomor secara mandiri dan poin diakumulasi.
-- Jalankan seluruh file ini di Supabase SQL Editor pada database baru.

create extension if not exists pgcrypto;

-- 1. Group bank soal
create table if not exists public.question_groups (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) unique not null,
    subject varchar(50) not null,
    created_at timestamptz not null default now()
);

-- 2. Sesi permainan
create table if not exists public.sessions (
    id uuid primary key default gen_random_uuid(),
    session_code varchar(6) unique not null,
    group_id uuid not null references public.question_groups(id) on delete restrict,
    subject_name varchar(100) not null,
    is_active boolean not null default true,
    status varchar(20) not null default 'LOBBY'
        check (status in ('LOBBY', 'PLAYING', 'ENDED')),
    duration_minutes int not null default 30,
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz not null default now()
);

-- 3. Tim / kelompok
create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    team_name varchar(50) not null,
    color_code varchar(7) not null,
    score int not null default 0,
    joined_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (session_id, team_name)
);

-- 4. Bank soal
create table if not exists public.questions (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.question_groups(id) on delete cascade,
    subject varchar(50) not null,
    type varchar(20) not null default 'MULTIPLE_CHOICE'
        check (type in ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'REARRANGE_WORDS')),
    difficulty varchar(10) not null default 'EASY'
        check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
    question_text text not null,
    metadata jsonb,
    correct_answer text not null,
    points int not null default 100,
    created_at timestamptz not null default now()
);

-- 5. Nomor soal per sesi (snapshot bank soal saat sesi dibuat)
create table if not exists public.session_questions (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    slot_number int not null,
    question_id uuid not null references public.questions(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (session_id, slot_number),
    unique (session_id, question_id)
);

-- 6. Jawaban benar per tim (hanya jawaban benar yang disimpan)
create table if not exists public.answers (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    slot_number int not null,
    question_id uuid not null references public.questions(id) on delete cascade,
    points int not null default 0,
    answered_at timestamptz not null default now(),
    unique (session_id, team_id, slot_number)
);

-- 7. Log aktivitas (panel live log)
create table if not exists public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    team_id uuid references public.teams(id) on delete set null,
    message text not null,
    kind varchar(20) not null default 'INFO'
        check (kind in ('INFO', 'CLAIM', 'ATTACK', 'JOIN', 'SYSTEM', 'ERROR')),
    created_at timestamptz not null default now()
);

-- Index untuk filter realtime dan query umum
create index if not exists teams_session_idx on public.teams (session_id);
create index if not exists sessions_group_idx on public.sessions (group_id);
create index if not exists session_questions_session_idx
    on public.session_questions (session_id);
create index if not exists answers_session_idx on public.answers (session_id);
create index if not exists answers_team_idx on public.answers (team_id);
create index if not exists activity_logs_session_idx
    on public.activity_logs (session_id, created_at desc);
create index if not exists questions_group_idx on public.questions (group_id);
create index if not exists questions_subject_idx
    on public.questions (subject, difficulty, type);

-- Row Level Security
alter table public.question_groups enable row level security;
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.questions enable row level security;
alter table public.session_questions enable row level security;
alter table public.answers enable row level security;
alter table public.activity_logs enable row level security;

-- Anon hanya boleh membaca tabel publik. Tidak ada policy untuk questions dan
-- question_groups, sehingga correct_answer tidak dapat diakses dari browser.
drop policy if exists "public read sessions" on public.sessions;
create policy "public read sessions" on public.sessions
    for select using (true);

drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams
    for select using (true);

drop policy if exists "public read session_questions" on public.session_questions;
create policy "public read session_questions" on public.session_questions
    for select using (true);

drop policy if exists "public read answers" on public.answers;
create policy "public read answers" on public.answers
    for select using (true);

drop policy if exists "public read activity_logs" on public.activity_logs;
create policy "public read activity_logs" on public.activity_logs
    for select using (true);

-- Aktifkan Realtime untuk tabel yang perlu siaran langsung
do $$
begin
    begin
        alter publication supabase_realtime add table public.answers;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.teams;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.activity_logs;
    exception when duplicate_object then null;
    end;
end $$;
