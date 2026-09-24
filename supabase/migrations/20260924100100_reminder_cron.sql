-- Every 5 minutes, ask the autobot-notify Edge Function to send any reminders
-- that are due (pills, serum, classes, bedtime, follow-ups, nudges).
-- The function dedupes, so an extra or late tick never double-sends.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'autobot-notify',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://jpallbmetcrnzwzsmgbp.supabase.co/functions/v1/autobot-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-autobot-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'autobot_cron_secret')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 25000
  );
  $cron$
);
