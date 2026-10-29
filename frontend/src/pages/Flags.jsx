import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import apiClient from '../api/client.js'
import CreateFlagModal from '../components/flags/CreateFlagModal.jsx'
import CleanupSuggestions from '../components/dashboard/CleanupSuggestions.jsx'


function Flags() {
  const outletContext = useOutletContext()
  const selectedEnv = outletContext?.selectedEnv || 'development'
  const navigate = useNavigate()

  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchFlags = () => {
    setLoading(true)
    apiClient
      .get(`/flags?environment=${selectedEnv}`)
      .then((res) => {
        setFlags(res.data || [])
        setError(null)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchFlags()
  }, [selectedEnv])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterType, selectedEnv])

  const handleToggle = (key, currentStatus) => {
    apiClient
      .put(`/flags/${key}?environment=${selectedEnv}`, { is_enabled: !currentStatus })
      .then((res) => {
        setFlags(flags.map(f => f.flag_key === key ? { 
          ...f, 
          is_enabled: res.data.is_enabled,
          rollout_percentage: f.rollout_percentage !== undefined && f.rollout_percentage !== null ? f.rollout_percentage : (res.data.is_enabled ? 100 : 0)
        } : f))
      })
      .catch((err) => {
        alert('Failed to update flag state: ' + (err.response?.data?.detail || err.message))
      })
  }


  const handleCreateFlag = (payload) => {
    apiClient
      .post('/flags', payload)
      .then(() => {
        setIsModalOpen(false)
        fetchFlags()
      })
      .catch((err) => {
        alert('Failed to create flag: ' + (err.response?.data?.detail || err.message))
      })
  }

  const filteredFlags = flags.filter((flag) => {
    if (!flag) return false
    const keyStr = (flag.flag_key || '').toLowerCase()
    const nameStr = (flag.name || '').toLowerCase()
    const ownerStr = (flag.owner_team || '').toLowerCase()
    const descStr = (flag.description || '').toLowerCase()
    const searchLower = (searchTerm || '').toLowerCase()

    const matchesSearch = 
      keyStr.includes(searchLower) ||
      nameStr.includes(searchLower) ||
      ownerStr.includes(searchLower) ||
      descStr.includes(searchLower)
    
    const matchesType = filterType === 'all' || flag.type === filterType

    return matchesSearch && matchesType
  })

  const totalFlagsCount = filteredFlags.length
  const effectivePerPage = itemsPerPage === 'all' ? Math.max(1, totalFlagsCount) : Number(itemsPerPage)
  const totalPages = Math.max(1, Math.ceil(totalFlagsCount / effectivePerPage))
  const startIndex = totalFlagsCount === 0 ? 0 : (currentPage - 1) * effectivePerPage
  const endIndex = Math.min(startIndex + effectivePerPage, totalFlagsCount)

  const paginatedFlags = useMemo(() => {
    return filteredFlags.slice(startIndex, endIndex)
  }, [filteredFlags, startIndex, endIndex])

  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }, [currentPage, totalPages])

  const formatDate = (isoString) => {
    if (!isoString) return 'May 29, 2024'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return isoString
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString
    }
  }

  const getEnvBadge = (envName) => {
    const lower = (envName || 'development').toLowerCase()
    if (lower.includes('prod')) return { label: 'Prod', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)' }
    if (lower.includes('stag')) return { label: 'Staging', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.3)' }
    return { label: 'Dev', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' }
  }

  const envBadge = getEnvBadge(selectedEnv)

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Feature Flags</h1>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '10px'
          }}
        >
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span> Create Flag
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search flags by key, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '36px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)'
            }}
          />
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--text-muted)" 
            strokeWidth="2"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        <select
          className="form-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            minWidth: '150px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            fontWeight: 600
          }}
        >
          <option value="all">All Types</option>
          <option value="boolean">Boolean</option>
          <option value="string">String</option>
          <option value="number">Number</option>
        </select>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 14, fontWeight: 500 }}>Loading feature flags catalog...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '16px 20px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10, color: '#ef4444', fontSize: 13 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Error loading flags</strong>
          {error}
        </div>
      ) : filteredFlags.length === 0 ? (
        <div className="card empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No flags found</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '8px auto 16px', lineHeight: 1.5 }}>
            {searchTerm || filterType !== 'all' 
              ? 'No flags match your search query or type filter. Try adjusting your parameters.' 
              : `No feature flags exist yet in the ${selectedEnv.toUpperCase()} environment.`}
          </p>
          {!searchTerm && filterType === 'all' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              + Create Flag
            </button>
          )}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>FLAG KEY</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>TYPE</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>ENVIRONMENT</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, minWidth: '140px' }}>ROLLOUT</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>OWNER</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600 }}>UPDATED AT</th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {paginatedFlags.map((flag) => {
                  const rolloutPct = flag.rollout_percentage !== undefined && flag.rollout_percentage !== null ? flag.rollout_percentage : (flag.is_enabled ? 100 : 0)
                  const ownerTeam = flag.owner_team || 'Platform Team'


                  return (
                    <tr 
                      key={flag.id}
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Flag Key / Name */}
                      <td style={{ padding: '14px 18px' }}>
                        <div 
                          onClick={() => navigate(`/flags/${flag.flag_key}`)}
                          style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontWeight: 700, 
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.88rem'
                          }}
                        >
                          {flag.flag_key}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {flag.name}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)'
                        }}>
                          {flag.type ? (flag.type.charAt(0).toUpperCase() + flag.type.slice(1)) : 'Boolean'}
                        </span>
                      </td>

                      {/* Status Toggle & Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="switch" style={{ transform: 'scale(0.85)', transformOrigin: 'left center' }}>
                            <input
                              type="checkbox"
                              checked={flag.is_enabled}
                              onChange={() => handleToggle(flag.flag_key, flag.is_enabled)}
                            />
                            <span className="slider"></span>
                          </label>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: flag.is_enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: flag.is_enabled ? '#10b981' : '#ef4444',
                            border: flag.is_enabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                          }}>
                            {flag.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </td>

                      {/* Environment Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          background: envBadge.bg,
                          color: envBadge.color,
                          border: `1px solid ${envBadge.border}`
                        }}>
                          {envBadge.label}
                        </span>
                      </td>

                      {/* Rollout % Progress Bar */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {rolloutPct}%
                          </span>
                          <div style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '3px',
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${rolloutPct}%`,
                              height: '100%',
                              borderRadius: '3px',
                              background: rolloutPct === 100 
                                ? '#10b981' 
                                : rolloutPct > 0 
                                  ? 'linear-gradient(90deg, #6366f1, #8b5cf6)' 
                                  : '#3f3f46',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      </td>

                      {/* Owner Team */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {ownerTeam}
                      </td>

                      {/* Updated At */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {formatDate(flag.updated_at || flag.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => navigate(`/flags/${flag.flag_key}`)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)',
                            padding: '5px 12px',
                            borderRadius: '7px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)'
                            e.currentTarget.style.color = 'var(--primary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-default)'
                            e.currentTarget.style.color = 'var(--text-primary)'
                          }}
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer Row */}
          {!loading && filteredFlags.length > 0 && (
            <div
              style={{
                padding: '14px 18px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.01)',
                flexWrap: 'wrap',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Showing {totalFlagsCount === 0 ? 0 : startIndex + 1} to {endIndex} of {totalFlagsCount} flags
                </div>
              </div>

              {/* Smart Windowed Pagination Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First Page"
                  style={{ padding: '4px 8px', fontSize: 12, opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  «
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  title="Previous Page"
                  style={{ padding: '4px 10px', fontSize: 12, opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  ‹
                </button>

                {paginationRange.map((pageItem, idx) => {
                  if (pageItem === '...') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          userSelect: 'none'
                        }}
                      >
                        ...
                      </span>
                    )
                  }

                  const page = Number(pageItem)
                  return (
                    <button
                      key={page}
                      className="btn"
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        minWidth: 28,
                        fontWeight: currentPage === page ? 700 : 400,
                        background: currentPage === page ? '#2563eb' : 'transparent',
                        color: currentPage === page ? '#ffffff' : 'var(--text-secondary)',
                        border: currentPage === page ? 'none' : '1px solid var(--border-default)'
                      }}
                    >
                      {page}
                    </button>
                  )
                })}

                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  title="Next Page"
                  style={{ padding: '4px 10px', fontSize: 12, opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  ›
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last Page"
                  style={{ padding: '4px 8px', fontSize: 12, opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cleanup Suggestions Panel for Stale Flags */}
      <div style={{ marginTop: 36 }}>
        <CleanupSuggestions />
      </div>

      <CreateFlagModal


        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateFlag}
        currentEnv={selectedEnv}
      />
    </div>
  )
}

export default Flags
