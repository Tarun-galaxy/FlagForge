import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client.js'

function AnimatedCounter({ value, duration = 400 }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = parseInt(value, 10)
    if (isNaN(end) || end === 0) {
      setCount(value || 0)
      return
    }
    const totalSteps = 12
    const stepTime = Math.floor(duration / totalSteps)
    const increment = Math.ceil(end / totalSteps)

    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(start)
      }
    }, stepTime)

    return () => clearInterval(timer)
  }, [value, duration])

  return <>{count}</>
}

export default function CleanupSuggestions() {
  const navigate = useNavigate()
  const [thresholdDays, setThresholdDays] = useState(0)
  const [candidates, setCandidates] = useState([])
  const [summary, setSummary] = useState({
    total_candidates: 0,
    fully_rolled_out: 0,
    fully_disabled: 0,
    reviewed_count: 0
  })
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'ROLLED_OUT', 'DISABLED', 'REVIEWED', 'UNREVIEWED'
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [actionLoadingKey, setActionLoadingKey] = useState(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType, thresholdDays])

  const fetchCandidates = (days = thresholdDays, triggerScan = true) => {
    if (triggerScan) setEvaluating(true)
    else setLoading(true)

    const endpoint = triggerScan ? `/cleanup/evaluate?threshold_days=${days}` : `/cleanup/candidates?threshold_days=${days}`
    const method = triggerScan ? apiClient.post : apiClient.get

    method(endpoint)
      .then((res) => {
        const data = res.data
        setCandidates(data.candidates || [])
        setSummary({
          total_candidates: data.total_candidates || 0,
          fully_rolled_out: data.fully_rolled_out || 0,
          fully_disabled: data.fully_disabled || 0,
          reviewed_count: data.reviewed_count || 0
        })
      })
      .catch((err) => {
        console.error('Failed to load cleanup candidates:', err)
        showNotification('Error refreshing cleanup candidates', 'danger')
      })
      .finally(() => {
        setLoading(false)
        setEvaluating(false)
      })
  }

  useEffect(() => {
    fetchCandidates(thresholdDays, true)
  }, [thresholdDays])

  const showNotification = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleToggleReview = (flagKey, currentReviewed) => {
    setActionLoadingKey(flagKey)
    const targetState = !currentReviewed

    apiClient.post(`/cleanup/candidates/${flagKey}/review`, { reviewed: targetState })
      .then((res) => {
        const updated = res.data
        setCandidates(prev => prev.map(item => item.flag_key === flagKey ? updated : item))
        setSummary(prev => ({
          ...prev,
          reviewed_count: targetState ? prev.reviewed_count + 1 : Math.max(0, prev.reviewed_count - 1)
        }))
        showNotification(
          targetState ? `Flag '${flagKey}' marked as reviewed` : `Flag '${flagKey}' marked as unreviewed`,
          targetState ? 'success' : 'info'
        )
      })
      .catch((err) => {
        console.error(`Failed to review flag ${flagKey}:`, err)
        showNotification(`Failed to update review status for ${flagKey}`, 'danger')
      })
      .finally(() => {
        setActionLoadingKey(null)
      })
  }

  const handleDeleteFlag = (flagKey) => {
    if (!window.confirm(`Are you sure you want to permanently delete flag '${flagKey}' from all environments?`)) return

    setActionLoadingKey(flagKey)
    apiClient.delete(`/flags/${flagKey}`)
      .then(() => {
        showNotification(`Flag '${flagKey}' deleted successfully`)
        fetchCandidates(thresholdDays, true)
      })
      .catch((err) => {
        console.error(`Failed to delete flag ${flagKey}:`, err)
        showNotification(`Failed to delete flag ${flagKey}`, 'danger')
      })
      .finally(() => {
        setActionLoadingKey(null)
      })
  }


  const filteredCandidates = useMemo(() => {
    return candidates.filter((item) => {
      const matchesSearch = item.flag_key.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (!matchesSearch) return false

      if (filterType === 'ROLLED_OUT') return item.status_type === 'ROLLED_OUT'
      if (filterType === 'DISABLED') return item.status_type === 'DISABLED'
      if (filterType === 'REVIEWED') return item.reviewed === true
      if (filterType === 'UNREVIEWED') return item.reviewed === false

      return true
    })
  }, [candidates, searchQuery, filterType])

  const totalCandidates = filteredCandidates.length
  const effectivePerPage = itemsPerPage === 'all' ? Math.max(1, totalCandidates) : Number(itemsPerPage)
  const totalPages = Math.max(1, Math.ceil(totalCandidates / effectivePerPage))
  const startIndex = totalCandidates === 0 ? 0 : (currentPage - 1) * effectivePerPage
  const endIndex = Math.min(startIndex + effectivePerPage, totalCandidates)

  const paginatedCandidates = useMemo(() => {
    return filteredCandidates.slice(startIndex, endIndex)
  }, [filteredCandidates, startIndex, endIndex])

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
    if (!isoString) return 'N/A'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return isoString
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString
    }
  }

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return isoString
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: '16px',
      border: '1px solid var(--border-default)',
      padding: '24px',
      marginBottom: '32px',
      boxShadow: 'var(--shadow-md)',
      position: 'relative'
    }}>

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(255, 87, 34, 0.12)',
            border: '1px solid rgba(255, 87, 34, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Cleanup Suggestions
              </h2>
              <div 
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                {showTooltip && (
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '280px',
                    background: '#18181c',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                    zIndex: 50,
                    boxShadow: 'var(--shadow-lg)'
                  }}>
                    Flags that are fully rolled out (100%) or fully disabled across all environments for more than {thresholdDays} days. Review and remove safely.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={thresholdDays}
              onChange={(e) => setThresholdDays(Number(e.target.value))}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={0}>0 Days (All Candidates)</option>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>

          </div>

          <button
            onClick={() => fetchCandidates(thresholdDays, true)}
            disabled={evaluating || loading}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: evaluating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5"
              style={{
                animation: evaluating ? 'spin 1s linear infinite' : 'none'
              }}
            >
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            {evaluating ? 'Scanning...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Card 1: Total Candidates */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(255, 87, 34, 0.1)',
            border: '1px solid rgba(255, 87, 34, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Total Candidates
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: '2px' }}>
              <AnimatedCounter value={summary.total_candidates} />
            </div>
          </div>
        </div>

        {/* Card 2: Fully Rolled Out */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Fully Rolled Out
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1, marginTop: '2px' }}>
              <AnimatedCounter value={summary.fully_rolled_out} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-ghost)', marginTop: '2px' }}>100% in all envs</div>
          </div>
        </div>

        {/* Card 3: Fully Disabled */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Fully Disabled
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1, marginTop: '2px' }}>
              <AnimatedCounter value={summary.fully_disabled} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-ghost)', marginTop: '2px' }}>Disabled in all envs</div>
          </div>
        </div>

        {/* Card 4: Reviewed */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Reviewed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#818cf8', lineHeight: 1.1, marginTop: '2px' }}>
              <AnimatedCounter value={summary.reviewed_count} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-ghost)', marginTop: '2px' }}>Marked as reviewed</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'ROLLED_OUT', label: 'Rolled Out' },
            { id: 'DISABLED', label: 'Disabled' },
            { id: 'UNREVIEWED', label: 'Pending Review' },
            { id: 'REVIEWED', label: 'Reviewed' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setFilterType(tab.id); setCurrentPage(1); }}
              style={{
                background: filterType === tab.id ? 'var(--primary)' : 'transparent',
                color: filterType === tab.id ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', width: '220px' }}>
          <input
            type="text"
            placeholder="Filter flag key..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              padding: '6px 12px 6px 30px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--text-muted)" 
            strokeWidth="2"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>FLAG KEY</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS TYPE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATE SINCE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>DAYS IN STATE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>ENVIRONMENTS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>LAST EVALUATED</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>REVIEWED</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M23 4v6h-6M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                    <span>Evaluating candidates...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedCandidates.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '1.8rem' }}>🎉</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No candidate flags match this criteria</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      All feature flags are active or under the {thresholdDays}-day threshold.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCandidates.map((item) => {
                const isRolledOut = item.status_type === 'ROLLED_OUT'
                const envKeys = item.environment_states ? Object.keys(item.environment_states) : ['prod', 'staging', 'dev']

                return (
                  <tr 
                    key={item.flag_key} 
                    style={{ 
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                      opacity: item.reviewed ? 0.75 : 1
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Flag Key */}
                    <td style={{ padding: '14px 16px' }}>
                      <span 
                        onClick={() => navigate(`/flags/${item.flag_key}`)}
                        style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontWeight: 600, 
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textDecorationColor: 'transparent',
                          transition: 'text-decoration-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecorationColor = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecorationColor = 'transparent'}
                      >
                        {item.flag_key}
                      </span>
                    </td>

                    {/* Status Type Badge */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        background: isRolledOut ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isRolledOut ? '#10b981' : '#ef4444',
                        border: isRolledOut ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                      }}>
                        {isRolledOut ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            ROLLED OUT
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            DISABLED
                          </>
                        )}
                      </span>
                    </td>

                    {/* State Since */}
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                      {formatDate(item.since_date)}
                    </td>

                    {/* Days in State */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}>
                        {item.days_in_state} days
                      </span>
                    </td>

                    {/* Environment Badges */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {envKeys.map(env => (
                          <span key={env} style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            textTransform: 'capitalize'
                          }}>
                            {env}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Last Evaluated */}
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {formatDateTime(item.last_evaluated_at)}
                    </td>

                    {/* Reviewed Status */}
                    <td style={{ padding: '14px 16px' }}>
                      {item.reviewed ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#10b981',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          background: 'rgba(16, 185, 129, 0.08)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          Reviewed
                        </span>
                      ) : (
                        <span style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.78rem',
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleToggleReview(item.flag_key, item.reviewed)}
                          disabled={actionLoadingKey === item.flag_key}
                          style={{
                            background: item.reviewed ? 'rgba(255,255,255,0.05)' : 'rgba(255, 87, 34, 0.1)',
                            color: item.reviewed ? 'var(--text-secondary)' : 'var(--primary)',
                            border: item.reviewed ? '1px solid var(--border-subtle)' : '1px solid rgba(255, 87, 34, 0.3)',
                            padding: '6px 12px',
                            borderRadius: '7px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {actionLoadingKey === item.flag_key ? (
                            <span>Updating...</span>
                          ) : item.reviewed ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                              Reviewed
                            </>
                          ) : (
                            'Mark Reviewed'
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteFlag(item.flag_key)}
                          disabled={actionLoadingKey === item.flag_key}
                          title="Permanently delete candidate flag"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '6px 10px',
                            borderRadius: '7px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          Delete
                        </button>
                      </div>
                    </td>

                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Row */}
      {!loading && filteredCandidates.length > 0 && (
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.01)',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Showing {totalCandidates === 0 ? 0 : startIndex + 1} to {endIndex} of {totalCandidates} candidates
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



      {/* Sleek Bottom Toast Notification matching Opposite Theme (White on Dark / Black on Light) */}
      {toastMessage && (
        <div
          className="toast-notification-opposite"
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            borderRadius: '12px',
            padding: '10px 20px',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'toastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <span
            className={`toast-icon-${toastMessage.type || 'success'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              fontSize: 12,
              fontWeight: 800
            }}
          >
            {toastMessage.type === 'danger' ? '✕' : toastMessage.type === 'info' ? 'ℹ' : '✓'}
          </span>
          <span className="toast-text" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '0.2px' }}>
            {toastMessage.text}
          </span>
          <button
            className="toast-dismiss"
            onClick={() => setToastMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 16,
              cursor: 'pointer',
              marginLeft: 8,
              lineHeight: 1,
              padding: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Keyframe animation for spinner & bottom toast */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes toastSlideUp {
          from {
            transform: translate(-50%, 24px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
