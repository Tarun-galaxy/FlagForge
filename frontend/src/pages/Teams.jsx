import { useState, useEffect, useMemo } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import apiClient from '../api/client.js'

function Teams() {
  const outletContext = useOutletContext()
  const selectedEnv = outletContext?.selectedEnv || 'development'
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient
      .get(`/flags?environment=${selectedEnv}`)
      .then((res) => {
        setFlags(res.data)
        setError(null)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedEnv])

  // Group flags by team
  const teamsData = useMemo(() => {
    const groups = {}
    flags.forEach((flag) => {
      const team = flag.owner_team ? flag.owner_team.trim() : 'Unassigned'
      if (!groups[team]) {
        groups[team] = {
          name: team,
          flags: []
        }
      }
      groups[team].flags.push(flag)
    })

    // Sort teams: Unassigned at the end, others alphabetically
    return Object.values(groups).sort((a, b) => {
      if (a.name === 'Unassigned') return 1
      if (b.name === 'Unassigned') return -1
      return a.name.localeCompare(b.name)
    })
  }, [flags])

  // Filter teams by search term
  const filteredTeams = useMemo(() => {
    return teamsData.filter(team => 
      team.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [teamsData, searchTerm])

  // Stats calculation
  const stats = useMemo(() => {
    const totalTeams = teamsData.filter(t => t.name !== 'Unassigned').length
    const totalFlagsWithTeam = flags.filter(f => f.owner_team).length
    const maxFlags = teamsData.length > 0 
      ? Math.max(...teamsData.map(t => t.flags.length)) 
      : 0
    return { totalTeams, totalFlagsWithTeam, maxFlags }
  }, [teamsData, flags])

  // Team color palette
  const getTeamTheme = (name) => {
    const lower = name.toLowerCase()
    if (lower.includes('backend'))  return { gradient: 'linear-gradient(135deg, #6366f1, #818cf8)', solid: '#818cf8', bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)' }
    if (lower.includes('frontend')) return { gradient: 'linear-gradient(135deg, #f97316, #fb923c)', solid: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.2)' }
    if (lower.includes('platform')) return { gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)', solid: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.2)' }
    if (lower.includes('security')) return { gradient: 'linear-gradient(135deg, #eab308, #facc15)', solid: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.2)' }
    if (lower.includes('data'))     return { gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', solid: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)' }
    if (lower.includes('infra'))    return { gradient: 'linear-gradient(135deg, #14b8a6, #2dd4bf)', solid: '#14b8a6', bg: 'rgba(20, 184, 166, 0.08)', border: 'rgba(20, 184, 166, 0.2)' }
    if (lower === 'unassigned')     return { gradient: 'linear-gradient(135deg, #71717a, #a1a1aa)', solid: '#71717a', bg: 'rgba(113, 113, 122, 0.08)', border: 'rgba(113, 113, 122, 0.2)' }
    return { gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', solid: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.2)' }
  }

  const getInitials = (name) => {
    return name.split(/[\s_-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 32 }}>
        <h1>Teams</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Management overview of active configuration owner teams and their associated flags in <strong>{selectedEnv.toUpperCase()}</strong>.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 13 }}>Loading teams data...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255, 51, 51, 0.05)', border: '1px solid rgba(255, 51, 51, 0.15)', borderRadius: 6, color: '#ff3333', fontSize: 13 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Error loading teams</strong>
          {error}
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 28 }}>
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="sys-label" style={{ fontSize: 10, letterSpacing: 0.5 }}>ACTIVE TEAMS</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalTeams}</span>
            </div>
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="sys-label" style={{ fontSize: 10, letterSpacing: 0.5 }}>FLAGS OWNED BY TEAMS</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalFlagsWithTeam} <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>of {flags.length}</span></span>
            </div>
            <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="sys-label" style={{ fontSize: 10, letterSpacing: 0.5 }}>MAX FLAGS OWNED BY A TEAM</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.maxFlags}</span>
            </div>
          </div>

          {/* Search Panel */}
          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search teams by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', maxWidth: '360px' }}
            />
          </div>

          {filteredTeams.length === 0 ? (
            <div className="card empty-state">
              <div style={{ fontSize: 32 }}>👥</div>
              <h3>No teams found</h3>
              <p style={{ fontSize: 13, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                Try adjusting your search keywords to locate targeted team cards.
              </p>
            </div>
          ) : (
            /* Teams Grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {filteredTeams.map((team) => {
                const theme = getTeamTheme(team.name)
                const enabledCount = team.flags.filter(f => f.is_enabled).length
                const enabledPct = team.flags.length > 0 ? Math.round((enabledCount / team.flags.length) * 100) : 0

                return (
                  <div
                    key={team.name}
                    style={{
                      position: 'relative',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.25s ease',
                      cursor: 'default'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.border
                      e.currentTarget.style.boxShadow = `0 8px 32px ${theme.bg}, 0 0 0 1px ${theme.border}`
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {/* Accent gradient top bar */}
                    <div style={{ height: 3, background: theme.gradient, width: '100%' }} />

                    {/* Card Header */}
                    <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Team Avatar */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: theme.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#fff',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                        boxShadow: `0 4px 12px ${theme.bg}`
                      }}>
                        {getInitials(team.name)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <h3 style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {team.name}
                          </h3>
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: theme.solid,
                            background: theme.bg,
                            border: `1px solid ${theme.border}`,
                            padding: '2px 10px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {team.flags.length} {team.flags.length === 1 ? 'FLAG' : 'FLAGS'}
                          </span>
                        </div>

                        {/* Active flags progress bar */}
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            flex: 1,
                            height: 4,
                            background: 'var(--border-subtle)',
                            borderRadius: 2,
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${enabledPct}%`,
                              height: '100%',
                              background: theme.gradient,
                              borderRadius: 2,
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}>
                            {enabledCount}/{team.flags.length} active
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 22px' }} />

                    {/* Flags list */}
                    <div style={{ padding: '14px 22px 20px', flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}>
                        {team.flags.map((flag) => (
                          <Link 
                            key={flag.id} 
                            to={`/flags/${flag.flag_key}`} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '8px 12px', 
                              background: 'var(--bg-hover)', 
                              border: '1px solid var(--border-subtle)', 
                              borderRadius: 6,
                              textDecoration: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = theme.border
                              e.currentTarget.style.background = theme.bg
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-subtle)'
                              e.currentTarget.style.background = 'var(--bg-hover)'
                            }}
                          >
                            <code style={{
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 500
                            }}>
                              {flag.flag_key}
                            </code>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: flag.is_enabled ? '#10b981' : '#ef4444',
                                boxShadow: flag.is_enabled
                                  ? '0 0 6px rgba(16, 185, 129, 0.5)'
                                  : '0 0 6px rgba(239, 68, 68, 0.4)',
                                flexShrink: 0
                              }} />
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: flag.is_enabled ? '#10b981' : '#ef4444',
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase'
                              }}>
                                {flag.is_enabled ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Teams
