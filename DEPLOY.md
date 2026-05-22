# WC2026 Predictor — Deployment Guide

## What you'll need
- A GitHub account (you have one)
- A Supabase account (free) — https://supabase.com
- A Vercel account (free) — https://vercel.com
- An API-Football account (free) — https://dashboard.api-football.com/register

Total cost: **$0** for a tournament-sized game.

---

## Step 1 — Push to GitHub

```bash
# In the wc2026-predictor folder:
git init
git add .
git commit -m "Initial commit"

# Create a new repo at github.com/new (name it wc2026-predictor, keep it private)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/wc2026-predictor.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Set up Supabase

1. Go to https://supabase.com → New Project
2. Choose a name (e.g. `wc2026`) and a strong database password — save it somewhere
3. Once created, go to **SQL Editor** → **New Query**
4. Paste the entire contents of `supabase-schema.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

---

## Step 3 — Get your API-Football key

1. Register at https://dashboard.api-football.com/register (free tier = 100 calls/day)
2. Copy your API key from the dashboard — this is your `API_FOOTBALL_KEY`

> **Note:** The free tier gives 100 calls/day. At 1 call every 30 minutes that's 48 calls/day during
> the tournament — well within the limit. The cron only runs when there's actually tournament activity.

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Click **Import Git Repository** → connect your GitHub → select `wc2026-predictor`
3. Framework will auto-detect as **Next.js** — leave all build settings as defaults
4. Before clicking Deploy, click **Environment Variables** and add all of these:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `API_FOOTBALL_KEY` | Your API-Football key |
| `SESSION_SECRET` | Any long random string (e.g. `openssl rand -hex 32` in terminal) |
| `NEXT_PUBLIC_DEADLINE` | `2026-06-11T18:00:00.000Z` (1pm Central = 18:00 UTC) |
| `CRON_SECRET` | Another random string — used to secure the cron endpoint |

5. Click **Deploy** — takes about 60 seconds

Your app is now live at `https://wc2026-predictor.vercel.app` (or your custom domain).

---

## Step 5 — Verify the cron job

Vercel runs the cron automatically per `vercel.json` (every 30 minutes). To test it manually:

```
https://your-app.vercel.app/api/cron/update-standings?secret=YOUR_CRON_SECRET
```

You should see: `{"ok":true,"teamsUpdated":48,"fixturesProcessed":0}`

Once the tournament starts and matches are played, this will populate real results.

---

## Step 6 — Share with players

Send people your Vercel URL. They:
1. Click **Sign in** → **Register** to create an account
2. Go to **My Picks** and make their 12 predictions before June 11 at 1pm Central
3. Watch the **League** table update automatically as the tournament progresses

---

## How the standings update works

```
API-Football (match results)
        ↓  every 30 minutes (Vercel Cron)
/api/cron/update-standings
        ↓
Supabase `standings` table
        ↓  on each page load (cached 5 min)
/api/standings → frontend
```

The cron fetches all completed WC2026 fixtures, computes each team's record and
furthest stage reached, then upserts the Supabase standings table. No manual
work required during the tournament.

---

## Manual standings override (optional)

If the API-Football data is wrong or delayed for any reason, you can edit standings
directly in Supabase: **Table Editor → standings → edit any row**.

---

## Custom domain (optional)

In Vercel → your project → **Settings → Domains** → add your domain and follow
the DNS instructions. Takes about 5 minutes.

---

## Troubleshooting

**App deploys but shows no standings**
→ Check that `supabase-schema.sql` was run successfully in Supabase SQL Editor

**Login not working**
→ Check `SESSION_SECRET` is set in Vercel environment variables

**Standings not updating automatically**
→ Check Vercel → your project → **Cron Jobs** tab to see run history and errors
→ Verify `API_FOOTBALL_KEY` is correct in environment variables

**API-Football returning 0 fixtures**
→ The tournament hasn't started yet (Jun 11) or the league ID has changed.
→ Test manually: `curl "https://v3.football.api-sports.io/fixtures?league=1&season=2026" -H "x-rapidapi-key: YOUR_KEY"`
