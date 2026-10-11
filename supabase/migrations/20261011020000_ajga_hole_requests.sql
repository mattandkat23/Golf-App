-- Opt-in requests for live, hole-by-hole AJGA tracking (Tournament detail page, AJGA events only).
-- Hole-by-hole scorecards are only public on ajga.org while an event is in progress (login-walled once
-- archived), so this only works for a tournament that hasn't finished yet. Scoped per golfer+event so we
-- only poll AJGA for kids whose parents actually asked for it, not every player nationwide.
-- scraper/results/collect.ts (service key, bypasses RLS) reads every row here each day and, for any
-- tournament still in progress, fetches that player's scorecard and writes it into results.holes.

create table public.ajga_hole_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  golfer_name text not null, -- matched against the AJGA leaderboard the same way results import does (names.ts)
  tournament_id text not null, -- the numeric id from the AJGA tournament URL, e.g. '2026145'
  tournament_name text,
  created_at timestamptz not null default now(),
  unique (user_id, golfer_name, tournament_id)
);
alter table public.ajga_hole_requests enable row level security;
create policy "Parents add their own AJGA hole requests" on public.ajga_hole_requests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Parents read their own AJGA hole requests" on public.ajga_hole_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "Parents remove their own AJGA hole requests" on public.ajga_hole_requests for delete to authenticated using ((select auth.uid()) = user_id);
