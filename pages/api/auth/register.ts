import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { setSession } from '@/lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { name, email, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields required' })
  }

  // Check existing user
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }

  const password_hash = await bcrypt.hash(password, 12)

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({ name, email: email.toLowerCase(), password_hash })
    .select('id, name, email')
    .single()

  if (error || !user) {
    return res.status(500).json({ error: 'Failed to create account' })
  }

  setSession(res, { id: user.id, name: user.name, email: user.email })
  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } })
}
