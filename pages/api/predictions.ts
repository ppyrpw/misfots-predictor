import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { PREDICTION_SLOTS } from '@/lib/constants'

const DEADLINE = new Date(process.env.NEXT_PUBLIC_DEADLINE || '2026-06-11T18:00:00.000Z')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getSession(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('predictions')
      .select('picks')
      .eq('user_id', user.id)
      .single()
    return res.status(200).json({ picks: data?.picks ?? {} })
  }

  if (req.method === 'POST') {
    if (new Date() > DEADLINE) {
      return res.status(403).json({ error: 'Prediction deadline has passed' })
    }

    const { picks } = req.body
    if (!picks || typeof picks !== 'object') {
      return res.status(400).json({ error: 'Invalid picks' })
    }

    // Validate: only allowed slots, all values are strings
    const sanitised: Record<string, string> = {}
    for (const slot of PREDICTION_SLOTS) {
      const val = picks[slot]
      if (val && typeof val === 'string') sanitised[slot] = val
    }

    // Upsert (insert or update)
    const { error } = await supabaseAdmin
      .from('predictions')
      .upsert(
        { user_id: user.id, picks: sanitised, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) return res.status(500).json({ error: 'Failed to save predictions' })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
