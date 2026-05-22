/**
 * /api/cron/update-standings
 *
 * Called automatically by Vercel Cron (see vercel.json).
 * Also callable manually: GET /api/cron/update-standings?secret=YOUR_CRON_SECRET
 *
 * What it does:
 *  1. Fetches all WC2026 match results from API-Football (league=1, season=2026)
 *  2. Computes wins/draws/losses/goals per team and their furthest stage reached
 *  3. Writes the result back to the `standings` table in Supabase
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { normaliseTeamName } from '@/lib/constants'

// API-Football stage name → our stage name
const STAGE_MAP: Record<string, string> = {
  'Group Stage': 'Group Stage',
  '3rd Place Final': 'Semi-Final',  // lost semi = 3rd/4th
  'Round of 32': 'Round of 32',
  'Round of 16': 'Round of 16',
  'Quarter-finals': 'Quarter-Final',
  'Semi-finals': 'Semi-Final',
  'Final': 'Runner-Up',             // loser of final
}

const STAGE_RANK: Record<string, number> = {
  'Group Stage': 0, 'Round of 32': 1, 'Round of 16': 2,
  'Quarter-Final': 3, 'Semi-Final': 4, 'Runner-Up': 5, 'Champion': 6,
}

type TeamStats = {
  wins: number; draws: number; losses: number
  goals_for: number; goals_against: number
  stage: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security: Vercel Cron sets this header automatically; manual calls need the secret query param
  const cronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return res.status(500).json({ error: 'API_FOOTBALL_KEY not set' })

  try {
    // Fetch all fixtures for WC 2026 from API-Football
    const response = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      }
    )

    if (!response.ok) throw new Error(`API-Football error: ${response.status}`)
    const json = await response.json()
    const fixtures = json.response ?? []

    // Build per-team stats from completed fixtures
    const stats: Record<string, TeamStats> = {}

    const ensure = (name: string) => {
      if (!stats[name]) stats[name] = { wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, stage: 'Group Stage' }
    }

    const upgradeStage = (team: string, apiStage: string, isWinner: boolean) => {
      let mapped = STAGE_MAP[apiStage] ?? 'Group Stage'
      // The Final winner becomes Champion
      if (apiStage === 'Final' && isWinner) mapped = 'Champion'
      const current = STAGE_RANK[stats[team].stage] ?? 0
      const next = STAGE_RANK[mapped] ?? 0
      if (next > current) stats[team].stage = mapped
    }

    for (const fixture of fixtures) {
      const status = fixture.fixture?.status?.short
      if (!['FT', 'AET', 'PEN'].includes(status)) continue  // skip unplayed/live

      const home = normaliseTeamName(fixture.teams?.home?.name ?? '')
      const away = normaliseTeamName(fixture.teams?.away?.name ?? '')
      const hg = fixture.goals?.home ?? 0
      const ag = fixture.goals?.away ?? 0
      const apiStage = fixture.league?.round ?? 'Group Stage'

      ensure(home); ensure(away)

      stats[home].goals_for += hg
      stats[home].goals_against += ag
      stats[away].goals_for += ag
      stats[away].goals_against += hg

      if (hg > ag) {
        stats[home].wins++; stats[away].losses++
        upgradeStage(home, apiStage, true)
        upgradeStage(away, apiStage, false)
      } else if (ag > hg) {
        stats[away].wins++; stats[home].losses++
        upgradeStage(away, apiStage, true)
        upgradeStage(home, apiStage, false)
      } else {
        stats[home].draws++; stats[away].draws++
        upgradeStage(home, apiStage, false)
        upgradeStage(away, apiStage, false)
      }
    }

    // Upsert into Supabase
    const updates = Object.entries(stats).map(([team_name, s]) => ({
      team_name,
      stage: s.stage,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      goals_for: s.goals_for,
      goals_against: s.goals_against,
      updated_at: new Date().toISOString(),
    }))

    if (updates.length > 0) {
      const { error } = await supabaseAdmin
        .from('standings')
        .upsert(updates, { onConflict: 'team_name' })
      if (error) throw error
    }

    console.log(`[cron] Updated ${updates.length} teams from ${fixtures.length} fixtures`)
    return res.status(200).json({ ok: true, teamsUpdated: updates.length, fixturesProcessed: fixtures.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron] Failed:', message)
    return res.status(500).json({ error: message })
  }
}
