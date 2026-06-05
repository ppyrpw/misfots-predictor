export const TEAMS = [
  { name: 'United States', flag: '🇺🇸' },
  { name: 'Mexico', flag: '🇲🇽' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Panama', flag: '🇵🇦' },
  { name: 'Haiti', flag: '🇭🇹' },
  { name: 'Curaçao', flag: '🇨🇼' },
  { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Colombia', flag: '🇨🇴' },
  { name: 'Uruguay', flag: '🇺🇾' },
  { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Paraguay', flag: '🇵🇾' },
  { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Netherlands', flag: '🇳🇱' },
  { name: 'Belgium', flag: '🇧🇪' },
  { name: 'Croatia', flag: '🇭🇷' },
  { name: 'Switzerland', flag: '🇨🇭' },
  { name: 'Norway', flag: '🇳🇴' },
  { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'Austria', flag: '🇦🇹' },
  { name: 'Czech Republic', flag: '🇨🇿' },
  { name: 'Bosnia & Herzegovina', flag: '🇧🇦' },
  { name: 'Sweden', flag: '🇸🇪' },
  { name: 'Türkiye', flag: '🇹🇷' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Iran', flag: '🇮🇷' },
  { name: 'Saudi Arabia', flag: '🇸🇦' },
  { name: 'Qatar', flag: '🇶🇦' },
  { name: 'Iraq', flag: '🇮🇶' },
  { name: 'Jordan', flag: '🇯🇴' },
  { name: 'Uzbekistan', flag: '🇺🇿' },
  { name: 'Morocco', flag: '🇲🇦' },
  { name: 'Egypt', flag: '🇪🇬' },
  { name: 'Algeria', flag: '🇩🇿' },
  { name: 'Ghana', flag: '🇬🇭' },
  { name: 'Ivory Coast', flag: '🇨🇮' },
  { name: 'Tunisia', flag: '🇹🇳' },
  { name: 'Senegal', flag: '🇸🇳' },
  { name: 'South Africa', flag: '🇿🇦' },
  { name: 'DR Congo', flag: '🇨🇩' },
  { name: 'Cape Verde', flag: '🇨🇻' },
  { name: 'New Zealand', flag: '🇳🇿' },
]

// The 12 prediction slots: top 8 and bottom 4
export const PREDICTION_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 45, 46, 47, 48]

export const STAGE_RANK: Record<string, number> = {
  'Group Stage': 0,
  'Round of 32': 1,
  'Round of 16': 2,
  'Quarter-Final': 3,
  'Semi-Final': 4,
  'Runner-Up': 5,
  'Champion': 6,
}

export type Standing = {
  team_name: string
  flag: string
  stage: string
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  rank?: number
}

export function rankStandings(teams: Standing[]): Standing[] {
  return [...teams].sort((a, b) => {
    const sa = STAGE_RANK[a.stage] ?? 0
    const sb = STAGE_RANK[b.stage] ?? 0
    if (sa !== sb) return sb - sa
    const pa = a.wins * 3 + a.draws
    const pb = b.wins * 3 + b.draws
    if (pa !== pb) return pb - pa
    const gda = a.goals_for - a.goals_against
    const gdb = b.goals_for - b.goals_against
    if (gda !== gdb) return gdb - gda
    return b.goals_for - a.goals_for
  })
}

export function calcScore(
  picks: Record<string, string>,
  ranked: Standing[]
): { total: number; filled: number } {
  const rankMap: Record<string, number> = {}
  ranked.forEach((t, i) => { rankMap[t.team_name] = i + 1 })
  let total = 0, filled = 0
  PREDICTION_SLOTS.forEach(pos => {
    const pick = picks[pos]
    if (pick) {
      filled++
      const actual = rankMap[pick] ?? pos
      total += Math.abs(actual - pos)
    }
  })
  return { total, filled }
}

// API-Football name → our canonical name mapping
// (their names sometimes differ slightly)
export const API_TEAM_NAME_MAP: Record<string, string> = {
  'USA': 'United States',
  'United States': 'United States',
  'Curacao': 'Curaçao',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Turkey': 'Türkiye',
  'Turkiye': 'Türkiye',
  'Korea Republic': 'South Korea',
  'South Korea': 'South Korea',
  'IR Iran': 'Iran',
  'Congo DR': 'DR Congo',
  'DR Congo': 'DR Congo',
  'Ivory Coast': 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cape Verde Islands': 'Cape Verde',
  'Cape Verde': 'Cape Verde',
  'Czechia': 'Czech Republic',
  'Czech Republic': 'Czech Republic',
  // everything else maps to itself
}

export function normaliseTeamName(apiName: string): string {
  return API_TEAM_NAME_MAP[apiName] ?? apiName
}
