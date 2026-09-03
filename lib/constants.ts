export type Team = { id?: string; name: string; flag?: string; emoji?: string }

export const LEAGUES: Record<string, { key: string; name: string; teams: Team[] }> = {
  PL: {
    key: 'PL',
    name: 'Premier League',
    teams: [
      { name: 'Arsenal' },
      { name: 'Aston Villa' },
      { name: 'Bournemouth' },
      { name: 'Brentford' },
      { name: 'Brighton & Hove Albion' },
      { name: 'Chelsea' },
      { name: 'Coventry City' },
      { name: 'Crystal Palace' },
      { name: 'Everton' },
      { name: 'Fulham' },
      { name: 'Hull City' },
      { name: 'Ipswich Town' },
      { name: 'Leeds United' },
      { name: 'Liverpool' },
      { name: 'Manchester City' },
      { name: 'Manchester United' },
      { name: 'Newcastle United' },
      { name: 'Nottingham Forest' },
      { name: 'Sunderland' },
      { name: 'Tottenham Hotspur' },
    ],
  },
  CH: {
    key: 'CH',
    name: 'Championship',
    teams: [
      { name: 'Birmingham City' },
      { name: 'Blackburn Rovers' },
      { name: 'Bolton Wanderers' },
      { name: 'Bristol City' },
      { name: 'Burnley' },
      { name: 'Cardiff City' },
      { name: 'Charlton Athletic' },
      { name: 'Derby County' },
      { name: 'Lincoln City' },
      { name: 'Middlesbrough' },
      { name: 'Millwall' },
      { name: 'Norwich City' },
      { name: 'Portsmouth' },
      { name: 'Preston North End' },
      { name: 'Queens Park Rangers' },
      { name: 'Sheffield United' },
      { name: 'Southampton' },
      { name: 'Stoke City' },
      { name: 'Swansea City' },
      { name: 'Watford' },
      { name: 'West Bromwich Albion' },
      { name: 'West Ham United' },
      { name: 'Wolverhampton Wanderers' },
      { name: 'Wrexham' },
    ],
  },
}

// Flattened teams list for older UI/code that imports TEAMS
export const TEAMS: Team[] = Object.values(LEAGUES).flatMap(l => (l.teams || []).map(t => ({ ...t })))

export const PREDICTION_SLOTS = [
  // PL top 6
  ...Array.from({ length: 6 }, (_, i) => ({ id: `PL-${i + 1}`, label: `Premier League — Position ${i + 1}`, league: 'PL' })),
  // PL bottom 3 (18-20)
  ...[18, 19, 20].map(pos => ({ id: `PL-${pos}`, label: `Premier League — Position ${pos} (Relegation)`, league: 'PL' })),

  // CH top 2
  ...Array.from({ length: 2 }, (_, i) => ({ id: `CH-${i + 1}`, label: `Championship — Position ${i + 1}`, league: 'CH' })),
  // CH bottom 3 (22-24)
  ...[22, 23, 24].map(pos => ({ id: `CH-${pos}`, label: `Championship — Position ${pos} (Relegation)`, league: 'CH' })),
]

export const REQUIRED_PICKS = PREDICTION_SLOTS.length // 14

export type Standing = {
  team_name: string
  flag?: string
  wins?: number
  draws?: number
  losses?: number
  goals_for?: number
  goals_against?: number
  rank?: number // 1-based position in the final table for that league
  league?: string
}

function compareStandings(a: Standing, b: Standing) {
  const pa = (a.wins ?? 0) * 3 + (a.draws ?? 0)
  const pb = (b.wins ?? 0) * 3 + (b.draws ?? 0)
  if (pa !== pb) return pb - pa
  const gda = (a.goals_for ?? 0) - (a.goals_against ?? 0)
  const gdb = (b.goals_for ?? 0) - (b.goals_against ?? 0)
  if (gda !== gdb) return gdb - gda
  return (b.goals_for ?? 0) - (a.goals_for ?? 0)
}

function rankGroup(group: Standing[]): Standing[] {
  const hasRanks = group.length > 0 && group.every(t => typeof t.rank === 'number')
  if (hasRanks) return [...group].sort((a, b) => a.rank! - b.rank!)
  return [...group].sort(compareStandings).map((t, i) => ({ ...t, rank: i + 1 }))
}

/** Rank each league separately so Championship 1st is not compared with Premier League 1st. */
export function rankStandings(teams: Standing[]): Standing[] {
  const byLeague: Record<string, Standing[]> = {}
  const ungrouped: Standing[] = []

  for (const team of teams) {
    if (team.league) {
      byLeague[team.league] = byLeague[team.league] || []
      byLeague[team.league].push(team)
    } else {
      ungrouped.push(team)
    }
  }

  const ranked = Object.keys(byLeague).sort().flatMap(league => rankGroup(byLeague[league]))
  if (ungrouped.length === 0) return ranked
  return ranked.concat(rankGroup(ungrouped))
}

export function slotNumber(slotId: string): number {
  return parseInt(slotId.split('-')[1], 10)
}

function stripClubSuffix(name: string): string {
  return name
    .trim()
    .replace(/\s+(?:a\.?f\.?c\.?|f\.?c\.?)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function teamLookupKey(name: string): string {
  return stripClubSuffix(name).toLowerCase()
}

function leagueRankMaps(standings: Standing[]): Record<string, Record<string, number>> {
  const leagueMaps: Record<string, Record<string, number>> = {}
  standings.forEach(s => {
    if (!s.league || typeof s.rank !== 'number' || !s.team_name) return
    leagueMaps[s.league] = leagueMaps[s.league] || {}
    leagueMaps[s.league][teamLookupKey(s.team_name)] = s.rank
  })
  return leagueMaps
}

/** Points for one pick: |predicted slot − actual rank| in that league. Null if no pick or no standing. */
export function pickScore(slotId: string, teamName: string | undefined, standings: Standing[]): number | null {
  if (!teamName) return null
  const slot = PREDICTION_SLOTS.find(s => s.id === slotId)
  if (!slot) return null
  const predictedPos = slotNumber(slotId)
  const actualRank = leagueRankMaps(standings)[slot.league]?.[teamLookupKey(teamName)]
  if (typeof actualRank !== 'number' || Number.isNaN(predictedPos)) return null
  return Math.abs(predictedPos - actualRank)
}

export function calcScore(picks: Record<string, string>, standings: Standing[]): { total: number; pl: number; ch: number; filled: number } {
  let pl = 0
  let ch = 0
  let filled = 0
  const maps = leagueRankMaps(standings)

  PREDICTION_SLOTS.forEach(slot => {
    const pick = picks[slot.id]
    if (!pick) return
    filled++
    const actualRank = maps[slot.league]?.[teamLookupKey(pick)]
    const predictedPos = slotNumber(slot.id)
    if (typeof actualRank !== 'number' || Number.isNaN(predictedPos)) return
    const pts = Math.abs(predictedPos - actualRank)
    if (slot.league === 'PL') pl += pts
    else if (slot.league === 'CH') ch += pts
  })

  return { total: pl + ch, pl, ch, filled }
}

// API → canonical name map for common variants
const API_TEAM_NAME_MAP: Record<string, string> = {
  // exact API variants (lowercased) -> canonical name used in LEAGUES
  'man city': 'Manchester City',
  'manchester city fc': 'Manchester City',
  'man utd': 'Manchester United',
  'manchester united fc': 'Manchester United',
  'wolves': 'Wolverhampton Wanderers',
  'nottingham forest fc': 'Nottingham Forest',
  'qpr': 'Queens Park Rangers',
  'afc bournemouth' : 'Bournemouth'
  // add more as you see them in logs
}

/**
 * normaliseTeamName
 * - Drop trailing FC / AFC from the API name
 * - Try exact mapping from API_TEAM_NAME_MAP (lowercased)
 * - Then try case-insensitive match against club names in LEAGUES
 * - If nothing matches, return the name without the club suffix
 */
export function normaliseTeamName(apiName: string): string {
  if (!apiName) return apiName
  const stripped = stripClubSuffix(apiName)
  const candidates = [apiName.trim().toLowerCase(), stripped.toLowerCase()]

  for (const key of candidates) {
    if (API_TEAM_NAME_MAP[key]) return API_TEAM_NAME_MAP[key]
  }

  for (const leagueKey of Object.keys(LEAGUES)) {
    const teams = LEAGUES[leagueKey].teams || []
    for (const t of teams) {
      if (t.name && teamLookupKey(t.name) === teamLookupKey(stripped)) return t.name
    }
  }

  console.warn(`normaliseTeamName: no mapping found for API name "${apiName}"`)
  return stripped
}
