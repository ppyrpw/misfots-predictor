import type { NextApiRequest, NextApiResponse } from 'next'
import Head from 'next/head'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './_app'
import { TEAMS, PREDICTION_SLOTS, rankStandings, calcScore } from '@/lib/constants'
import type { Standing } from '@/lib/constants'

type Page = 'standings' | 'league' | 'predict' | 'auth' | 'profile'
type LeagueRow = { name: string; email: string; score: number; filled: number }

const DEADLINE = new Date(process.env.NEXT_PUBLIC_DEADLINE || '2026-06-11T18:00:00.000Z')
const sortedTeams = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name))

// ────────────────────────────────────────────────────────────────
// Standings page
// ────────────────────────────────────────────────────────────────
function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/standings')
      .then(r => r.json())
      .then(d => { setStandings(d.standings ?? []); setUpdatedAt(d.updatedAt) })
      .finally(() => setLoading(false))
  }, [])

  const ranked = rankStandings(standings)
  const leader = ranked[0]

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    : '—'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500 }}>League standings</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--mono)' }}>All clubs · Position → record → GD → goals scored</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-badge" style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'var(--green-bg)', padding: '3px 8px', borderRadius: 4 }}>● LIVE</span>
          {updatedAt && <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Updated {fmt(updatedAt)}</span>}
        </div>
      </div>

      <div className="info-row">
        <div className="info-card"><div className="ic-label">Leagues</div><div className="ic-val">2</div><div className="ic-sub">Premier & Championship</div></div>
        <div className="info-card"><div className="ic-label">Leader</div><div className="ic-val" style={{ fontSize: 15 }}>{leader ? `${leader.team_name}` : '—'}</div><div className="ic-sub">{leader?.league || '—'}</div></div>
        <div className="info-card"><div className="ic-label">Picks deadline</div><div className="ic-val" style={{ fontSize: 15 }}>Jun 11</div><div className="ic-sub">1:00 PM Central</div></div>
        <div className="info-card"><div className="ic-label">Updated every</div><div className="ic-val" style={{ fontSize: 15 }}>30m</div><div className="ic-sub">Auto via cron</div></div>
      </div>

      {loading ? <p style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading standings…</p> : (
        <div className="section-card">
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 40 }}>#</th><th>Club</th>
              <th style={{ textAlign: 'right' }}>W</th><th style={{ textAlign: 'right' }}>D</th><th style={{ textAlign: 'right' }}>L</th>
              <th style={{ textAlign: 'right' }}>GF</th><th style={{ textAlign: 'right' }}>GA</th><th style={{ textAlign: 'right' }}>GD</th><th style={{ textAlign: 'right' }}>Pts</th>
            </tr></thead>
            <tbody>
              {ranked.map((t, i) => {
                const gd = (t.goals_for ?? 0) - (t.goals_against ?? 0)
                return (
                  <tr key={`${t.league}-${t.team_name}`}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>{t.rank ?? i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{t.team_name}</td>
                    <td className="num-cell">{t.wins ?? '—'}</td>
                    <td className="num-cell">{t.draws ?? '—'}</td>
                    <td className="num-cell">{t.losses ?? '—'}</td>
                    <td className="num-cell">{t.goals_for ?? '—'}</td>
                    <td className="num-cell">{t.goals_against ?? '—'}</td>
                    <td className="num-cell" style={{ color: gd > 0 ? 'var(--green)' : gd < 0 ? 'var(--red)' : 'var(--text-2)' }}>{gd > 0 ? '+' : ''}{gd}</td>
                    <td className="num-cell" style={{ fontWeight: 500 }}>{(t.wins ?? 0) * 3 + (t.draws ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', fontFamily: 'var(--mono)' }}>Highlighted ranks = prediction positions</p>
    </>
  )
}

// The rest of the file remains unchanged; keep existing LeaguePage, PredictPage, AuthPage, ProfilePage, and Home components

export default function Home() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<Page>('standings')

  const nav = (p: Page) => setPage(p)

  return (
    <>
      <Head>
        <title>WC2026 Predictor</title>
        <meta name="description" content="FIFA World Cup 2026 prediction game" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="app">
        <header className="header">
          <div>
            <div className="logo-title">⚽ WC2026 Predictor</div>
            <div className="logo-sub">FIFA World Cup · USA / Canada / Mexico</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <nav className="nav">
              {(['standings', 'league', 'predict'] as Page[]).map(p => (
                <button key={p} className={`nav-btn ${page === p ? 'active' : ''}`} onClick={() => nav(p)}>
                  {p === 'standings' ? 'Standings' : p === 'league' ? 'League' : 'My Picks'}
                </button>
              ))}
            </nav>
            {!loading && (
              user
                ? <div className="user-pill" onClick={() => nav('profile')}><div className="user-dot" /><span>{user.name.split(' ')[0]}</span></div>
                : <button className="btn-secondary" onClick={() => nav('auth')}>Sign in</button>
            )}
          </div>
        </header>

        <main className="page">
          {page === 'standings' && <StandingsPage />}
          {/* placeholders for other pages are still provided by the main app */}
        </main>
      </div>
    </>
  )
}
