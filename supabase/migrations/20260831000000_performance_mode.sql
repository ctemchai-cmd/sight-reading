-- Performance mode keeps time, so a note can go by unplayed. Such a trial has
-- no correct response and therefore no response time to record: the column
-- becomes nullable rather than being filled with the length of the beat, which
-- would quietly corrupt every median built on it.
--
-- The session RPC needs no change: `->>` on a missing key already yields null,
-- and avg, min and percentile_cont all skip nulls.
alter table public.training_sessions
  drop constraint if exists training_sessions_mode_check;

alter table public.training_sessions
  add constraint training_sessions_mode_check
  check (mode in ('reflex', 'flash', 'performance', 'sheet'));

alter table public.training_trials
  alter column correct_response_ms drop not null;
