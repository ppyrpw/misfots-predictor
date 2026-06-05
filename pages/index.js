import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useAuth } from './_app'
import { TEAMS, PREDICTION_SLOTS, rankStandings, calcScore } from '../lib/constants'

const DEADLINE = new Date(process.env.NEXT_PUBLIC_DEADLINE || '2026-06-18T18:00:00.000Z')
const sortedTeams = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name))

function stageClass(stage) {
  const map = { Champion: 's-champion', 'Runner-Up': 's-runner-up', 'Semi-Final': 's-semi', 'Quarter-Final': 's-quarter', 'Round of 16': 's-r16', 'Round of 32': 's-r32', 'Group Stage': 's-group' }
  return map[stage] || 's-group'
}

function StandingsPage() {
  const [standings, setStandings] = useState([])
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/standings').then(r => r.json()).then(d => {
      setStandings(d.standings || [])
      setUpdatedAt(d.updatedAt)
    }).finally(() => setLoading(false))
  }, [])

  const ranked = rankStandings(standings)
  const leader = ranked[0]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500 }}>Tournament standings</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--mono)' }}>All 48 teams · Stage → record → GD → goals scored</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--green)', background: 'var(--green-bg)', padding: '3px 8px', borderRadius: 4 }}>● LIVE</span>
          {updatedAt && <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Updated {new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      </div>
      <div className="info-row">
        <div className="info-card"><div className="ic-label">Teams</div><div className="ic-val">48</div><div className="ic-sub">Competing nations</div></div>
        <div className="info-card"><div className="ic-label">Leader</div><div className="ic-val" style={{ fontSize: 15 }}>{leader ? `${leader.flag} ${leader.team_name}` : '—'}</div><div className="ic-sub">{leader?.stage || '—'}</div></div>
        <div className="info-card"><div className="ic-label">Picks deadline</div><div className="ic-val" style={{ fontSize: 15 }}>{DEADLINE.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })}</div><div className="ic-sub">{DEADLINE.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/Chicago' })}</div></div>
        <div className="info-card"><div className="ic-label">Auto-updates</div><div className="ic-val" style={{ fontSize: 15 }}>Daily</div><div className="ic-sub">at 9am UTC</div></div>
      </div>
      {loading ? <p style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading standings…</p> : (
        <div className="section-card">
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 40 }}>#</th><th>Team</th><th>Stage</th>
              <th style={{ textAlign: 'right' }}>W</th><th style={{ textAlign: 'right' }}>D</th><th style={{ textAlign: 'right' }}>L</th>
              <th style={{ textAlign: 'right' }}>GF</th><th style={{ textAlign: 'right' }}>GA</th><th style={{ textAlign: 'right' }}>GD</th>
            </tr></thead>
            <tbody>
              {ranked.map((t, i) => {
                const isPred = i < 8 || i >= 43
                const gd = t.goals_for - t.goals_against
                return (
                  <tr key={t.team_name}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
                      {isPred ? <span className="rank-hl">{i + 1}</span> : i + 1}
                    </td>
                    <td><span style={{ fontSize: 15, marginRight: 6 }}>{t.flag}</span><span style={{ fontWeight: 500 }}>{t.team_name}</span></td>
                    <td><span className={`stage-badge ${stageClass(t.stage)}`}>{t.stage}</span></td>
                    <td className="num-cell">{t.wins}</td>
                    <td className="num-cell">{t.draws}</td>
                    <td className="num-cell">{t.losses}</td>
                    <td className="num-cell">{t.goals_for}</td>
                    <td className="num-cell">{t.goals_against}</td>
                    <td className="num-cell" style={{ color: gd > 0 ? 'var(--green)' : gd < 0 ? 'var(--red)' : 'var(--text-2)' }}>{gd > 0 ? '+' : ''}{gd}</td>            
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', fontFamily: 'var(--mono)' }}>Highlighted ranks = prediction positions (1–8 and 44–47)</p>
    </>
  )
}

function LeaguePage({ onNavigate }) {
  const { user } = useAuth()
  const [table, setTable] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/league').then(r => r.json()).then(d => setTable(d.table || [])).finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 500 }}>Prediction league</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Lowest total points deviation wins · Perfect pick = 0 pts</p>
        </div>
        {user ? <button className="btn-secondary" onClick={() => onNavigate('predict')}>Edit my picks →</button>
          : <button className="btn-secondary" onClick={() => onNavigate('auth')}>Join to predict →</button>}
      </div>
      {loading ? <p style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading…</p>
        : table.length === 0 ? (
          <div className="empty-state">
            <h3>No participants yet</h3>
            <p>Be the first to join and make your predictions.</p>
            <br />
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => onNavigate('auth')}>Join the game</button>
          </div>
        ) : (
          <div className="section-card">
            <table className="data-table">
              <thead><tr>
                <th style={{ width: 36 }}>Pos</th><th>Participant</th><th>Email</th>
                <th style={{ textAlign: 'right' }}>Picks</th><th style={{ textAlign: 'right' }}>Score</th>
              </tr></thead>
              <tbody>
                {table.map((row, i) => (
                  <tr key={row.email} style={{ background: user?.email === row.email ? '#f5f4f1' : undefined }}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ fontWeight: 500 }}>{row.name}{user?.email === row.email && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>(you)</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{row.email}</td>
                    <td className="num-cell">{row.filled}/12</td>
                    <td className="num-cell"><span className="score-pill">{row.score} pts</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', fontFamily: 'var(--mono)', marginTop: 12 }}>
        Score = Σ |predicted rank − actual rank| across your 12 picks. Lower is better.
      </p>
    </>
  )
}

function PredictPage({ onNavigate }) {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingPicks, setLoadingPicks] = useState(true)
  const past = new Date() > DEADLINE
  const deadlineDisplay = DEADLINE.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/Chicago' })

  useEffect(() => {
    if (!user) return
    fetch('/api/predictions').then(r => r.json()).then(d => setPicks(d.picks || {})).finally(() => setLoadingPicks(false))
  }, [user])

  const handleChange = (pos, val) => {
    setPicks(prev => { const next = { ...prev }; if (val) next[pos] = val; else delete next[pos]; return next })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/predictions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks }) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  if (!user) return (
    <div className="auth-wrap"><div className="auth-card">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Sign in to predict</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>Create a profile or sign in to save your predictions.</p>
      <button className="btn-primary" onClick={() => onNavigate('auth')}>Sign in / Register</button>
    </div></div>
  )

  if (loadingPicks) return <p style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading your picks…</p>

  const topSlots = [1, 2, 3, 4, 5, 6, 7, 8]
  const botSlots = [44, 45, 46, 47]
  const filled = PREDICTION_SLOTS.filter(p => picks[p]).length

  const SlotSelect = ({ pos }) => {
    const val = picks[pos] || ''
    const usedElsewhere = new Set(Object.entries(picks).filter(([k]) => parseInt(k) !== pos).map(([, v]) => v))
    return (
      <div className="pred-slot">
        <div className="pred-slot-label">Position {pos}</div>
        <select className="pred-select" value={val} disabled={past} onChange={e => handleChange(pos, e.target.value)}>
          <option value="">— Select team —</option>
          {sortedTeams.map(t => <option key={t.name} value={t.name} disabled={usedElsewhere.has(t.name) && t.name !== val}>{t.flag} {t.name}</option>)}
        </select>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>My predictions</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6 }}>Pick a unique team for each position. {filled}/12 filled.</p>
      </div>
      {past
        ? <div className="banner banner-red">🔒 Predictions are locked. Deadline was {deadlineDisplay}.</div>
        : <div className="banner banner-amber">⏰ Predictions lock on <strong>{deadlineDisplay}</strong>. You can update any time before then.</div>}
      <div className="pred-section">
        <div className="pred-section-title">Top 8 finishers — positions 1 to 8</div>
        <div className="pred-grid">{topSlots.map(p => <SlotSelect key={p} pos={p} />)}</div>
      </div>
      <div className="pred-section">
        <div className="pred-section-title">Bottom 4 — positions 44 to 47</div>
        <div className="pred-grid">{botSlots.map(p => <SlotSelect key={p} pos={p} />)}</div>
      </div>
      {!past && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save predictions'}</button>
          {saved && <span style={{ fontSize: 13, color: 'var(--green)' }}>✓ Saved</span>}
        </div>
      )}
    </>
  )
}

function AuthPage({ onNavigate }) {
  const { refresh } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot' | 'forgot-sent'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (m) => { setMode(m); setError('') }

  const submit = async () => {
    setError(''); setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = mode === 'login' ? { email, password } : { name, email, password }
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error || 'Something went wrong'); return }
    await refresh()
    onNavigate('predict')
  }

  const submitReset = async () => {
    setError(''); setLoading(true)
    await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setLoading(false)
    setMode('forgot-sent')
  }

  if (mode === 'forgot') return (
    <div className="auth-wrap"><div className="auth-card">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Reset password</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>Enter your email and we'll send you a new temporary password.</p>
      <div className="field"><label>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && submitReset()} /></div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <button className="btn-primary" onClick={submitReset} disabled={loading}>{loading ? 'Sending…' : 'Send new password'}</button>
      <div className="switch-link"><a onClick={() => switchMode('login')}>Back to sign in</a></div>
    </div></div>
  )

  if (mode === 'forgot-sent') return (
    <div className="auth-wrap"><div className="auth-card">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Check your email</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>If that email is registered, a new temporary password is on its way. Check your inbox (and spam folder).</p>
      <button className="btn-primary" onClick={() => switchMode('login')}>Back to sign in</button>
    </div></div>
  )

  return (
    <div className="auth-wrap"><div className="auth-card">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{mode === 'login' ? 'Welcome back' : 'Join the game'}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>{mode === 'login' ? 'Sign in to view and update your predictions.' : 'Create your profile to start predicting.'}</p>
      {mode === 'register' && <div className="field"><label>Full name</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></div>}
      <div className="field"><label>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ margin: 0 }}>Password</label>
          {mode === 'login' && <a style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => switchMode('forgot')}>Forgot password?</a>}
        </div>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'login' ? 'Your password' : 'Choose a password'} onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <div className="switch-link">
        {mode === 'login'
          ? <>Don&apos;t have an account? <a onClick={() => switchMode('register')}>Register</a></>
          : <>Already registered? <a onClick={() => switchMode('login')}>Sign in</a></>}
      </div>
    </div></div>
  )
}

function ProfilePage({ onNavigate }) {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/league').then(r => r.json()).then(d => {
      const table = d.table || []
      const myRow = table.find(r => r.email === user.email)
      const myRank = table.findIndex(r => r.email === user.email) + 1
      if (myRow) setStats({ score: myRow.score, filled: myRow.filled, rank: myRank, total: table.length })
    })
  }, [user])

  if (!user) return <div className="empty-state"><h3>Not signed in</h3></div>

  const doLogout = async () => { await logout(); onNavigate('standings') }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>My profile</h2>
        <button className="btn-secondary" onClick={doLogout}>Sign out</button>
      </div>
      <div className="section-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 500 }}>{user.name[0]}</div>
          <div><div style={{ fontWeight: 500, fontSize: 16 }}>{user.name}</div><div style={{ fontSize: 13, color: 'var(--text-2)' }}>{user.email}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <div className="info-card"><div className="ic-label">Rank</div><div className="ic-val">{stats ? stats.rank : '—'}</div><div className="ic-sub">of {stats?.total || '—'}</div></div>
          <div className="info-card"><div className="ic-label">Score</div><div className="ic-val">{stats ? stats.score : '—'}</div><div className="ic-sub">total pts</div></div>
          <div className="info-card"><div className="ic-label">Picks</div><div className="ic-val">{stats ? `${stats.filled}/12` : '—'}</div><div className="ic-sub">completed</div></div>
        </div>
      </div>
      <button className="btn-primary" onClick={() => onNavigate('predict')}>Edit my predictions →</button>
    </div>
  )
}

export default function Home() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('standings')
  const nav = (p) => setPage(p)

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
              {['standings', 'league', 'predict'].map(p => (
                <button key={p} className={`nav-btn ${page === p ? 'active' : ''}`} onClick={() => nav(p)}>
                  {p === 'standings' ? 'Standings' : p === 'league' ? 'League' : 'My Picks'}
                </button>
              ))}
            </nav>
            {!loading && (user
              ? <div className="user-pill" onClick={() => nav('profile')}><div className="user-dot" /><span>{user.name.split(' ')[0]}</span></div>
              : <button className="btn-secondary" onClick={() => nav('auth')}>Sign in</button>
            )}
          </div>
        </header>
        <main className="page">
          {page === 'standings' && <StandingsPage />}
          {page === 'league' && <LeaguePage onNavigate={nav} />}
          {page === 'predict' && <PredictPage onNavigate={nav} />}
          {page === 'auth' && <AuthPage onNavigate={nav} />}
          {page === 'profile' && <ProfilePage onNavigate={nav} />}
        </main>
      </div>
    </>
  )
}
