-- Accounts and family data. Every table has row-level security: a signed-in parent can only reach their own rows.

-- One row per parent. `plan` decides which features are unlocked; only the server (secret key) can change it.
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  created_at timestamptz not null default now()
);
alter table public.accounts enable row level security;
create policy "Parents read their own account" on public.accounts for select to authenticated using ((select auth.uid()) = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.accounts (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- The family's app data (golfers, events, rounds, practice...), stored as the same JSON as the phone's backup file.
create table public.family_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.family_data enable row level security;
create policy "Parents read their own data" on public.family_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Parents add their own data" on public.family_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Parents update their own data" on public.family_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- "Delete my account" in the app (required by the app stores). Removes the login; the cascades remove everything else.
create function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
