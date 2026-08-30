-- Flash mode records the same trial shape as Reflex; only the presentation
-- differs, so it joins the existing mode constraint rather than a new table.
alter table public.training_sessions
  drop constraint if exists training_sessions_mode_check;

alter table public.training_sessions
  add constraint training_sessions_mode_check check (mode in ('reflex', 'flash', 'sheet'));
