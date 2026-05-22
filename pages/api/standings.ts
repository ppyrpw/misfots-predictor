import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { rankStandings } from '@/lib/constants'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { data, error } = await supabase
    .from('standings')
    .select('team_name, flag, stage, wins, draws, losses, goals_for, goals_against, updated_at')

  if (error || !data) {
    return res.status(500).json({ error: 'Failed to fetch standings' })
  }

  const ranked = rankStandings(data).map((t, i) => ({ ...t, rank: i + 1 }))

  // Cache for 5 minutes on the CDN edge
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
  return res.status(200).json({ standings: ranked, updatedAt: data[0]?.updated_at ?? null })
}
