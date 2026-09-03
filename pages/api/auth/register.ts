import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { setSession } from '@/lib/session'

async function sendWelcomeEmail(email: string, name: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Mystic Misfots <noreply@yourdomain.com>',
      to: email,
      subject: 'Welcome to Mystic Misfots!',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
          <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">⚽ Mystic Misfots</h2>
          <p style="color:#6b6860;margin-bottom:24px">Welcome aboard</p>
          <p>Hi ${name},</p>
          <p style="margin-top:12px">Your account has been created successfully. You're all set to start making predictions!</p>
          <div style="background:#f8f7f4;border:1px solid #e5e3dc;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center">
            <span style="font-size:15px;font-weight:600">${email}</span>
          </div>
          <p style="font-size:13px;color:#6b6860">This is the email address linked to your account. Use it to log in or reset your password if needed.</p>
          <p style="font-size:13px;color:#6b6860;margin-top:16px">Good luck with your predictions!</p>
        </div>
      `,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Email failed: ${err.message || res.status}`)
  }
}

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

  try {
    await sendWelcomeEmail(user.email, user.name)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Welcome email error:', message)
    // Account was created successfully — email failure is non-fatal
  }

  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email } })
}
