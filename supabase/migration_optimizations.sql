-- Classroom Conquest — Migrasi Optimasi (jalankan pada DB yang SUDAH ADA)
-- Berisi HANYA objek baru: index tambahan, Broadcast trigger, RPC atomik, dan
-- tabel pengaturan aplikasi (app_settings). Aman dijalankan berulang. Untuk
-- database baru, cukup jalankan schema.sql.

-- 0. Mode Ular Tangga: kolom baru + tabel langkah (aman diulang)
alter table public.sessions
    add column if not exists game_mode varchar(10) not null default 'CLASSIC'
    check (game_mode in ('CLASSIC', 'SNAKES'));
alter table public.sessions add column if not exists board_config jsonb;
alter table public.teams add column if not exists avatar varchar(30);
alter table public.teams add column if not exists position int not null default 0;
alter table public.teams add column if not exists finished_at timestamptz;

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

create index if not exists moves_session_idx on public.moves (session_id);
create index if not exists moves_team_idx on public.moves (team_id);

alter table public.moves enable row level security;

drop policy if exists "public read moves" on public.moves;
create policy "public read moves" on public.moves
    for select using (true);

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

-- 5b. RPC: pergerakan bidak mode Ular Tangga (atomik per tim)
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
    v_streak int := 0;
    v_delta int;
    v_from int;
    v_goal int;
    v_finish_rule text;
    v_landing int;
    v_raw int;
    v_to int;
    v_jump int;
    v_finished boolean := false;
    v_bounced boolean := false;
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
    select count(*) into v_streak
        from public.moves m
        where m.session_id = v_session.id
          and m.team_id = p_team_id
          and m.correct
          and m.created_at > coalesce(
              (select max(m2.created_at)
                 from public.moves m2
                where m2.session_id = v_session.id
                  and m2.team_id = p_team_id
                  and not m2.correct),
              '-infinity'::timestamptz
          );
    v_steps := case
        when v_question.difficulty = 'HARD' then 9 + floor(random() * 4)::int
        when v_question.difficulty = 'MEDIUM' then 5 + floor(random() * 4)::int
        else 2 + floor(random() * 3)::int
    end;
    v_delta := case when v_correct then v_steps else 0 end;

    v_goal := coalesce((v_session.board_config->>'goal')::int, 50);
    v_finish_rule := coalesce(v_session.board_config->>'finishRule', 'OVERSHOOT');
    v_from := coalesce(v_team.position, 0);
    v_landing := v_from + v_delta;
    v_raw := least(v_goal, greatest(0, v_landing));
    v_to := v_raw;
    v_jump := 0;

    if v_correct then
        if v_landing > v_goal then
            if v_finish_rule = 'EXACT' then
                v_bounced := true;
                v_to := greatest(0, 2 * v_goal - v_landing);
                v_raw := v_goal;
                v_jump := v_to - v_goal;
            else
                v_finished := true;
                v_to := v_goal;
                v_raw := v_goal;
            end if;
        elsif v_landing = v_goal then
            v_finished := true;
            v_to := v_goal;
            v_raw := v_goal;
        else
            v_raw := v_landing;
            v_to := v_raw;
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

        if v_bounced then
            v_message := 'Benar! Langkah ' || v_delta
                || ' petak, melewati finis dan mantul ke petak ' || v_to;
        elsif v_finished then
            if v_landing = v_goal then
                v_message := 'Benar! Finis sempurna!';
            else
                v_message := 'Benar! Bidak mencapai finis.';
            end if;
        else
            v_message := 'Benar! Maju ' || v_delta || ' petak';
            if v_jump > 0 then
                v_message := v_message || '. Naik tangga ke petak ' || v_to;
            elsif v_jump < 0 then
                v_message := v_message || '. Kena ular, turun ke petak ' || v_to;
            else
                v_message := v_message || '. Bidak di petak ' || v_to;
            end if;
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
        'finished', v_finished,
        'streak', case when v_correct then v_streak + 1 else 0 end,
        'bounced', v_bounced
    );
end $$;

-- 6. Hanya service role yang boleh memanggil RPC (cegah brute-force kunci jawaban)
revoke all on function public.request_question(text, uuid, int) from public, anon, authenticated;
revoke all on function public.submit_answer(text, uuid, int, text) from public, anon, authenticated;
revoke all on function public.submit_move(text, uuid, int, text) from public, anon, authenticated;
revoke all on function public.broadcast_game_change() from public, anon, authenticated;
revoke all on function public.normalize_answer(text) from public, anon, authenticated;
grant execute on function public.request_question(text, uuid, int) to service_role;
grant execute on function public.submit_answer(text, uuid, int, text) to service_role;
grant execute on function public.submit_move(text, uuid, int, text) to service_role;

-- 7. Pengaturan aplikasi (API key Gemini, pilihan model)
create table if not exists public.app_settings (
    key varchar(50) primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- Tanpa policy: hanya service_role (Server Action) yang dapat mengaksesnya.
