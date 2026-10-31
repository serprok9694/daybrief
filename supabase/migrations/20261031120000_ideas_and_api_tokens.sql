-- M2/T4: ideas and personal API tokens (Apple Shortcuts).
-- Clients read their own rows; only the API (service role) writes, through the functions
-- below. The token hash is never readable by clients (docs/milestones/M2.md decisions).

create type public.idea_source as enum ('command', 'shortcut', 'reminders');

-- ideas ---------------------------------------------------------------------------------

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Trimmed by the API; the limit is in code points, as in packages/core (ideas.ts).
  text text not null check (char_length(text) between 1 and 2000),
  source public.idea_source not null,
  -- Id of the item in the sending app (e.g. a reminder), if the sender has one.
  external_id text check (char_length(external_id) between 1 and 200),
  -- SHA-256 (hex) of the normalized text, for dedup.
  text_hash text not null,
  created_at timestamptz not null default now(),
  -- "Not now": hidden until this instant.
  snoozed_until timestamptz,
  -- "Done": archived.
  done_at timestamptz,
  -- Last time it was the idea of the day.
  last_shown_at timestamptz
);

-- A repeat of an external id is a duplicate even after the idea was archived, so a daily
-- Reminders run does not bring done ideas back. The same text may come back once archived.
create unique index ideas_user_external_id on public.ideas (user_id, external_id)
  where external_id is not null;
create unique index ideas_user_text_hash on public.ideas (user_id, text_hash)
  where done_at is null;
-- Idea of the day: open ideas, least recently shown first.
create index ideas_user_open on public.ideas (user_id, last_shown_at nulls first)
  where done_at is null;

alter table public.ideas enable row level security;

revoke all on public.ideas from anon, authenticated;
grant select on public.ideas to authenticated;

create policy "ideas: read own"
on public.ideas for select to authenticated
using ((select auth.uid()) = user_id);

-- api_tokens ----------------------------------------------------------------------------

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  -- SHA-256 (hex) of the full token; the token itself is never stored.
  token_hash text not null unique,
  -- Last 4 characters of the token, for the masked list in settings.
  last4 text not null check (char_length(last4) = 4),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- "Revoke": a revoked token gets 401.
  revoked_at timestamptz
);

create index api_tokens_user on public.api_tokens (user_id) where revoked_at is null;

alter table public.api_tokens enable row level security;

-- Clients may read their own tokens but not the hash column, so they must select columns
-- explicitly (select=* is denied). All writes go through the API.
revoke all on public.api_tokens from anon, authenticated;
grant select (id, user_id, name, last4, created_at, last_used_at, revoked_at)
  on public.api_tokens to authenticated;

create policy "api_tokens: read own"
on public.api_tokens for select to authenticated
using ((select auth.uid()) = user_id);

-- API functions (service role only) -----------------------------------------------------

-- Adds an idea unless it duplicates one by external id or by text hash among open ideas.
-- Returns the new idea with created = true, or the existing one with created = false.
create function public.add_idea(
  p_user_id uuid,
  p_text text,
  p_source public.idea_source,
  p_text_hash text,
  p_external_id text default null
)
returns table (
  id uuid,
  text text,
  source public.idea_source,
  external_id text,
  created_at timestamptz,
  snoozed_until timestamptz,
  done_at timestamptz,
  last_shown_at timestamptz,
  created boolean
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
    insert into public.ideas as i (user_id, text, source, external_id, text_hash)
    values (p_user_id, p_text, p_source, p_external_id, p_text_hash)
    on conflict do nothing
    returning i.id, i.text, i.source, i.external_id, i.created_at, i.snoozed_until,
      i.done_at, i.last_shown_at, true;
  if found then return; end if;

  -- The external id wins when both match different ideas.
  return query
    select i.id, i.text, i.source, i.external_id, i.created_at, i.snoozed_until,
      i.done_at, i.last_shown_at, false
    from public.ideas i
    where i.user_id = p_user_id
      and (i.external_id = p_external_id or (i.text_hash = p_text_hash and i.done_at is null))
    order by (i.external_id is not distinct from p_external_id) desc
    limit 1;
end;
$$;

-- Creates a token unless the user already has `p_limit` active ones; returns the new row,
-- or nothing at the limit. The per-user lock makes the count and insert atomic.
create function public.create_api_token(
  p_user_id uuid,
  p_name text,
  p_token_hash text,
  p_last4 text,
  p_limit integer
)
returns setof public.api_tokens
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('api_tokens:' || p_user_id::text, 0));
  if (select count(*) from public.api_tokens t
      where t.user_id = p_user_id and t.revoked_at is null) >= p_limit then
    return;
  end if;
  return query
    insert into public.api_tokens (user_id, name, token_hash, last4)
    values (p_user_id, p_name, p_token_hash, p_last4)
    returning *;
end;
$$;

-- Looks up an active token by hash and records its use. Returns the owner and the stored
-- hash (the API compares it in constant time), or nothing for an unknown or revoked token.
create function public.use_api_token(p_token_hash text)
returns table (user_id uuid, token_hash text)
language sql
set search_path = ''
as $$
  update public.api_tokens t set last_used_at = now()
  where t.token_hash = p_token_hash and t.revoked_at is null
  returning t.user_id, t.token_hash;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default.
revoke execute on function public.add_idea(uuid, text, public.idea_source, text, text)
  from public, anon, authenticated;
revoke execute on function public.create_api_token(uuid, text, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.use_api_token(text) from public, anon, authenticated;
grant execute on function public.add_idea(uuid, text, public.idea_source, text, text)
  to service_role;
grant execute on function public.create_api_token(uuid, text, text, text, integer)
  to service_role;
grant execute on function public.use_api_token(text) to service_role;
