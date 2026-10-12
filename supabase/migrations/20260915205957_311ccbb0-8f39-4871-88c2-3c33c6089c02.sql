-- lovable-cron-fallback-reviewed: 48 runs/day; Aras Kargo teslim durumu için webhook sağlamıyor, durum yalnızca sorgulama servisiyle alınabiliyor; yarım saatlik teslim bildirim gecikmesi kabul edilebilir en düşük sıklık.
SELECT cron.unschedule('mefticaret-aras-tracking')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mefticaret-aras-tracking');

SELECT cron.schedule(
  'mefticaret-aras-tracking',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--85215043-2289-408a-9b73-0246dd450abe.lovable.app/api/public/cron/aras-tracking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);