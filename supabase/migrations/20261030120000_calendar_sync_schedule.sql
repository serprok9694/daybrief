-- M1/T3: background calendar sync. pg_cron calls POST /internal/sync on the API every
-- 15 minutes through pg_net (docs/PRD.md 6.1, 6.3: Vercel Hobby cron runs at most daily).
--
-- The shared secret is never part of this file: the job reads it from Supabase Vault on
-- every run (secret name 'daybrief_sync_secret', same value as SYNC_SECRET in Vercel,
-- docs/deploy.md). Without that secret the job sends nothing, so the migration is safe to
-- apply before the secret exists, and local databases never call the production API.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule upserts by name, so re-running this is harmless.
-- pg_net only queues the request; the response (status, body) lands in net._http_response.
-- The timeout is generous because the API syncs users one by one (20 s per user).
select cron.schedule(
  'daybrief-sync',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://daybrief-api.vercel.app/internal/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', s.decrypted_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  from vault.decrypted_secrets s
  where s.name = 'daybrief_sync_secret'
  $job$
);
