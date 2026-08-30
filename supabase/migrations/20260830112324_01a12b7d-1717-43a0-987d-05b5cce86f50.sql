CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('mefticaret-daily-rollup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mefticaret-daily-rollup');

SELECT cron.schedule(
  'mefticaret-daily-rollup',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--85215043-2289-408a-9b73-0246dd450abe-dev.lovable.app/api/public/cron/daily-rollup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);