-- RLS and sync functions for calendar_events and sync_state.
-- Run: pnpm db:test (needs local Supabase: pnpm supabase db start).
begin;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

insert into public.google_connections (user_id, refresh_token_encrypted, status) values
  ('00000000-0000-0000-0000-00000000000a', 'secret-a', 'error'),
  ('00000000-0000-0000-0000-00000000000b', 'secret-b', 'active');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.calendar_events'::regclass),
  'RLS enabled on calendar_events'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sync_state'::regclass),
  'RLS enabled on sync_state'
);

-- As service role: the API's write path ---------------------------------------------------
set local role service_role;

-- A stale event from an earlier sync must be gone after the next one.
insert into public.calendar_events
  (user_id, calendar_id, event_id, all_day, start_date, end_date, synced_at)
values
  ('00000000-0000-0000-0000-00000000000a', 'primary', 'old', true, '2026-10-01', '2026-10-02', now());

select lives_ok(
  $$ select public.save_calendar_sync(
       '00000000-0000-0000-0000-00000000000a',
       '[{"calendar_id": "primary", "event_id": "e1", "title": "Standup", "all_day": false,
          "start_at": "2026-10-28T08:00:00Z", "end_at": "2026-10-28T08:15:00Z",
          "video_url": "https://meet.google.com/abc", "html_link": "https://calendar.google.com/e1"},
         {"calendar_id": "primary", "event_id": "e2", "title": "Trip", "all_day": true,
          "start_date": "2026-10-28", "end_date": "2026-10-29"}]',
       '2026-10-28T07:00:00Z') $$,
  'service role saves a sync'
);
select results_eq(
  $$ select event_id from public.calendar_events
     where user_id = '00000000-0000-0000-0000-00000000000a' order by event_id $$,
  $$ values ('e1'::text), ('e2'::text) $$,
  'save_calendar_sync replaces the stored events'
);
select is(
  (select status::text from public.google_connections
   where user_id = '00000000-0000-0000-0000-00000000000a'),
  'active',
  'a successful sync marks the connection active'
);
select results_eq(
  $$ select synced_at, error from public.sync_state
     where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('2026-10-28T07:00:00Z'::timestamptz, null::text) $$,
  'a successful sync records synced_at and clears the error'
);

select public.save_calendar_sync('00000000-0000-0000-0000-00000000000b',
  '[{"calendar_id": "primary", "event_id": "b1", "title": "Bob only", "all_day": false,
     "start_at": "2026-10-28T10:00:00Z", "end_at": "2026-10-28T11:00:00Z"}]',
  '2026-10-28T07:00:00Z');

select public.fail_calendar_sync('00000000-0000-0000-0000-00000000000b', 'Token endpoint: invalid_grant', 'revoked');
select results_eq(
  $$ select s.synced_at, s.error, c.status::text
     from public.sync_state s join public.google_connections c using (user_id)
     where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  $$ values ('2026-10-28T07:00:00Z'::timestamptz, 'Token endpoint: invalid_grant'::text, 'revoked'::text) $$,
  'a failed sync keeps synced_at, records the error and the connection status'
);
select is(
  (select count(*)::int from public.calendar_events
   where user_id = '00000000-0000-0000-0000-00000000000b'),
  1,
  'a failed sync keeps the cached events'
);

select ok(
  public.try_lock_sync('00000000-0000-0000-0000-00000000000b', 'calendar', 30),
  'the first lock is granted'
);
select is(
  public.try_lock_sync('00000000-0000-0000-0000-00000000000b', 'calendar', 30),
  null,
  'a second lock within the window is refused'
);
update public.sync_state set locked_until = now() - interval '1 second'
where user_id = '00000000-0000-0000-0000-00000000000b';
select ok(
  public.try_lock_sync('00000000-0000-0000-0000-00000000000b', 'calendar', 30),
  'the lock is granted again once it expired'
);

-- As user A -------------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);

select results_eq(
  $$ select distinct user_id from public.calendar_events $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'user sees only their own events'
);
select results_eq(
  $$ select user_id from public.sync_state $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'user sees only their own sync state'
);
select throws_ok(
  $$ insert into public.calendar_events (user_id, calendar_id, event_id, all_day, start_date, end_date, synced_at)
     values ('00000000-0000-0000-0000-00000000000a', 'primary', 'x', true, '2026-10-28', '2026-10-29', now()) $$,
  '42501',
  null,
  'authenticated cannot insert events'
);
select throws_ok(
  $$ delete from public.calendar_events $$,
  '42501',
  null,
  'authenticated cannot delete events'
);
select throws_ok(
  $$ update public.sync_state set locked_until = null $$,
  '42501',
  null,
  'authenticated cannot write sync_state'
);
select throws_ok(
  $$ select public.save_calendar_sync('00000000-0000-0000-0000-00000000000a', '[]', now()) $$,
  '42501',
  null,
  'authenticated cannot call save_calendar_sync'
);
select throws_ok(
  $$ select public.try_lock_sync('00000000-0000-0000-0000-00000000000a', 'calendar', 0) $$,
  '42501',
  null,
  'authenticated cannot call try_lock_sync'
);

-- As anon ---------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select 1 from public.calendar_events $$,
  '42501',
  null,
  'anon cannot read events'
);

select * from finish();
rollback;
