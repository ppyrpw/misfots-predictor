import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { rankStandings, calcScore } from '@/lib/constants'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const [usersRes, predsRes, standingsRes] = await Promise.all([
    supabaseAdmin.from('users').select('id, name, email'),
    supabaseAdmin.from('predictions').select('user_id, picks'),
    supabaseAdmin.from('standings').select('team_name, flag, stage, wins, draws, losses, goals_for, goals_against'),
  ])

  const users = usersRes.data ?? []
  const preds = predsRes.data ?? []
  const ranked = rankStandings(standingsRes.data ?? [])

  const predMap: Record<string, Record<string, string>> = {}
  preds.forEach(p => { predMap[p.user_id] = p.picks })

  const table = users
    .map(u => {
      const picks = predMap[u.id] ?? {}
      const { total, filled } = calcScore(picks, ranked)
      return { name: u.name, email: u.email, score: total, filled }
    })
    .sort((a, b) => a.score - b.score)

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=30')
  return res.status(200).json({ table })
}
