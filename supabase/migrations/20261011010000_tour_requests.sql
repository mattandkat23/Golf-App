-- Tours a parent asks for that can't be collected automatically (Events -> "Tour not listed here?").
-- The owner reviews these (Supabase dashboard, or the service key) and, if a tour's schedule can't be
-- scraped, pastes it through scraper/publish-schedule.ts so it shows up in Available for every family.

create table public.tour_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tour_name text not null,
  tour_url text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.tour_requests enable row level security;
create policy "Parents add their own tour requests" on public.tour_requests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Parents read their own tour requests" on public.tour_requests for select to authenticated using ((select auth.uid()) = user_id);
