-- M1/T2: cached calendar events and per-source sync state.
-- Only what the events widget shows is stored: no descriptions, attendees or attachments
-- (docs/PRD.md 6.4, M1 decisions). Clients read their own rows; only the API (service
-- role) writes, through the functions below.

create type public.sync_source as enum ('calendar');

-- calendar_events -----------------------------------------------------------------------

create table public.calendar_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id text not null,
  event_id text not null,
  title text not null default '',
  all_day boolean not null,
  -- Timed events: instants. All-day events: dates, end exclusive (as in Google).
  start_at timestamptz,
  end_at timestamptz,
  start_date date,
  end_date date,
  video_url text,
  html_link text,
  synced_at timestamptz not null,
  primary key (user_id, calendar_id, event_id),
  constraint calendar_events_time_shape check (
    case
      when all_day then start_date is not null and end_date is not null
        and start_at is null and end_at is null
      else start_at is not null and end_at is not null
        and start_date is null and end_date is null
    end
  )
);

alter table public.calendar_events enable row level security;

revoke all on public.calendar_events from anon, authenticated;
grant select on public.calendar_events to authenticated;

create policy "calendar_events: read own"
on public.calendar_events for select to authenticated
using ((select auth.uid()) = user_id);

-- sync_state ----------------------------------------------------------------------------

create table public.sync_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  source public.sync_source not null,
  -- Last successful sync; null if there never was one.
  synced_at timestamptz,
  -- Error of the last attempt (never contains tokens); null after a success.
  error text,
  -- No new sync starts before this instant: rate limit and overlap guard.
  locked_until timestamptz,
  primary key (user_id, source)
);

alter table public.sync_state enable row level security;

revoke all on public.sync_state from anon, authenticated;
grant select on public.sync_state to authenticated;

create policy "sync_state: read own"
on public.sync_state for select to authenticated
using ((select auth.uid()) = user_id);

-- API functions (service role only) -----------------------------------------------------

-- Takes the sync lock for `p_seconds` unless another sync holds it. Atomic, so two
-- requests at once can't both win. Returns null (not false) when the lock is held.
create function public.try_lock_sync(
  p_user_id uuid,
  p_source public.sync_source,
  p_seconds integer
)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.sync_state (user_id, source, locked_until)
  values (p_user_id, p_source, now() + make_interval(secs => p_seconds))
  on conflict (user_id, source) do update
    set locked_until = excluded.locked_until
    where public.sync_state.locked_until is null or public.sync_state.locked_until <= now()
  returning true;
$$;

-- A successful calendar sync in one transaction: the stored events become exactly the
-- synced window (yesterday, today, tomorrow), which also drops everything older than
-- yesterday; the sync state is cleared and the connection is active again.
-- p_events: [{calendar_id, event_id, title, all_day, start_at, end_at, start_date,
-- end_date, video_url, html_link}].
create function public.save_calendar_sync(
  p_user_id uuid,
  p_events jsonb,
  p_synced_at timestamptz
)
returns void
language sql
set search_path = ''
as $$
  delete from public.calendar_events where user_id = p_user_id;

  insert into public.calendar_events (
    user_id, calendar_id, event_id, title, all_day, start_at, end_at, start_date, end_date,
    video_url, html_link, synced_at
  )
  select
    p_user_id, e.calendar_id, e.event_id, e.title, e.all_day, e.start_at, e.end_at,
    e.start_date, e.end_date, e.video_url, e.html_link, p_synced_at
  from jsonb_to_recordset(p_events) as e (
    calendar_id text, event_id text, title text, all_day boolean, start_at timestamptz,
    end_at timestamptz, start_date date, end_date date, video_url text, html_link text
  )
  on conflict do nothing;

  insert into public.sync_state (user_id, source, synced_at, error)
  values (p_user_id, 'calendar', p_synced_at, null)
  on conflict (user_id, source) do update set synced_at = excluded.synced_at, error = null;

  update public.google_connections set status = 'active'
  where user_id = p_user_id and status <> 'active';
$$;

-- A failed calendar sync: keeps the cached events and the last success time, records the
-- error and marks the connection `revoked` or `error`.
create function public.fail_calendar_sync(
  p_user_id uuid,
  p_error text,
  p_status public.connection_status
)
returns void
language sql
set search_path = ''
as $$
  insert into public.sync_state (user_id, source, error)
  values (p_user_id, 'calendar', p_error)
  on conflict (user_id, source) do update set error = excluded.error;

  update public.google_connections set status = p_status where user_id = p_user_id;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default.
revoke execute on function public.try_lock_sync(uuid, public.sync_source, integer)
  from public, anon, authenticated;
revoke execute on function public.save_calendar_sync(uuid, jsonb, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.fail_calendar_sync(uuid, text, public.connection_status)
  from public, anon, authenticated;
grant execute on function public.try_lock_sync(uuid, public.sync_source, integer)
  to service_role;
grant execute on function public.save_calendar_sync(uuid, jsonb, timestamptz)
  to service_role;
grant execute on function public.fail_calendar_sync(uuid, text, public.connection_status)
  to service_role;
