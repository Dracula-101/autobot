# Autobot

A robot friend that plans your day, remembers what matters, and nudges you toward the job.
Built for one CU Boulder MS CS student's lock-in: **job hunt → LeetCode → health**.

Live: https://dracula-101.github.io/autobot/ — install it from Safari/Chrome (“Add to Home Screen”)
to get push notifications on your phone.

## What it does

- **Follows the sky.** The whole UI (and the robot) shifts through dawn, day, dusk and night using the
  real Boulder sunrise and sunset.
- **Power cells, not quotas.** Anything you log charges one of three cells — Hunt, Prep, Body — and
  cells drain a little each day. One action a day keeps a cell full; big days overflow and carry you
  through lighter ones. Nothing shows as "x/y".
- **Clock-free days sized by your battery.** Each morning you say Low / Normal / Charged, and the day
  is autofilled with concrete sessions (the next person to message, the next job to apply to, the next
  roadmap problem) in *moments* — after waking, out of the room, evening, night-owl hours, before bed.
  Low days keep only what the neediest cells need; charged days get bonus blocks. Only classes have
  times, and Autobot spotlights one **Next up** session at a time.
- **Routines + reminders.** Morning and night stacks (pill + hair serum) get one push each: shortly
  after you first open the app, and before bedtime. Classes, bedtime, referral follow-ups, stalled
  days and the Sunday wrap-up get pushes too.
- **Chat with memory.** Autobot (Gemini, server-side) knows what you've told it, sees your live plan,
  and can change things with tools — log a LeetCode problem, move a mission, add a contact, save a
  memory. Every turn and every change is stored in Supabase and shows up on every device.
- **Hunt / Prep / Body.** Referral pipeline with follow-up tracking and AI-drafted asks, a
  sponsor-friendly company list with CU Boulder alumni search, a pattern-by-pattern LeetCode roadmap
  with spaced review, routines, workouts, and sleep consistency.

## Architecture

```
GitHub Pages (Vite + React PWA)                 Supabase (project "AutoBot")
┌──────────────────────────────┐   realtime     ┌─────────────────────────────────────┐
│ offline-first sync store     │◀──────────────▶│ Postgres + RLS: missions, routines,  │
│ (localStorage + upload queue)│   REST upserts │ logs, memories, contacts, jobs,      │
│ service worker (push, shell) │                │ problems, chat_messages, activity…   │
└──────────────┬───────────────┘                ├─────────────────────────────────────┤
               │ invoke                         │ Edge Function autobot-chat           │
               └───────────────────────────────▶│  Gemini + tools, stores every turn   │
                                                │ Edge Function autobot-notify         │
        phone ◀── Web Push (VAPID) ─────────────│  due reminders → push, deduped       │
                                                │ pg_cron: every 5 min → notify        │
                                                │ Vault: Gemini key, cron secret       │
                                                └─────────────────────────────────────┘
```

Shared logic (time, sunrise, planner, reminders, voice, LeetCode roadmap) lives in
`supabase/functions/_shared/core/` and is imported by both the web app (`@core/…`) and the Edge
Functions, so the app and the push reminders always agree on what "today" and "due" mean.
The day rolls over at 5 AM, so 2 AM still counts as tonight.

## Develop

```bash
npm install
npm run dev                          # uses .env (Supabase)
VITE_FORCE_LOCAL=1 npm run dev       # no account; open /?demo for sample data
npm test                             # core logic (vitest)
npm run test:functions               # Edge Function tools (deno)
npm run check:functions              # type-check Edge Functions (deno)
```

## Supabase

```bash
npx supabase link --project-ref jpallbmetcrnzwzsmgbp
npx supabase db push                                   # migrations in supabase/migrations
npx supabase functions deploy autobot-chat autobot-notify
```

Secrets:

| Where | Name | Purpose |
|---|---|---|
| Supabase function secret | `VAPID_KEYS` | Web Push signing keys (JSON) |
| Supabase function secret | `ALLOWED_EMAILS` | Only these accounts can use the Gemini-backed chat |
| Supabase Vault | `gemini_api_key` | Synced from the GitHub secret by the deploy workflow |
| Supabase Vault | `autobot_cron_secret` | Generated in-database; shared by pg_cron and the notify function |
| GitHub secret | `GEMINI_API_KEY` (or legacy `VITE_GEMINI_API_KEY`) | Source for the Vault copy — never bundled into the site |
| GitHub secret | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser client |
| GitHub secret | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Deploy workflow's Vault sync |

Personal starter knowledge is not in this public repo: it sits in the private `memory_inbox` table
and is claimed into `memories` the first time the matching account signs in.
