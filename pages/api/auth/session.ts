import type { NextApiRequest, NextApiResponse } from 'next'
import { clearSession, getSession } from '@/lib/session'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    clearSession(res)
    return res.status(200).json({ ok: true })
  }
  if (req.method === 'GET') {
    const user = getSession(req)
    return res.status(200).json({ user })
  }
  return res.status(405).end()
}
