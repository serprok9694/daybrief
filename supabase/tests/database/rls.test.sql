-- RLS and column privileges for profiles and google_connections.
-- Run: pnpm db:test (needs local Supabase: pnpm supabase db start).
begin;
select plan(16);

-- Two users; the signup trigger creates their profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', '{"full_name": "Alice A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', '{"name": "Bob"}');

insert into public.google_connections (user_id, scopes, refresh_token_encrypted) values
  ('00000000-0000-0000-0000-00000000000a', '{calendar.readonly}', 'secret-a'),
  ('00000000-0000-0000-0000-00000000000b', '{calendar.readonly}', 'secret-b');

select results_eq(
  $$ select display_name from public.profiles order by user_id $$,
  $$ values ('Alice A'::text), ('Bob'::text) $$,
  'signup trigger creates profiles with display_name from metadata'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.google_connections'::regclass),
  'RLS enabled on google_connections'
);

-- As user A -----------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);

select results_eq(
  $$ select user_id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'user sees only their own profile'
);
select is_empty(
  $$ select 1 from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'another user''s profile is not visible'
);

select lives_ok(
  $$ update public.profiles set theme = 'dark', locale = 'ru' $$,
  'user can update their own profile'
);
select is(
  (select theme::text from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  'dark',
  'own profile updated'
);
select is_empty(
  $$ update public.profiles set display_name = 'hacked'
     where user_id = '00000000-0000-0000-0000-00000000000b' returning 1 $$,
  'updating another user''s profile affects no rows'
);
select throws_ok(
  $$ update public.profiles set user_id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501',
  null,
  'user_id cannot be changed'
);
select throws_ok(
  $$ insert into public.profiles (user_id) values (gen_random_uuid()) $$,
  '42501',
  null,
  'clients cannot insert profiles'
);

select results_eq(
  $$ select user_id, status::text from public.google_connections $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, 'active'::text) $$,
  'user sees only their own connection status'
);
select throws_ok(
  $$ select refresh_token_encrypted from public.google_connections $$,
  '42501',
  null,
  'authenticated cannot read refresh_token_encrypted'
);
select throws_ok(
  $$ update public.google_connections set status = 'revoked' $$,
  '42501',
  null,
  'authenticated cannot write google_connections'
);

-- As anon -------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select 1 from public.profiles $$,
  '42501',
  null,
  'anon cannot read profiles'
);
select throws_ok(
  $$ select refresh_token_encrypted from public.google_connections $$,
  '42501',
  null,
  'anon cannot read refresh_token_encrypted'
);

-- As service role -----------------------------------------------------------------------
reset role;
set local role service_role;

select is(
  (select refresh_token_encrypted from public.google_connections
   where user_id = '00000000-0000-0000-0000-00000000000b'),
  'secret-b',
  'service role reads the encrypted token'
);

select * from finish();
rollback;
