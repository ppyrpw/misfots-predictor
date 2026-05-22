-- ─────────────────────────────────────────────────────────────────────────────
-- WC2026 Predictor — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Users table (we manage auth ourselves with bcrypt — no Supabase Auth needed)
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique not null,
  password_hash text not null,
  created_at  timestamptz default now()
);

-- Predictions: one row per user, stores their 12 picks as JSON
-- picks format: { "1": "France", "2": "Brazil", ..., "44": "Curaçao", ... }
create table if not exists predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade not null,
  picks       jsonb not null default '{}',
  updated_at  timestamptz default now(),
  unique(user_id)
);

-- Standings cache: one row per team, updated by the cron job
create table if not exists standings (
  id          uuid primary key default gen_random_uuid(),
  team_name   text unique not null,
  flag        text not null default '',
  stage       text not null default 'Group Stage',
  wins        int not null default 0,
  draws       int not null default 0,
  losses      int not null default 0,
  goals_for   int not null default 0,
  goals_against int not null default 0,
  rank        int,
  updated_at  timestamptz default now()
);

-- Seed standings with all 48 teams (initial/pre-tournament state)
insert into standings (team_name, flag, stage, wins, draws, losses, goals_for, goals_against) values
  ('United States','🇺🇸','Group Stage',0,0,0,0,0),
  ('Mexico','🇲🇽','Group Stage',0,0,0,0,0),
  ('Canada','🇨🇦','Group Stage',0,0,0,0,0),
  ('Panama','🇵🇦','Group Stage',0,0,0,0,0),
  ('Haiti','🇭🇹','Group Stage',0,0,0,0,0),
  ('Curaçao','🇨🇼','Group Stage',0,0,0,0,0),
  ('Argentina','🇦🇷','Group Stage',0,0,0,0,0),
  ('Brazil','🇧🇷','Group Stage',0,0,0,0,0),
  ('Colombia','🇨🇴','Group Stage',0,0,0,0,0),
  ('Uruguay','🇺🇾','Group Stage',0,0,0,0,0),
  ('Ecuador','🇪🇨','Group Stage',0,0,0,0,0),
  ('Paraguay','🇵🇾','Group Stage',0,0,0,0,0),
  ('England','🏴󠁧󠁢󠁥󠁮󠁧󠁿','Group Stage',0,0,0,0,0),
  ('France','🇫🇷','Group Stage',0,0,0,0,0),
  ('Germany','🇩🇪','Group Stage',0,0,0,0,0),
  ('Spain','🇪🇸','Group Stage',0,0,0,0,0),
  ('Portugal','🇵🇹','Group Stage',0,0,0,0,0),
  ('Netherlands','🇳🇱','Group Stage',0,0,0,0,0),
  ('Belgium','🇧🇪','Group Stage',0,0,0,0,0),
  ('Croatia','🇭🇷','Group Stage',0,0,0,0,0),
  ('Switzerland','🇨🇭','Group Stage',0,0,0,0,0),
  ('Norway','🇳🇴','Group Stage',0,0,0,0,0),
  ('Scotland','🏴󠁧󠁢󠁳󠁣󠁴󠁿','Group Stage',0,0,0,0,0),
  ('Austria','🇦🇹','Group Stage',0,0,0,0,0),
  ('Czech Republic','🇨🇿','Group Stage',0,0,0,0,0),
  ('Bosnia & Herzegovina','🇧🇦','Group Stage',0,0,0,0,0),
  ('Sweden','🇸🇪','Group Stage',0,0,0,0,0),
  ('Türkiye','🇹🇷','Group Stage',0,0,0,0,0),
  ('Japan','🇯🇵','Group Stage',0,0,0,0,0),
  ('South Korea','🇰🇷','Group Stage',0,0,0,0,0),
  ('Australia','🇦🇺','Group Stage',0,0,0,0,0),
  ('Iran','🇮🇷','Group Stage',0,0,0,0,0),
  ('Saudi Arabia','🇸🇦','Group Stage',0,0,0,0,0),
  ('Qatar','🇶🇦','Group Stage',0,0,0,0,0),
  ('Iraq','🇮🇶','Group Stage',0,0,0,0,0),
  ('Jordan','🇯🇴','Group Stage',0,0,0,0,0),
  ('Uzbekistan','🇺🇿','Group Stage',0,0,0,0,0),
  ('Morocco','🇲🇦','Group Stage',0,0,0,0,0),
  ('Egypt','🇪🇬','Group Stage',0,0,0,0,0),
  ('Algeria','🇩🇿','Group Stage',0,0,0,0,0),
  ('Ghana','🇬🇭','Group Stage',0,0,0,0,0),
  ('Ivory Coast','🇨🇮','Group Stage',0,0,0,0,0),
  ('Tunisia','🇹🇳','Group Stage',0,0,0,0,0),
  ('Senegal','🇸🇳','Group Stage',0,0,0,0,0),
  ('South Africa','🇿🇦','Group Stage',0,0,0,0,0),
  ('DR Congo','🇨🇩','Group Stage',0,0,0,0,0),
  ('Cape Verde','🇨🇻','Group Stage',0,0,0,0,0),
  ('New Zealand','🇳🇿','Group Stage',0,0,0,0,0)
on conflict (team_name) do nothing;

-- Allow the API routes (server-side only) to read/write everything
-- Public read access for standings (anyone can see the table)
alter table standings enable row level security;
create policy "standings_public_read" on standings for select using (true);
create policy "standings_service_write" on standings for all using (true);  -- service role bypasses RLS anyway

alter table users enable row level security;
create policy "users_service_only" on users for all using (true);

alter table predictions enable row level security;
create policy "predictions_service_only" on predictions for all using (true);
