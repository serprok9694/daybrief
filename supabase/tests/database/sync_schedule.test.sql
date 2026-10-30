-- pg_cron job that triggers the background calendar sync.
-- Run: pnpm db:test (needs local Supabase: pnpm supabase db start).
-- Everything runs in a rolled-back transaction, and pg_net only sends queued requests after
-- commit, so nothing here reaches the network.
begin;
select plan(8);

select is(
  (select count(*)::int from cron.job where jobname = 'daybrief-sync'),
  1,
  'daybrief-sync job exists'
);
select is(
  (select schedule from cron.job where jobname = 'daybrief-sync'),
  '*/15 * * * *',
  'runs every 15 minutes'
);
select ok(
  (select active from cron.job where jobname = 'daybrief-sync'),
  'job is active'
);
select matches(
  (select command from cron.job where jobname = 'daybrief-sync'),
  'https://daybrief-api\.vercel\.app/internal/sync',
  'calls the production sync endpoint'
);
select matches(
  (select command from cron.job where jobname = 'daybrief-sync'),
  'vault\.decrypted_secrets.*''daybrief_sync_secret''',
  'reads the secret from Vault by name'
);
select doesnt_match(
  (select command from cron.job where jobname = 'daybrief-sync'),
  '''x-sync-secret''\s*,\s*''',
  'no literal secret in the command'
);

-- Without the Vault secret the job queues no request.
delete from net.http_request_queue;
do $$ begin execute (select command from cron.job where jobname = 'daybrief-sync'); end $$;
select is(
  (select count(*)::int from net.http_request_queue),
  0,
  'no request without the Vault secret'
);

-- With it, one POST carrying the secret in x-sync-secret.
select vault.create_secret('test-sync-secret', 'daybrief_sync_secret');
do $$ begin execute (select command from cron.job where jobname = 'daybrief-sync'); end $$;
select results_eq(
  $$select method::text, url, headers ->> 'x-sync-secret' from net.http_request_queue$$,
  $$values ('POST', 'https://daybrief-api.vercel.app/internal/sync', 'test-sync-secret')$$,
  'queues one POST with the secret header'
);

select * from finish();
rollback;
