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

export function rankStandings(teams: Standing[]): Standing[] {
  const hasRanks = teams.every(t => typeof t.rank === 'number')
  if (hasRanks) {
    return [...teams].sort((a, b) => (a.rank! - b.rank!))
  }
  return [...teams].sort((a, b) => {
    const pa = (a.wins ?? 0) * 3 + (a.draws ?? 0)
    const pb = (b.wins ?? 0) * 3 + (b.draws ?? 0)
    if (pa !== pb) return pb - pa
    const gda = (a.goals_for ?? 0) - (a.goals_against ?? 0)
    const gdb = (b.goals_for ?? 0) - (b.goals_against ?? 0)
    if (gda !== gdb) return gdb - gda
    return (b.goals_for ?? 0) - (a.goals_for ?? 0)
  })
}

export function calcScore(picks: Record<string, string>, standings: Standing[]): { total: number; filled: number } {
  let total = 0
  let filled = 0

  const leagueMaps: Record<string, Record<string, number>> = {}
  standings.forEach(s => {
    if (!s.league || typeof s.rank !== 'number') return
    leagueMaps[s.league] = leagueMaps[s.league] || {}
    leagueMaps[s.league][s.team_name] = s.rank!
  })

  PREDICTION_SLOTS.forEach(slot => {
    const pick = picks[slot.id]
    if (!pick) return
    filled++
    const leagueMap = leagueMaps[slot.league] || {}
    const actualRank = leagueMap[pick]
    const [, posStr] = slot.id.split('-')
    const pos = parseInt(posStr, 10)
    if (actualRank === pos) {
      total += 3
    } else {
      if (slot.league === 'PL') {
        if ((pos >= 1 && pos <= 6) && actualRank && actualRank >= 1 && actualRank <= 6) total += 1
        else if ((pos >= 18 && pos <= 20) && actualRank && actualRank >= 18 && actualRank <= 20) total += 1
      } else if (slot.league === 'CH') {
        if ((pos >= 1 && pos <= 2) && actualRank && actualRank >= 1 && actualRank <= 2) total += 1
        else if ((pos >= 22 && pos <= 24) && actualRank && actualRank >= 22 && actualRank <= 24) total += 1
      }
    }
  })

  return { total, filled }
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
  // add more as you see them in logs
}

/**
 * normaliseTeamName
 * - Try exact mapping from API_TEAM_NAME_MAP (lowercased)
 * - Then try exact case-insensitive match against club names in LEAGUES
 * - If nothing matches, return the API name unchanged (and optionally log it)
 */
export function normaliseTeamName(apiName: string): string {
  if (!apiName) return apiName
  const key = apiName.trim().toLowerCase()

  // 1) explicit mappings
  if (API_TEAM_NAME_MAP[key]) return API_TEAM_NAME_MAP[key]

  // 2) try match against known league names
  for (const leagueKey of Object.keys(LEAGUES)) {
    const teams = LEAGUES[leagueKey].teams || []
    for (const t of teams) {
      if (t.name && t.name.trim().toLowerCase() === key) return t.name
    }
  }

  // 3) Not found — log so we can add to API_TEAM_NAME_MAP later
  // (cron runs on server — these warnings will show in logs)
  console.warn(`normaliseTeamName: no mapping found for API name "${apiName}"`)
  return apiName
}
