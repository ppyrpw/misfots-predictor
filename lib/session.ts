import { createHmac } from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'

const SECRET = process.env.SESSION_SECRET || 'change-me-in-production'
const COOKIE_NAME = 'wc2026_session'

export type SessionUser = { id: string; name: string; email: string }

function sign(payload: SessionUser): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

function verify(token: string): SessionUser | null {
  try {
    const [data, sig] = token.split('.')
    const expected = createHmac('sha256', SECRET).update(data).digest('base64url')
    if (sig !== expected) return null
    return JSON.parse(Buffer.from(data, 'base64url').toString())
  } catch {
    return null
  }
}

export function setSession(res: NextApiResponse, user: SessionUser) {
  const token = sign(user)
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 90}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  )
}

export function clearSession(res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`)
}

export function getSession(req: NextApiRequest): SessionUser | null {
  const raw = req.cookies[COOKIE_NAME]
  if (!raw) return null
  return verify(raw)
}
