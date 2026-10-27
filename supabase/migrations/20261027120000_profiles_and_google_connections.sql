-- M0/T5: user profiles and Google connections.
-- Privacy rules (docs/PRD.md 6.4): RLS on every user table; the encrypted Google refresh
-- token is readable and writable only by the service role (the API).

create type public.app_locale as enum ('en', 'ru');
create type public.theme_preference as enum ('auto', 'light', 'dark');
create type public.scene_preference as enum ('auto', 'morning', 'day', 'evening', 'night');
create type public.connection_status as enum ('active', 'revoked', 'error');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- profiles ----------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- null = follow the device language until the user picks one.
  locale public.app_locale,
  theme public.theme_preference not null default 'auto',
  scene public.scene_preference not null default 'auto',
  -- IANA name, e.g. 'Europe/Berlin'; null until the client reports it.
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Rows are created by the signup trigger, never by clients; user_id is immutable.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, locale, theme, scene, timezone) on public.profiles to authenticated;

create policy "profiles: read own"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles: update own"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- google_connections ------------------------------------------------------------------

create table public.google_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  scopes text[] not null default '{}',
  -- AES-256-GCM payload produced by apps/api (src/crypto.ts). Never exposed to clients.
  refresh_token_encrypted text not null,
  status public.connection_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_connections_set_updated_at
before update on public.google_connections
for each row execute function public.set_updated_at();

alter table public.google_connections enable row level security;

-- Clients may read their own connection state but not the token column, so they must
-- select columns explicitly (select=* is denied). All writes go through the API.
revoke all on public.google_connections from anon, authenticated;
grant select (user_id, scopes, status, created_at, updated_at)
  on public.google_connections to authenticated;

create policy "google_connections: read own"
on public.google_connections for select to authenticated
using ((select auth.uid()) = user_id);

-- signup trigger ----------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
