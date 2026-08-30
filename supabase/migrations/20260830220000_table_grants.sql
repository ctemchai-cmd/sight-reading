-- The initial migration granted execute on the session RPC but nothing on the
-- tables, leaning on Supabase's default privileges to cover them. Where those
-- defaults did not apply, reads came back 403 and the RPC — which runs as the
-- caller, not as its owner — could not write either.
--
-- Row-level security still decides which rows each player sees; these grants
-- only decide that they may ask at all.

grant select, insert on public.training_sessions to authenticated;
grant select, insert on public.training_trials to authenticated;
grant select, insert on public.note_attempts to authenticated;
grant select, insert, update on public.user_note_stats to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, update on public.profiles to authenticated;
