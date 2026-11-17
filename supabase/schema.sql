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
    game_mode varchar(10) not null default 'CLASSIC'
        check (game_mode in ('CLASSIC', 'SNAKES')),
    board_config jsonb,
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
    avatar varchar(30),
    position int not null default 0,
    finished_at timestamptz,
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

-- 6b. Riwayat langkah mode Ular Tangga (satu baris per soal per tim)
create table if not exists public.moves (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    slot_number int not null,
    question_id uuid not null references public.questions(id) on delete cascade,
    correct boolean not null,
    points int not null default 0,
    delta int not null default 0,
    from_position int not null default 0,
    to_position int not null default 0,
    jump int not null default 0,
    created_at timestamptz not null default now(),
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

-- Kolom tambahan mode Ular Tangga (aman dijalankan berulang pada DB lama)
alter table public.sessions
    add column if not exists game_mode varchar(10) not null default 'CLASSIC'
    check (game_mode in ('CLASSIC', 'SNAKES'));
alter table public.sessions add column if not exists board_config jsonb;
alter table public.teams add column if not exists avatar varchar(30);
alter table public.teams add column if not exists position int not null default 0;
alter table public.teams add column if not exists finished_at timestamptz;

-- Index untuk filter realtime dan query umum
create index if not exists teams_session_idx on public.teams (session_id);
create index if not exists sessions_group_idx on public.sessions (group_id);
create index if not exists sessions_status_idx on public.sessions (status);
create index if not exists session_questions_session_idx
    on public.session_questions (session_id);
create index if not exists answers_session_idx on public.answers (session_id);
create index if not exists answers_team_idx on public.answers (team_id);
create index if not exists moves_session_idx on public.moves (session_id);
create index if not exists moves_team_idx on public.moves (team_id);
create index if not exists activity_logs_session_idx
    on public.activity_logs (session_id, created_at desc);
create index if not exists activity_logs_team_slot_idx
    on public.activity_logs (session_id, team_id, created_at desc);
create index if not exists questions_group_idx on public.questions (group_id);
create index if not exists questions_group_difficulty_idx
    on public.questions (group_id, difficulty);
create index if not exists questions_subject_idx
    on public.questions (subject, difficulty, type);

-- Row Level Security
alter table public.question_groups enable row level security;
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.questions enable row level security;
alter table public.session_questions enable row level security;
alter table public.answers enable row level security;
alter table public.moves enable row level security;
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

drop policy if exists "public read moves" on public.moves;
create policy "public read moves" on public.moves
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

-- ============================================================
-- 8. Broadcast ringan + RPC atomik (optimasi realtime & latensi)
-- ============================================================
-- Referensi: https://supabase.com/docs/guides/realtime/broadcast

-- Normalisasi jawaban identik dengan lib/game.ts (tanpa aksen/punctuation).
create or replace function public.normalize_answer(value text)
returns text
language sql
immutable
as $$
    select trim(
        regexp_replace(
            regexp_replace(lower(coalesce(value, '')), '[^[:alnum:]\s]', ' ', 'g'),
            '\s+', ' ', 'g'
        )
    )
$$;

-- Kirim delta kecil ke channel `game-<session_id>` memakai Broadcast publik.
-- Hanya event bernilai tinggi. activity_logs hanya di-broadcast bila kind = 'ERROR'
-- (mis. tim keluar dari permainan) agar hemat kuota.
create or replace function public.broadcast_game_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_table_name = 'answers' and tg_op = 'INSERT' then
        perform realtime.send(
            jsonb_build_object(
                'type', 'answer.created',
                'answer', jsonb_build_object(
                    'id', new.id,
                    'session_id', new.session_id,
                    'team_id', new.team_id,
                    'slot_number', new.slot_number,
                    'question_id', new.question_id,
                    'points', new.points,
                    'answered_at', new.answered_at
                )
            ),
            'answer.created',
            'game-' || new.session_id::text,
            false
        );
    elsif tg_table_name = 'teams' and tg_op = 'INSERT' then
        perform realtime.send(
            jsonb_build_object(
                'type', 'team.joined',
                'team', jsonb_build_object(
                    'id', new.id,
                    'session_id', new.session_id,
                    'team_name', new.team_name,
                    'color_code', new.color_code,
                    'avatar', new.avatar,
                    'position', new.position,
                    'finished_at', new.finished_at,
                    'score', new.score,
                    'joined_at', new.joined_at
                )
            ),
            'team.joined',
            'game-' || new.session_id::text,
            false
        );
    elsif tg_table_name = 'teams' and tg_op = 'UPDATE' then
        perform realtime.send(
            jsonb_build_object(
                'type', 'team.moved',
                'team', jsonb_build_object(
                    'id', new.id,
                    'session_id', new.session_id,
                    'team_name', new.team_name,
                    'color_code', new.color_code,
                    'avatar', new.avatar,
                    'position', new.position,
                    'finished_at', new.finished_at,
                    'score', new.score,
                    'joined_at', new.joined_at
                )
            ),
            'team.moved',
            'game-' || new.session_id::text,
            false
        );
    elsif tg_table_name = 'sessions' and tg_op = 'UPDATE' then
        perform realtime.send(
            jsonb_build_object('type', 'session.updated', 'session', to_jsonb(new)),
            'session.updated',
            'game-' || new.id::text,
            false
        );
    elsif tg_table_name = 'activity_logs' and tg_op = 'INSERT'
          and new.kind = 'ERROR' then
        perform realtime.send(
            jsonb_build_object(
                'type', 'log.created',
                'log', jsonb_build_object(
                    'id', new.id,
                    'session_id', new.session_id,
                    'team_id', new.team_id,
                    'message', new.message,
                    'kind', new.kind,
                    'created_at', new.created_at
                )
            ),
            'log.created',
            'game-' || new.session_id::text,
            false
        );
    end if;
    return null;
end $$;

drop trigger if exists broadcast_answers on public.answers;
create trigger broadcast_answers
    after insert on public.answers
    for each row execute function public.broadcast_game_change();

drop trigger if exists broadcast_teams on public.teams;
create trigger broadcast_teams
    after insert on public.teams
    for each row execute function public.broadcast_game_change();

drop trigger if exists broadcast_teams_moved on public.teams;
create trigger broadcast_teams_moved
    after update on public.teams
    for each row
    when (new.position is distinct from old.position
          or new.finished_at is distinct from old.finished_at)
    execute function public.broadcast_game_change();

drop trigger if exists broadcast_sessions on public.sessions;
create trigger broadcast_sessions
    after update on public.sessions
    for each row execute function public.broadcast_game_change();

drop trigger if exists broadcast_activity_logs on public.activity_logs;
create trigger broadcast_activity_logs
    after insert on public.activity_logs
    for each row execute function public.broadcast_game_change();

-- Ambil soal + status solved + jumlah percobaan salah dalam satu round-trip.
create or replace function public.request_question(
    p_session_code text,
    p_team_id uuid,
    p_slot_number int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_session public.sessions;
    v_team public.teams;
    v_slot public.session_questions;
    v_question public.questions;
    v_solved boolean;
    v_used boolean;
    v_wrong int;
begin
    select * into v_session from public.sessions
        where session_code = upper(trim(p_session_code));
    if v_session.id is null then raise exception 'Sesi tidak ditemukan'; end if;
    if v_session.status = 'ENDED' then raise exception 'Sesi sudah berakhir'; end if;
    if v_session.status <> 'PLAYING' then raise exception 'Sesi belum dimulai'; end if;
    if v_session.started_at is not null
        and now() > v_session.started_at + (v_session.duration_minutes || ' minutes')::interval
    then
        raise exception 'Waktu sesi sudah habis';
    end if;

    select * into v_team from public.teams
        where id = p_team_id and session_id = v_session.id;
    if v_team.id is null then raise exception 'Tim tidak terdaftar di sesi ini'; end if;

    select * into v_slot from public.session_questions
        where session_id = v_session.id and slot_number = p_slot_number;
    if v_slot.id is null then raise exception 'Nomor soal tidak ditemukan'; end if;

    select * into v_question from public.questions where id = v_slot.question_id;
    if v_question.id is null then raise exception 'Soal tidak ditemukan'; end if;

    select exists(
        select 1 from public.answers
        where session_id = v_session.id
          and team_id = p_team_id
          and slot_number = p_slot_number
    ) into v_solved;

    select count(*) into v_wrong from public.activity_logs
        where session_id = v_session.id
          and team_id = p_team_id
          and message like '%menjawab salah nomor ' || p_slot_number || ' (%';

    select exists(
        select 1 from public.moves
        where session_id = v_session.id
          and team_id = p_team_id
          and slot_number = p_slot_number
    ) into v_used;

    return jsonb_build_object(
        'session_id', v_session.id,
        'question', to_jsonb(v_question),
        'solved', v_solved,
        'used', v_used,
        'wrong_attempts', v_wrong
    );
end $$;

-- Validasi + skor + log dalam satu transaksi atomik (tanpa race condition).
create or replace function public.submit_answer(
    p_session_code text,
    p_team_id uuid,
    p_slot_number int,
    p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_session public.sessions;
    v_team public.teams;
    v_slot public.session_questions;
    v_question public.questions;
    v_existing uuid;
    v_wrong int;
    v_gained int;
    v_last timestamptz;
    v_rapid boolean;
begin
    select * into v_session from public.sessions
        where session_code = upper(trim(p_session_code));
    if v_session.id is null then raise exception 'Sesi tidak ditemukan'; end if;
    if v_session.status = 'ENDED' then raise exception 'Sesi sudah berakhir'; end if;
    if v_session.status <> 'PLAYING' then raise exception 'Sesi belum dimulai'; end if;
    if v_session.started_at is not null
        and now() > v_session.started_at + (v_session.duration_minutes || ' minutes')::interval
    then
        raise exception 'Waktu sesi sudah habis';
    end if;

    select * into v_team from public.teams
        where id = p_team_id and session_id = v_session.id
        for update;
    if v_team.id is null then raise exception 'Tim tidak terdaftar di sesi ini'; end if;

    select * into v_slot from public.session_questions
        where session_id = v_session.id and slot_number = p_slot_number;
    if v_slot.id is null then raise exception 'Nomor soal tidak ditemukan'; end if;

    select id into v_existing from public.answers
        where session_id = v_session.id
          and team_id = p_team_id
          and slot_number = p_slot_number;
    if v_existing is not null then raise exception 'Soal ini sudah Anda jawab benar'; end if;

    select count(*) into v_wrong from public.activity_logs
        where session_id = v_session.id
          and team_id = p_team_id
          and message like '%menjawab salah nomor ' || p_slot_number || ' (%';

    if v_wrong >= 2 then
        return jsonb_build_object(
            'correct', false,
            'message', 'Nomor ' || p_slot_number || ' terkunci untuk tim Anda.',
            'gainedPoints', 0,
            'attemptsLeft', 0,
            'locked', true
        );
    end if;

    select * into v_question from public.questions where id = v_slot.question_id;
    if v_question.id is null then raise exception 'Soal tidak ditemukan'; end if;

    if public.normalize_answer(v_question.correct_answer)
        <> public.normalize_answer(p_answer)
    then
        insert into public.activity_logs (session_id, team_id, message, kind)
        values (
            v_session.id,
            p_team_id,
            'Tim ' || v_team.team_name || ' menjawab salah nomor ' || p_slot_number
                || ' (percobaan ' || (v_wrong + 1) || '/2)',
            'INFO'
        );
        return jsonb_build_object(
            'correct', false,
            'message', case
                when (2 - (v_wrong + 1)) > 0
                    then 'Jawaban belum tepat. Sisa percobaan: ' || (2 - (v_wrong + 1))
                else 'Jawaban belum tepat. Nomor ' || p_slot_number || ' terkunci untuk tim Anda.'
            end,
            'gainedPoints', 0,
            'attemptsLeft', greatest(0, 2 - (v_wrong + 1)),
            'locked', (v_wrong + 1) >= 2
        );
    end if;

    v_gained := case
        when v_question.points > 0 then v_question.points
        when v_question.difficulty = 'HARD' then 200
        when v_question.difficulty = 'MEDIUM' then 150
        else 100
    end;

    select max(answered_at) into v_last from public.answers
        where session_id = v_session.id and team_id = p_team_id;
    v_rapid := v_last is not null and (now() - v_last) < interval '2 seconds';

    insert into public.answers
        (session_id, team_id, slot_number, question_id, points, answered_at)
    values
        (v_session.id, p_team_id, p_slot_number, v_question.id, v_gained, now());

    update public.teams set score = score + v_gained where id = p_team_id;

    insert into public.activity_logs (session_id, team_id, message, kind)
    values (
        v_session.id,
        p_team_id,
        'Tim ' || v_team.team_name || ' menjawab benar nomor ' || p_slot_number
            || ' (+' || v_gained || ')',
        'CLAIM'
    );

    if v_wrong >= 1 or v_rapid then
        insert into public.activity_logs (session_id, team_id, message, kind)
        values (
            v_session.id,
            p_team_id,
            '[PERINGATAN] Tim ' || v_team.team_name || ' nomor ' || p_slot_number
                || ' dijawab benar dengan indikasi mencurigakan',
            'ERROR'
        );
    end if;

    return jsonb_build_object(
        'correct', true,
        'message', 'Benar! +' || v_gained || ' poin',
        'gainedPoints', v_gained,
        'attemptsLeft', greatest(0, 2 - v_wrong),
        'locked', false
    );
end $$;

-- Validasi + pergerakan bidak mode Ular Tangga, atomik per tim.
create or replace function public.submit_move(
    p_session_code text,
    p_team_id uuid,
    p_slot_number int,
    p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_session public.sessions;
    v_team public.teams;
    v_slot public.session_questions;
    v_question public.questions;
    v_existing uuid;
    v_correct boolean;
    v_points int;
    v_steps int;
    v_delta int;
    v_from int;
    v_goal int;
    v_raw int;
    v_to int;
    v_jump int;
    v_finished boolean := false;
    v_link jsonb;
    v_message text;
begin
    select * into v_session from public.sessions
        where session_code = upper(trim(p_session_code));
    if v_session.id is null then raise exception 'Sesi tidak ditemukan'; end if;
    if v_session.game_mode <> 'SNAKES' then
        raise exception 'Sesi ini bukan mode Ular Tangga';
    end if;
    if v_session.status = 'ENDED' then raise exception 'Sesi sudah berakhir'; end if;
    if v_session.status <> 'PLAYING' then raise exception 'Sesi belum dimulai'; end if;
    if v_session.started_at is not null
        and now() > v_session.started_at + (v_session.duration_minutes || ' minutes')::interval
    then
        raise exception 'Waktu sesi sudah habis';
    end if;

    select * into v_team from public.teams
        where id = p_team_id and session_id = v_session.id
        for update;
    if v_team.id is null then raise exception 'Tim tidak terdaftar di sesi ini'; end if;
    if v_team.finished_at is not null then
        raise exception 'Tim Anda sudah mencapai finis';
    end if;

    select * into v_slot from public.session_questions
        where session_id = v_session.id and slot_number = p_slot_number;
    if v_slot.id is null then raise exception 'Nomor soal tidak ditemukan'; end if;

    select id into v_existing from public.moves
        where session_id = v_session.id
          and team_id = p_team_id
          and slot_number = p_slot_number;
    if v_existing is not null then
        raise exception 'Soal ini sudah dipakai tim Anda';
    end if;

    select * into v_question from public.questions where id = v_slot.question_id;
    if v_question.id is null then raise exception 'Soal tidak ditemukan'; end if;

    v_correct := public.normalize_answer(v_question.correct_answer)
        = public.normalize_answer(p_answer);

    v_points := case
        when v_question.points > 0 then v_question.points
        when v_question.difficulty = 'HARD' then 200
        when v_question.difficulty = 'MEDIUM' then 150
        else 100
    end;
    v_steps := case
        when v_question.difficulty = 'HARD' then 9 + floor(random() * 4)::int
        when v_question.difficulty = 'MEDIUM' then 5 + floor(random() * 4)::int
        else 2 + floor(random() * 3)::int
    end;
    v_delta := case when v_correct then v_steps else 0 end;

    v_goal := coalesce((v_session.board_config->>'goal')::int, 50);
    v_from := coalesce(v_team.position, 0);
    v_raw := least(v_goal, greatest(0, v_from + v_delta));
    v_to := v_raw;
    v_jump := 0;

    if v_correct then
        if v_raw >= v_goal then
            v_finished := true;
            v_to := v_goal;
        else
            v_link := null;
            select value into v_link
                from jsonb_array_elements(
                    coalesce(v_session.board_config->'ladders', '[]'::jsonb)
                )
                where (value->>'from')::int = v_raw
                limit 1;
            if v_link is null then
                select value into v_link
                    from jsonb_array_elements(
                        coalesce(v_session.board_config->'snakes', '[]'::jsonb)
                    )
                    where (value->>'from')::int = v_raw
                    limit 1;
            end if;
            if v_link is not null then
                v_to := (v_link->>'to')::int;
                v_jump := v_to - v_raw;
            end if;
        end if;
    end if;

    insert into public.moves (
        session_id, team_id, slot_number, question_id, correct, points,
        delta, from_position, to_position, jump
    ) values (
        v_session.id, p_team_id, p_slot_number, v_question.id, v_correct,
        v_points, v_delta, v_from, v_to, v_jump
    );

    if v_correct then
        update public.teams
            set position = v_to,
                finished_at = case
                    when v_finished then coalesce(finished_at, now())
                    else finished_at
                end
            where id = p_team_id;

        v_message := 'Benar! Maju ' || v_steps || ' petak';
        if v_finished then
            v_message := 'Benar! Bidak mencapai finis.';
        elsif v_jump > 0 then
            v_message := v_message || '. Naik tangga ke petak ' || v_to;
        elsif v_jump < 0 then
            v_message := v_message || '. Kena ular, turun ke petak ' || v_to;
        else
            v_message := v_message || '. Bidak di petak ' || v_to;
        end if;
    else
        v_message := 'Jawaban belum tepat. Bidak tetap di petak '
            || v_from || ', soal hangus.';
    end if;

    insert into public.activity_logs (session_id, team_id, message, kind)
    values (
        v_session.id,
        p_team_id,
        'Tim ' || v_team.team_name || ': ' || v_message,
        case when v_correct then 'CLAIM' else 'INFO' end
    );

    if v_finished then
        update public.sessions
            set status = 'ENDED', is_active = false, ended_at = now()
            where id = v_session.id and status = 'PLAYING';
        if found then
            insert into public.activity_logs (session_id, team_id, message, kind)
            values (
                v_session.id,
                p_team_id,
                'Tim ' || v_team.team_name
                    || ' mencapai finis dan memenangkan permainan!',
                'SYSTEM'
            );
        end if;
    end if;

    return jsonb_build_object(
        'correct', v_correct,
        'message', v_message,
        'gainedPoints', case when v_correct then v_points else 0 end,
        'attemptsLeft', 0,
        'locked', not v_correct,
        'delta', v_delta,
        'position', v_to,
        'jump', v_jump,
        'finished', v_finished
    );
end $$;

-- RPC hanya boleh dipanggil service role (server). Cegah brute-force kunci
-- jawaban lewat PostgREST oleh anon.
revoke all on function public.request_question(text, uuid, int) from public, anon, authenticated;
revoke all on function public.submit_answer(text, uuid, int, text) from public, anon, authenticated;
revoke all on function public.submit_move(text, uuid, int, text) from public, anon, authenticated;
revoke all on function public.broadcast_game_change() from public, anon, authenticated;
revoke all on function public.normalize_answer(text) from public, anon, authenticated;
grant execute on function public.request_question(text, uuid, int) to service_role;
grant execute on function public.submit_answer(text, uuid, int, text) to service_role;
grant execute on function public.submit_move(text, uuid, int, text) to service_role;

-- ============================================================
-- 9. Pengaturan aplikasi (API key Gemini, pilihan model)
-- ============================================================
create table if not exists public.app_settings (
    key varchar(50) primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- Sengaja tanpa policy: hanya service_role (Server Action) yang boleh membaca
-- dan menulis. API key tidak pernah sampai ke browser.

