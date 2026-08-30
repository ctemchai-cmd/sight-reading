create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  default_clef text not null default 'treble' check (default_clef in ('treble')),
  default_min_midi integer not null default 60 check (default_min_midi between 0 and 127),
  default_max_midi integer not null default 81 check (default_max_midi between 0 and 127),
  default_session_length integer not null default 71 check (default_session_length > 0),
  adaptive_mode boolean not null default false,
  sound_enabled boolean not null default true,
  midi_sound_enabled boolean not null default false,
  input_preference text not null default 'midi',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (default_min_midi <= default_max_midi)
);

create table public.training_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('reflex', 'sheet')),
  clef text not null check (clef in ('treble')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  end_reason text not null check (end_reason in ('target-reached', 'user-stopped')),
  completed_targets integer not null check (completed_targets >= 0),
  first_try_correct_count integer not null check (first_try_correct_count >= 0),
  mistake_count integer not null check (mistake_count >= 0),
  accuracy numeric not null check (accuracy between 0 and 1),
  average_response_ms numeric,
  median_response_ms numeric,
  best_response_ms numeric,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table public.training_trials (
  id uuid primary key,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence_index integer not null check (sequence_index >= 0),
  target_midi integer not null check (target_midi between 0 and 127),
  target_notation jsonb not null,
  correct_response_ms integer not null check (correct_response_ms >= 0),
  first_attempt_ms integer not null check (first_attempt_ms >= 0),
  first_try_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_index)
);

create table public.note_attempts (
  id uuid primary key,
  trial_id uuid not null references public.training_trials(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_midi integer not null check (target_midi between 0 and 127),
  played_midi integer not null check (played_midi between 0 and 127),
  correct boolean not null,
  first_attempt boolean not null,
  response_ms integer not null check (response_ms >= 0),
  velocity integer check (velocity between 0 and 127),
  input_source text not null check (input_source in ('touch', 'computer-keyboard', 'midi')),
  created_at timestamptz not null default now()
);

create table public.user_note_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  midi integer not null check (midi between 0 and 127),
  trial_count integer not null default 0,
  first_try_correct_count integer not null default 0,
  incorrect_attempt_count integer not null default 0,
  average_response_ms numeric,
  median_response_ms numeric,
  best_response_ms numeric,
  recent_average_response_ms numeric,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, midi)
);

create index training_sessions_user_created_idx on public.training_sessions(user_id, created_at desc);
create index training_trials_user_midi_idx on public.training_trials(user_id, target_midi);
create index training_trials_session_idx on public.training_trials(session_id);
create index note_attempts_user_created_idx on public.note_attempts(user_id, created_at desc);
create index note_attempts_session_idx on public.note_attempts(session_id);
create index user_note_stats_user_midi_idx on public.user_note_stats(user_id, midi);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_trials enable row level security;
alter table public.note_attempts enable row level security;
alter table public.user_note_stats enable row level security;

create policy "profiles_owner_all" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "preferences_owner_all" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_owner_all" on public.training_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trials_owner_all" on public.training_trials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts_owner_all" on public.note_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "stats_owner_all" on public.user_note_stats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.save_training_session(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid := (payload ->> 'id')::uuid;
  v_trial jsonb;
  v_attempt jsonb;
  v_midi integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from training_sessions where id = v_session and user_id = v_user) then
    return v_session;
  end if;

  insert into training_sessions (
    id, user_id, mode, clef, started_at, completed_at, end_reason,
    completed_targets, first_try_correct_count, mistake_count, accuracy,
    average_response_ms, median_response_ms, best_response_ms, config
  ) values (
    v_session, v_user, payload ->> 'mode', payload #>> '{config,clef}',
    (payload ->> 'startedAt')::timestamptz, (payload ->> 'completedAt')::timestamptz,
    payload ->> 'endReason', (payload #>> '{summary,completedTargets}')::integer,
    (payload #>> '{summary,firstTryCorrectCount}')::integer,
    (payload #>> '{summary,mistakeCount}')::integer, (payload #>> '{summary,accuracy}')::numeric,
    nullif(payload #>> '{summary,averageResponseMs}', '')::numeric,
    nullif(payload #>> '{summary,medianResponseMs}', '')::numeric,
    nullif(payload #>> '{summary,bestResponseMs}', '')::numeric,
    payload -> 'config'
  );

  for v_trial in select value from jsonb_array_elements(payload -> 'trials') loop
    insert into training_trials (
      id, session_id, user_id, sequence_index, target_midi, target_notation,
      correct_response_ms, first_attempt_ms, first_try_correct
    ) values (
      (v_trial ->> 'id')::uuid, v_session, v_user, (v_trial ->> 'sequenceIndex')::integer,
      (v_trial #>> '{target,expectedMidi}')::integer, v_trial #> '{target,notation}',
      round((v_trial ->> 'correctResponseMs')::numeric)::integer,
      round((v_trial ->> 'firstAttemptMs')::numeric)::integer,
      (v_trial ->> 'firstTryCorrect')::boolean
    );

    for v_attempt in select value from jsonb_array_elements(v_trial -> 'attempts') loop
      insert into note_attempts (
        id, trial_id, session_id, user_id, target_midi, played_midi, correct,
        first_attempt, response_ms, velocity, input_source
      ) values (
        (v_attempt ->> 'id')::uuid, (v_trial ->> 'id')::uuid, v_session, v_user,
        (v_attempt ->> 'targetMidi')::integer, (v_attempt ->> 'playedMidi')::integer,
        (v_attempt ->> 'correct')::boolean, (v_attempt ->> 'firstAttempt')::boolean,
        round((v_attempt ->> 'responseMs')::numeric)::integer,
        nullif(v_attempt ->> 'velocity', '')::integer, v_attempt ->> 'source'
      );
    end loop;
  end loop;

  for v_midi in
    select distinct target_midi from training_trials where session_id = v_session
  loop
    insert into user_note_stats (
      user_id, midi, trial_count, first_try_correct_count, incorrect_attempt_count,
      average_response_ms, median_response_ms, best_response_ms, recent_average_response_ms,
      last_seen_at, updated_at
    )
    select
      v_user, v_midi, count(*), count(*) filter (where t.first_try_correct),
      coalesce((select count(*) from note_attempts a where a.user_id = v_user and a.target_midi = v_midi and not a.correct), 0),
      avg(t.correct_response_ms), percentile_cont(0.5) within group (order by t.correct_response_ms),
      min(t.correct_response_ms),
      (select avg(recent.correct_response_ms) from (
        select correct_response_ms from training_trials
        where user_id = v_user and target_midi = v_midi order by created_at desc limit 20
      ) recent),
      max(t.created_at), now()
    from training_trials t
    where t.user_id = v_user and t.target_midi = v_midi
    on conflict (user_id, midi) do update set
      trial_count = excluded.trial_count,
      first_try_correct_count = excluded.first_try_correct_count,
      incorrect_attempt_count = excluded.incorrect_attempt_count,
      average_response_ms = excluded.average_response_ms,
      median_response_ms = excluded.median_response_ms,
      best_response_ms = excluded.best_response_ms,
      recent_average_response_ms = excluded.recent_average_response_ms,
      last_seen_at = excluded.last_seen_at,
      updated_at = now();
  end loop;

  return v_session;
end;
$$;

grant execute on function public.save_training_session(jsonb) to authenticated;
