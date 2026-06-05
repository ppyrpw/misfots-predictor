import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { setSession } from '@/lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, password_hash')
    .eq('email', email.toLowerCase())
    .single()

  if (!user) return res.status(401).json({ error: 'Invalid email or password' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

  setSession(res, { id: user.id, name: user.name, email: user.email })
  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } })
}
