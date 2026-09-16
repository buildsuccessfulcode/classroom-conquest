-- Classroom Conquest — Migrasi Optimasi (jalankan pada DB yang SUDAH ADA)
-- Berisi HANYA objek baru: index tambahan, Broadcast trigger, RPC atomik, dan
-- tabel pengaturan aplikasi (app_settings). Aman dijalankan berulang. Untuk
-- database baru, cukup jalankan schema.sql.

-- 1. Index tambahan
create index if not exists sessions_status_idx
    on public.sessions (status);
create index if not exists activity_logs_team_slot_idx
    on public.activity_logs (session_id, team_id, created_at desc);
create index if not exists questions_group_difficulty_idx
    on public.questions (group_id, difficulty);

-- 2. Normalisasi jawaban (dipakai RPC)
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

-- 3. Broadcast ringan dari database (delta kecil, hemat kuota Free tier)
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
                    'score', new.score,
                    'joined_at', new.joined_at
                )
            ),
            'team.joined',
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

drop trigger if exists broadcast_sessions on public.sessions;
create trigger broadcast_sessions
    after update on public.sessions
    for each row execute function public.broadcast_game_change();

drop trigger if exists broadcast_activity_logs on public.activity_logs;
create trigger broadcast_activity_logs
    after insert on public.activity_logs
    for each row execute function public.broadcast_game_change();

-- 4. RPC: ambil soal + status + percobaan dalam satu round-trip
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

    return jsonb_build_object(
        'session_id', v_session.id,
        'question', to_jsonb(v_question),
        'solved', v_solved,
        'wrong_attempts', v_wrong
    );
end $$;

-- 5. RPC: validasi + skor + log atomik (bebas race condition)
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

-- 6. Hanya service role yang boleh memanggil RPC (cegah brute-force kunci jawaban)
revoke all on function public.request_question(text, uuid, int) from public, anon, authenticated;
revoke all on function public.submit_answer(text, uuid, int, text) from public, anon, authenticated;
revoke all on function public.broadcast_game_change() from public, anon, authenticated;
revoke all on function public.normalize_answer(text) from public, anon, authenticated;
grant execute on function public.request_question(text, uuid, int) to service_role;
grant execute on function public.submit_answer(text, uuid, int, text) to service_role;

-- 7. Pengaturan aplikasi (API key Gemini, pilihan model)
create table if not exists public.app_settings (
    key varchar(50) primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- Tanpa policy: hanya service_role (Server Action) yang dapat mengaksesnya.
