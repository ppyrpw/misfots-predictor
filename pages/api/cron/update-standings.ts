/**
 * /api/cron/update-standings
 *
 * Now supports fetching standings for Premier League (PL) and Championship (CH).
 * Set env vars PL_LEAGUE_ID and CH_LEAGUE_ID (API-Football numeric league IDs) and API_FOOTBALL_KEY.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { normaliseTeamName } from '@/lib/constants'

/**
 * DEPRECATED: Old API-Football fixture-based approach
 * Kept for reference only. Use fetchStandingsForLeague instead.
 */
/*

async function fetchFixturesForLeague(leagueId: string | undefined, season: string) {
  if (!leagueId) return []
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) throw new Error('API_FOOTBALL_KEY not set')
  const res = await fetch(`http://api.football-data.org/v4/competitions/PL/standings`, {
    headers: {'X-Auth-Token':  apiKey}
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`)
  const json = await res.json()
  return json.response ?? []
}
*/

/**
 * Fetch standings directly from football-data.org API
 * Returns the standings object which already contains computed table
 */
async function fetchStandingsForLeague(leagueId: string | undefined, season: string) {
  if (!leagueId) return []
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY not set')
  const res = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings?season=${season}`, {
    headers: { 'X-Auth-Token': apiKey }
  })
  if (!res.ok) throw new Error(`Football-Data.org error: ${res.status}`)
  const json = await res.json()
  return json.standings ?? []
}

/**
 * DEPRECATED: Old fixture-based computation
 * Kept for reference only. Use parseLeagueStandingsFromAPI instead.
 */
/*

async function computeLeagueTableFromFixtures(fixtures: any[]) {
  const stats: Record<string, any> = {}
  const ensure = (name: string) => { if (!stats[name]) stats[name] = { wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 } }

  for (const f of fixtures) {
    const scoreA = f.teams?.home && f.goals && typeof f.goals.home === 'number' ? f.goals.home : null
    const scoreB = f.teams?.away && f.goals && typeof f.goals.away === 'number' ? f.goals.away : null
    if (scoreA === null || scoreB === null) continue // skip unplayed
    const home = normaliseTeamName(f.teams.home.name)
    const away = normaliseTeamName(f.teams.away.name)
    ensure(home); ensure(away)
    stats[home].goals_for += scoreA
    stats[home].goals_against += scoreB
    stats[away].goals_for += scoreB
    stats[away].goals_against += scoreA
    if (scoreA > scoreB) { stats[home].wins++ ; stats[away].losses++ }
    else if (scoreA < scoreB) { stats[away].wins++ ; stats[home].losses++ }
    else { stats[home].draws++ ; stats[away].draws++ }
  }

  const rows = Object.entries(stats).map(([team, s]) => ({ team_name: team, ...s }))
  // sort by points -> gd -> gf
  rows.sort((a, b) => {
    const pa = a.wins * 3 + a.draws
    const pb = b.wins * 3 + b.draws
    if (pa !== pb) return pb - pa
    const gda = a.goals_for - a.goals_against
    const gdb = b.goals_for - b.goals_against
    if (gda !== gdb) return gdb - gda
    return b.goals_for - a.goals_for
  })

  // attach rank
  rows.forEach((r, i) => (r.rank = i + 1))
  return rows
}
*/

/**
 * Parse standings from football-data.org API response
 * Extracts team data from pre-computed standings table
 */
async function parseLeagueStandingsFromAPI(standingsData: any[]) {
  const rows: any[] = []
  
  // standingsData is array of standings objects (usually just one for TOTAL type)
  for (const standing of standingsData) {
    if (standing.type !== 'TOTAL') continue // skip group/stage standings
    
    // standing.table contains the teams
    for (const entry of standing.table || []) {
      const team = entry.team
      const canonicalName = normaliseTeamName(team.name)
      
      rows.push({
        team_name: canonicalName,
        wins: entry.won || 0,
        draws: entry.draw || 0,
        losses: entry.lost || 0,
        goals_for: entry.goalsFor || 0,
        goals_against: entry.goalsAgainst || 0,
        rank: entry.position || 0
      })
    }
    
    break // only use first TOTAL standing
  }
  
  return rows
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security: Vercel Cron sets this header automatically; manual calls need the secret query param
  const cronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const season = process.env.SEASON || '2026'
  try {
    const plStandings = await fetchStandingsForLeague(process.env.PL_LEAGUE_ID, season)
    const chStandings = await fetchStandingsForLeague(process.env.CH_LEAGUE_ID, season)

    const plTable = await parseLeagueStandingsFromAPI(plStandings)
    const chTable = await parseLeagueStandingsFromAPI(chStandings)

    // Upsert standings: we'll tag with league so frontend can request combined or per-league views
    const upserts: any[] = []
    plTable.forEach(r => upserts.push({ league: 'PL', team_name: r.team_name, wins: r.wins, draws: r.draws, losses: r.losses, goals_for: r.goals_for, goals_against: r.goals_against, rank: r.rank }))
    chTable.forEach(r => upserts.push({ league: 'CH', team_name: r.team_name, wins: r.wins, draws: r.draws, losses: r.losses, goals_for: r.goals_for, goals_against: r.goals_against, rank: r.rank }))

    // Clear existing standings for these leagues then insert
    await supabaseAdmin.from('standings').delete().in('league', ['PL', 'CH'])
    for (const row of upserts) {
      await supabaseAdmin.from('standings').insert(row)
    }

    return res.status(200).json({ ok: true, teamsUpdated: upserts.length })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
