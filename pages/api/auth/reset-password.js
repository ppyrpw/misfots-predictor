import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../../lib/supabase'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

async function sendResetEmail(email, name, newPassword) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'WC2026 Predictor <noreply@yourdomain.com>',
      to: email,
      subject: 'Your new WC2026 Predictor password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
          <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">⚽ WC2026 Predictor</h2>
          <p style="color:#6b6860;margin-bottom:24px">Password reset</p>
          <p>Hi ${name},</p>
          <p style="margin-top:12px">Your password has been reset. Here is your new temporary password:</p>
          <div style="background:#f8f7f4;border:1px solid #e5e3dc;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center">
            <span style="font-family:monospace;font-size:24px;font-weight:600;letter-spacing:4px">${newPassword}</span>
          </div>
          <p style="font-size:13px;color:#6b6860">You can log in with this password and change it in your profile. If you did not request this reset, please contact the game organiser.</p>
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  // Look up user — don't reveal whether email exists or not (security best practice)
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('email', email.toLowerCase())
    .single()

  // Always return success even if email not found (prevents email enumeration)
  if (!user) return res.status(200).json({ ok: true })

  const newPassword = generatePassword()
  const password_hash = await bcrypt.hash(newPassword, 12)

  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: 'Failed to reset password' })

  try {
    await sendResetEmail(user.email, user.name, newPassword)
  } catch (err) {
    console.error('Email error:', err.message)
    // Still return success — password was reset, email just failed
    // Check Vercel logs if emails aren't arriving
    return res.status(200).json({ ok: true, warning: 'Password reset but email failed — check logs' })
  }

  return res.status(200).json({ ok: true })
}
