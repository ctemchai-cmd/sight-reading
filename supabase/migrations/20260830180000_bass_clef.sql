-- Bass clef joins treble as a scored staff. Sessions and preferences both
-- constrain the clef by name, so both constraints widen together.
alter table public.training_sessions
  drop constraint if exists training_sessions_clef_check;

alter table public.training_sessions
  add constraint training_sessions_clef_check check (clef in ('treble', 'bass'));

alter table public.user_preferences
  drop constraint if exists user_preferences_default_clef_check;

alter table public.user_preferences
  add constraint user_preferences_default_clef_check check (default_clef in ('treble', 'bass'));
