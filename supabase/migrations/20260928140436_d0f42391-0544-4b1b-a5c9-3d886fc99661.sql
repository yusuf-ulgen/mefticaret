-- lovable-cron-fallback-reviewed: DDoS seviye ölçümü dakikalık olmalı; görev hafif (tek satır okuma + özet).
SELECT cron.unschedule('mefticaret-firewall-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mefticaret-firewall-tick');
SELECT cron.schedule('mefticaret-firewall-tick', '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--85215043-2289-408a-9b73-0246dd450abe.lovable.app/api/public/cron/firewall',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.cron_secret', true)),
    body := '{}'::jsonb);
  $$);