import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const league = (req.query.league as string | undefined) ?? null
  try {
    let query = supabaseAdmin.from('standings').select('*')
    if (league) query = query.eq('league', league)
    const { data, error } = await query.order('rank', { ascending: true })
    if (error) throw error
    const updatedAt = (data ?? []).reduce<string | null>((latest, row) => {
      if (!row.updated_at) return latest
      return !latest || Date.parse(row.updated_at) > Date.parse(latest) ? row.updated_at : latest
    }, null)
    return res.status(200).json({ standings: data ?? [], updatedAt })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
