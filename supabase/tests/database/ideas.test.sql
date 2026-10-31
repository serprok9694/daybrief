-- RLS and API functions for ideas and api_tokens.
-- Run: pnpm db:test (needs local Supabase: pnpm supabase db start).
begin;
select plan(26);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ideas'::regclass),
  'RLS enabled on ideas'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.api_tokens'::regclass),
  'RLS enabled on api_tokens'
);

-- As service role: the API's write path ---------------------------------------------------
set local role service_role;

select is(
  (select created from public.add_idea('00000000-0000-0000-0000-00000000000a', 'Learn pgTAP', 'command', 'hash-1', null)),
  true,
  'add_idea creates a new idea'
);
select is(
  (select created from public.add_idea('00000000-0000-0000-0000-00000000000a', 'learn  pgtap', 'shortcut', 'hash-1', null)),
  false,
  'the same text hash is a duplicate'
);
select is(
  (select text from public.add_idea('00000000-0000-0000-0000-00000000000a', 'learn  pgtap', 'shortcut', 'hash-1', null)),
  'Learn pgTAP',
  'a duplicate answers with the existing idea'
);
select is(
  (select created from public.add_idea('00000000-0000-0000-0000-00000000000b', 'Learn pgTAP', 'command', 'hash-1', null)),
  true,
  'dedup is per user'
);

select is(
  (select created from public.add_idea('00000000-0000-0000-0000-00000000000a', 'From reminders', 'reminders', 'hash-2', 'rem-1')),
  true,
  'add_idea stores an external id'
);
select results_eq(
  $$ select created, text from public.add_idea('00000000-0000-0000-0000-00000000000a', 'Edited reminder', 'reminders', 'hash-3', 'rem-1') $$,
  $$ values (false, 'From reminders'::text) $$,
  'the same external id is a duplicate even with another text'
);

update public.ideas set done_at = now()
where user_id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select created from public.add_idea('00000000-0000-0000-0000-00000000000a', 'Learn pgTAP', 'command', 'hash-1', null)),
  true,
  'an archived idea''s text may come back'
);
select is(
  (select created from public.add_idea('00000000-0000-0000-0000-00000000000a', 'From reminders', 'reminders', 'hash-2', 'rem-1')),
  false,
  'an archived idea''s external id stays a duplicate'
);
select throws_ok(
  $$ select public.add_idea('00000000-0000-0000-0000-00000000000a', repeat('x', 2001), 'command', 'hash-long', null) $$,
  '23514',
  null,
  'idea text is limited to 2000 characters'
);
select throws_ok(
  $$ select public.add_idea('00000000-0000-0000-0000-00000000000a', '', 'command', 'hash-empty', null) $$,
  '23514',
  null,
  'idea text cannot be empty'
);

-- Tokens: at most p_limit active ones.
select is(
  (select count(*)::int from public.create_api_token(
     '00000000-0000-0000-0000-00000000000a', 'iPhone', 'token-hash-1', 'a91c', 2)),
  1,
  'create_api_token creates a token'
);
select public.create_api_token(
  '00000000-0000-0000-0000-00000000000a', 'Mac', 'token-hash-2', '07fe', 2);
select is(
  (select count(*)::int from public.create_api_token(
     '00000000-0000-0000-0000-00000000000a', 'Third', 'token-hash-3', 'zzzz', 2)),
  0,
  'create_api_token refuses beyond the limit'
);
select public.create_api_token(
  '00000000-0000-0000-0000-00000000000b', 'Bob', 'token-hash-b', 'bbbb', 2);

select results_eq(
  $$ select user_id, token_hash from public.use_api_token('token-hash-1') $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, 'token-hash-1'::text) $$,
  'use_api_token finds an active token'
);
select isnt(
  (select last_used_at from public.api_tokens where token_hash = 'token-hash-1'),
  null,
  'use_api_token records last_used_at'
);
select is_empty(
  $$ select * from public.use_api_token('unknown') $$,
  'use_api_token ignores unknown tokens'
);

update public.api_tokens set revoked_at = now() where token_hash = 'token-hash-2';
select is_empty(
  $$ select * from public.use_api_token('token-hash-2') $$,
  'use_api_token ignores revoked tokens'
);
select is(
  (select count(*)::int from public.create_api_token(
     '00000000-0000-0000-0000-00000000000a', 'Third', 'token-hash-3', 'zzzz', 2)),
  1,
  'a revoked token frees a slot'
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
  $$ select distinct user_id from public.ideas $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'user sees only their own ideas'
);
select results_eq(
  $$ select name from public.api_tokens order by name $$,
  $$ values ('iPhone'::text), ('Mac'::text), ('Third'::text) $$,
  'user sees only their own tokens'
);
select throws_ok(
  $$ select token_hash from public.api_tokens $$,
  '42501',
  null,
  'authenticated cannot read token_hash'
);
select throws_ok(
  $$ update public.ideas set done_at = now() $$,
  '42501',
  null,
  'authenticated cannot write ideas'
);
select throws_ok(
  $$ update public.api_tokens set revoked_at = null $$,
  '42501',
  null,
  'authenticated cannot write api_tokens'
);
select throws_ok(
  $$ select public.add_idea('00000000-0000-0000-0000-00000000000a', 'x', 'command', 'h', null) $$,
  '42501',
  null,
  'authenticated cannot call add_idea'
);

-- As anon ---------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select * from public.use_api_token('token-hash-1') $$,
  '42501',
  null,
  'anon cannot call use_api_token'
);

select * from finish();
rollback;
