# Lock-in Check-in

Daily Mon–Sun lock-in checklist PWA-style web app for **Pratik Pujari** (CU Boulder MS CS).

**Priorities:** Job hunt → LeetCode → Fitness  
**Rule:** Deep work on campus. Home ≠ grind.

Live (after Pages deploy): `https://<user>.github.io/lockin-checkin/`

---

## Design overview

Dark, refined UI — not generic purple AI chrome.

| Token | Value |
|--------|--------|
| Background | `#0c0d10` near-black |
| Cards | `#16181d` warm charcoal |
| Accent (done) | `#7dcea0` soft sage |
| Due today | `#e8b86d` amber |
| Missed | `#c97b84` muted rose |
| Type | DM Sans + JetBrains Mono (counts) |

- Horizontal Mon–Sun week strip with today highlight
- Weekly quota progress rings
- Thumb-friendly 44px check targets, spring checkbox animation, strikethrough
- Sticky **Check in for today** CTA (engagement ≠ finishing every task)
- Guest/localStorage mode when Supabase env is missing

---

## Local development

```bash
cd lockin-checkin
cp .env.example .env   # already present empty — paste keys when ready
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).  
Without Supabase keys the app runs in **guest mode** with a “Connect Supabase” banner; all progress persists in `localStorage`.

```bash
npm run build    # tsc + vite → dist/
npm run preview  # preview production build
```

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run `supabase/schema.sql`.
3. **Authentication → Providers** → enable **Email**.
4. (Optional) disable email confirmation for single-user convenience under Auth settings.
5. Copy **Project URL** and **anon public** key into `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

6. Create one account via the app’s Sign up screen (or Auth page).  
   Profile rows are auto-created by a trigger; `reminder_email` defaults to signup email.

### Tables

- `profiles` — display name, reminder email, sport day (`mon`|`sun`), timezone
- `day_checkins` — tapped “Check in” for a Denver calendar date
- `task_completions` — per-task checks (`task_id` like `wed-block-a-outreach`)
- `weekly_notes` — Sunday win / fix / focus

RLS: users only read/write their own rows.

---

## Environment variables

See `.env.example`. Never commit real secrets (`.env` is gitignored).

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | `.env` + Pages secret | Browser Supabase client |
| `VITE_SUPABASE_ANON_KEY` | `.env` + Pages secret | Browser anon key |
| `VITE_BASE` | build | Defaults to `/lockin-checkin/` |
| `SUPABASE_URL` | Actions secret | Reminder script (same URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Actions secret | Server-side check-in query |
| `REMINDER_TO_EMAIL` | Actions secret | Must match `profiles.reminder_email` |
| `SMTP_*` | Actions secret | Nodemailer transport |
| `PAGES_URL` | Actions secret | Link in reminder email |

---

## GitHub Pages deploy

Repo must be named **`lockin-checkin`** (base path `/lockin-checkin/`), or set `VITE_BASE` accordingly.

1. Push this project to GitHub (`git remote add origin … && git push -u origin main`).
2. **Settings → Pages → Build and deployment** → Source: **GitHub Actions**.
3. Add repository secrets used by `deploy-pages.yml`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).

Optional local deploy: `npm run deploy` (uses `gh-pages` package) — Actions is preferred.

`package.json` `homepage` is set to `https://pratikpujari.github.io/lockin-checkin` — change the username if needed.

---

## Miss-day email reminder

Workflow: `.github/workflows/daily-reminder.yml`  
Script: `scripts/send-reminder.mjs` (Node + nodemailer — **not** in the browser)

### Schedule / timezone nuance

```yaml
cron: '0 2 * * *'   # 02:00 UTC
```

- During **MDT** (UTC−6): ≈ **8:00pm America/Denver**
- During **MST** (UTC−7): ≈ **7:00pm America/Denver**

“Today” inside the script is always computed with `America/Denver` via `Intl`, independent of the runner’s clock.

### Logic

1. Resolve profile where `reminder_email = REMINDER_TO_EMAIL`
2. Look for `day_checkins` row for Denver-today
3. If missing → send a short, warm email with link to `PAGES_URL`

### GitHub Secrets checklist

| Secret | Required |
|--------|----------|
| `SUPABASE_URL` | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ |
| `REMINDER_TO_EMAIL` | ✓ |
| `SMTP_HOST` | ✓ |
| `SMTP_PORT` | ✓ (usually `587`) |
| `SMTP_USER` | ✓ |
| `SMTP_PASS` | ✓ |
| `SMTP_FROM` | ✓ |
| `PAGES_URL` | ✓ |
| `VITE_SUPABASE_URL` | for Pages build |
| `VITE_SUPABASE_ANON_KEY` | for Pages build |

Test anytime: **Actions → Daily miss-day reminder → Run workflow**.

---

## Day structure (encoded in `src/data/tasks.ts`)

| Day | Mode |
|-----|------|
| Mon | Sport with partner **or** light campus (toggle via sport day) |
| Tue | Class day — Linux, Graphics, Capstone; gap admin; campus LC; night peak |
| Wed | Full campus — Block A hunt, B LC, C coursework |
| Thu | Class day (same pattern as Tue) |
| Fri | Full campus + resume pass in night peak |
| Sat | Finish weekly outreach (5), roles (10), LC toward 8–12, close HW |
| Sun | Sport **or** light campus + weekly scoreboard reset |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve `dist` |
| `npm run deploy` | `gh-pages -d dist` |
| `npm run reminder` | Run miss-day script locally (needs env) |

---

## Stack

Vite · React 18 · TypeScript · Tailwind CSS v3 · lucide-react · date-fns + America/Denver · Supabase · GitHub Pages · GitHub Actions + nodemailer
