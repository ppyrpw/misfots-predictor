/**
 * /api/cron/update-standings
 *
 * Now supports fetching standings for Premier League (PL) and Championship (CH).
 * Set env vars PL_LEAGUE_ID and CH_LEAGUE_ID (API-Football numeric league IDs) and API_FOOTBALL_KEY.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { normaliseTeamName } from '@/lib/constants'

export const config = {
  maxDuration: 60,
}

const FETCH_TIMEOUT_MS = 12_000
const MAX_ATTEMPTS = 3
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt: number, retryAfterHeader?: string | null) {
  const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, 15_000)
  }
  return Math.min(500 * 2 ** (attempt - 1), 4_000)
}

function isRetryableError(err: unknown) {
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err)
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /fetch failed|network|econnreset|etimedout|socket|undici/i.test(message)
  )
}

async function fetchWithRetry(url: string, init: RequestInit, logCtx: Record<string, unknown>) {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const started = Date.now()

    try {
      const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
      const durationMs = Date.now() - started
      const retryAfter = res.headers.get('retry-after')

      console.log(
        JSON.stringify({
          source: 'cron/update-standings',
          event: 'external_fetch',
          ...logCtx,
          attempt,
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
          durationMs,
          retryAfter,
        })
      )

      if (res.ok) return res

      const bodyPreview = (await res.text()).slice(0, 300)
      console.warn(
        JSON.stringify({
          source: 'cron/update-standings',
          event: 'external_fetch_error_body',
          ...logCtx,
          attempt,
          status: res.status,
          bodyPreview,
        })
      )

      const shouldRetry = attempt < MAX_ATTEMPTS && RETRYABLE_STATUS.has(res.status)
      if (!shouldRetry) {
        throw new Error(`Football-Data.org error: ${res.status} ${res.statusText}`)
      }

      await sleep(backoffMs(attempt, retryAfter))
    } catch (err) {
      const durationMs = Date.now() - started
      lastError = err
      const aborted = err instanceof Error && err.name === 'AbortError'

      console.error(
        JSON.stringify({
          source: 'cron/update-standings',
          event: aborted ? 'external_fetch_timeout' : 'external_fetch_exception',
          ...logCtx,
          attempt,
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        })
      )

      if (attempt >= MAX_ATTEMPTS || !isRetryableError(err)) throw err
      await sleep(backoffMs(attempt))
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Football-Data.org request failed')
}

function isCronAuthorized(req: NextApiRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
      console.error(
        JSON.stringify({
          source: 'cron/update-standings',
          event: 'auth_misconfigured',
          error: 'CRON_SECRET is not set',
        })
      )
      return false
    }
    return true
  }

  const authorization = req.headers.authorization
  if (authorization === `Bearer ${secret}`) return true

  const headerSecret = req.headers['x-vercel-cron-secret']
  if (typeof headerSecret === 'string' && headerSecret === secret) return true

  const querySecret = req.query.secret
  const fromQuery = Array.isArray(querySecret) ? querySecret[0] : querySecret
  return fromQuery === secret
}

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
  if (!leagueId) {
    console.warn(
      JSON.stringify({
        source: 'cron/update-standings',
        event: 'skip_league',
        reason: 'missing_league_id',
        season,
      })
    )
    return []
  }
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY not set')
  const url = `https://api.football-data.org/v4/competitions/${leagueId}/standings?season=${season}`
  const res = await fetchWithRetry(
    url,
    { headers: { 'X-Auth-Token': apiKey } },
    { leagueId, season, host: 'api.football-data.org' }
  )
  const json = await res.json()
  const standings = json.standings ?? []
  console.log(
    JSON.stringify({
      source: 'cron/update-standings',
      event: 'standings_parsed',
      leagueId,
      season,
      standingGroups: Array.isArray(standings) ? standings.length : 0,
    })
  )
  return standings
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
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  // Manual runs can still use ?secret= or x-vercel-cron-secret.
  if (!isCronAuthorized(req)) {
    console.warn(
      JSON.stringify({
        source: 'cron/update-standings',
        event: 'unauthorized',
        hasAuthHeader: Boolean(req.headers.authorization),
        hasQuerySecret: Boolean(req.query.secret),
      })
    )
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const season = process.env.SEASON || '2026'
  const started = Date.now()
  try {
    const plStandings = await fetchStandingsForLeague(process.env.PL_LEAGUE_ID, season)
    const chStandings = await fetchStandingsForLeague(process.env.CH_LEAGUE_ID, season)

    const plTable = await parseLeagueStandingsFromAPI(plStandings)
    const chTable = await parseLeagueStandingsFromAPI(chStandings)

    // Upsert standings: we'll tag with league so frontend can request combined or per-league views
    const upserts: any[] = []
    plTable.forEach(r => upserts.push({ league: 'PL', team_name: r.team_name, wins: r.wins, draws: r.draws, losses: r.losses, goals_for: r.goals_for, goals_against: r.goals_against, rank: r.rank }))
    chTable.forEach(r => upserts.push({ league: 'CH', team_name: r.team_name, wins: r.wins, draws: r.draws, losses: r.losses, goals_for: r.goals_for, goals_against: r.goals_against, rank: r.rank }))

    const { error: deleteError } = await supabaseAdmin.from('standings').delete().in('league', ['PL', 'CH'])
    if (deleteError) throw deleteError

    if (upserts.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('standings').insert(upserts)
      if (insertError) throw insertError
    }

    console.log(
      JSON.stringify({
        source: 'cron/update-standings',
        event: 'success',
        teamsUpdated: upserts.length,
        plTeams: plTable.length,
        chTeams: chTable.length,
        durationMs: Date.now() - started,
      })
    )

    return res.status(200).json({ ok: true, teamsUpdated: upserts.length })
  } catch (err: any) {
    console.error(
      JSON.stringify({
        source: 'cron/update-standings',
        event: 'handler_error',
        durationMs: Date.now() - started,
        error: err?.message || String(err),
      })
    )
    return res.status(500).json({ error: err.message || String(err) })
  }
}
