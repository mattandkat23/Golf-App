-- Past tournament results collected from tour websites (scraper/results). Results are public on the tours' own sites,
-- but here nobody can read the tables directly: signed-in parents can only look up a specific name through
-- search_results(), which needs a first and last name and returns a limited number of rows. Only the collector
-- (secret key) writes.

create extension if not exists pg_trgm with schema extensions;

create table public.result_events (
  id text primary key,                 -- '<tour>:<tour's own event id>', e.g. 'usk:519216'
  tour_id text not null,               -- matches the app's tour ids, e.g. 'usk-austin'
  name text not null,
  start_date date not null,
  end_date date,
  course_name text,
  city text,
  url text,
  num_rounds smallint,
  holes_per_round smallint,            -- 9 or 18
  collected_at timestamptz not null default now()
);
alter table public.result_events enable row level security;

create table public.results (
  id bigint generated always as identity primary key,
  event_id text not null references public.result_events (id) on delete cascade,
  division text not null default '',   -- age group as the tour names it, e.g. 'Boys 10'
  position text,                       -- as shown: '1', 'T3', 'WD', 'DQ'
  pos_num smallint,                    -- numeric place for sorting (ties share it); null for WD/DQ
  field_size smallint,                 -- players in the division
  player_name text not null,           -- as shown, tidied: 'Ford Smith'
  name_key text not null,              -- normalized for search (scraper/results/names.ts)
  hometown text,                       -- 'Woodway, TX'
  grad_year smallint,
  to_par smallint,
  total smallint,
  round_scores smallint[],             -- one per round
  points numeric,                      -- season points (US Kids) or Drive Chip & Putt points
  holes jsonb,                         -- optional hole-by-hole: [{round, hole, par, yards, score}]
  unique (event_id, division, name_key)
);
alter table public.results enable row level security;
create index results_name_key_trgm on public.results using gin (name_key extensions.gin_trgm_ops);
create index results_event on public.results (event_id);

-- Look up results by name. `key` is the normalized name the app computes (same rules as the collector).
create function public.search_results(key text)
returns table (
  result_id bigint, event_id text, tour_id text, event_name text, start_date date, end_date date, course_name text,
  city text, url text, num_rounds smallint, holes_per_round smallint, division text, "position" text, pos_num smallint,
  field_size smallint, player_name text, hometown text, grad_year smallint, to_par smallint, total smallint,
  round_scores smallint[], points numeric, has_holes boolean, similarity real
)
language sql stable security definer set search_path = '' as $$
  select r.id, e.id, e.tour_id, e.name, e.start_date, e.end_date, e.course_name, e.city, e.url, e.num_rounds,
         e.holes_per_round, r.division, r.position, r.pos_num, r.field_size, r.player_name, r.hometown, r.grad_year,
         r.to_par, r.total, r.round_scores, r.points, r.holes is not null, extensions.similarity(r.name_key, key)
  from public.results r join public.result_events e on e.id = r.event_id
  where (select auth.uid()) is not null
    and length(key) >= 5 and position(' ' in key) > 0          -- a first and last name, not a fishing query
    and extensions.similarity(r.name_key, key) >= 0.5
  order by extensions.similarity(r.name_key, key) desc, e.start_date desc
  limit 200;
$$;
revoke execute on function public.search_results(text) from public, anon;
grant execute on function public.search_results(text) to authenticated;

-- Hole-by-hole detail for one result the parent picked.
create function public.result_holes(result_id bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select r.holes from public.results r where r.id = result_id and (select auth.uid()) is not null;
$$;
revoke execute on function public.result_holes(bigint) from public, anon;
grant execute on function public.result_holes(bigint) to authenticated;
