import { useEffect, useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import apiClient from '../api/client.js'
import DatePicker from '../components/ui/DatePicker.jsx'
import SelectDropdown from '../components/ui/SelectDropdown.jsx'

function AuditLog() {
  const context = useOutletContext()
  const selectedEnv = context?.selectedEnv || 'all'

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Compute dynamic initial date strings for current date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }, [])

  // Filters State - Default to empty ("All Time") so all generated logs are retrieved
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')
  const [selectedFlag, setSelectedFlag] = useState('all')
  const [selectedActor, setSelectedActor] = useState('all')
  const [selectedEnvFilter, setSelectedEnvFilter] = useState(selectedEnv)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (selectedEnv) {
      setSelectedEnvFilter(selectedEnv)
    }
  }, [selectedEnv])


  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [logsPerPage, setLogsPerPage] = useState(10) // Options: 10, 25, 50, 100, 'all'

  // Selected Log for Diff Modal
  const [diffModalLog, setDiffModalLog] = useState(null)

  const fetchLogs = () => {
    setLoading(true)
    const params = {}
    if (selectedActor && selectedActor !== 'all') params.actor = selectedActor
    if (selectedFlag && selectedFlag !== 'all') params.flag_key = selectedFlag
    if (selectedEnvFilter && selectedEnvFilter !== 'all') params.environment = selectedEnvFilter
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate

    apiClient
      .get('/audit-logs', { params })
      .then((res) => {
        setLogs(res.data)
        setError(null)
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const [platformUsers, setPlatformUsers] = useState([])

  const fetchUsers = () => {
    apiClient
      .get('/api/auth/users')
      .then((res) => {
        setPlatformUsers(res.data || [])
      })
      .catch((err) => {
        console.error('Failed to fetch platform users:', err)
      })
  }

  useEffect(() => {
    fetchLogs()
    fetchUsers()
  }, [selectedEnvFilter, startDate, endDate, selectedAction, selectedFlag, selectedActor])


  // Create lookup map of email/id to user profile
  const userMap = useMemo(() => {
    const map = {}
    platformUsers.forEach((u) => {
      if (u.email) map[u.email.toLowerCase()] = u
    })
    return map
  }, [platformUsers])

  // Parse log fields for UI representation
  const processedLogs = useMemo(() => {
    return logs.map((log) => {
      const details = log.details || ''

      // Extract flag key from log attribute, details, or fallback
      let flagKey = log.flag_key || 'system'
      if (!log.flag_key) {
        const keyMatch = details.match(/['"]([^'"]+)['"]/)
        if (keyMatch) {
          flagKey = keyMatch[1]
        } else {
          const words = details.split(' ')
          const flagWord = words.find((w) => w.includes('_') || w.toLowerCase().includes('flag'))
          if (flagWord) {
            flagKey = flagWord.replace(/[^a-zA-Z0-9_]/g, '')
          }
        }
      }

      // Determine action type badge category
      let actionType = 'UPDATE'
      const act = (log.action || '').toUpperCase()
      const det = details.toUpperCase()

      if (act.includes('CREATE') || det.includes('CREATED')) {
        actionType = 'CREATE'
      } else if (act.includes('DELETE') || det.includes('DELETED')) {
        actionType = 'DELETE'
      } else if (act.includes('ENABLE') || det.includes('ENABLED') || det.includes('ACTIVE')) {
        actionType = 'ENABLE'
      } else if (
        act.includes('TARGETING') ||
        det.includes('TARGETING') ||
        det.includes('ROLLOUT') ||
        det.includes('WHITELIST') ||
        det.includes('GROUPS') ||
        (log.previous_state && ('whitelist' in log.previous_state || 'percentage' in log.previous_state || 'groups' in log.previous_state))
      ) {
        actionType = 'TARGETING'
      } else {
        actionType = 'UPDATE'
      }

      // Extract environment name
      let envName = (log.environment || '').toUpperCase()
      if (!envName || envName === 'NULL') {
        const envMatch = details.match(/in\s+(['"]?[A-Z_]+['"]?)/i)
        envName = envMatch ? envMatch[1].replace(/['"]/g, '').toUpperCase() : 'DEVELOPMENT'
      }

      // Clean redundant prefixes from details
      let cleanDetails = details
        .replace(/^Flag\s+['"][^'"]+['"]\s+targeting\s+rules\s+updated\s+in\s+[A-Z_]+\.\s*/i, '')
        .replace(/^Flag\s+['"][^'"]+['"]\s+configuration\s+updated\s+in\s+[A-Z_]+:\s*/i, '')
        .replace(/^Flag\s+['"][^'"]+['"]\s+of\s+type\s+['"][^'"]+['"]\s+created\s+in\s+[A-Z_]+\s*\(default:\s*[^)]+\)/i, 'Created')
        .replace(/^Flag\s+['"][^'"]+['"]\s+permanently\s+deleted\s+from\s+all\s+environments/i, 'Permanently deleted')

      // Format clean timestamp
      let formattedTime = 'N/A'
      if (log.created_at) {
        const d = new Date(log.created_at)
        if (!isNaN(d.getTime())) {
          const dateStr = d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
          const timeStr = d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })
          formattedTime = `${dateStr}, ${timeStr}`
        }
      }

      // Extract actor details and resolve user profile
      const rawActor = log.actor || 'admin@flagforge.com'
      const lowerActor = rawActor.toLowerCase()
      const matchedUser = userMap[lowerActor]

      let actorDisplayName = 'Admin'
      let actorEmail = rawActor

      if (matchedUser) {
        actorDisplayName = matchedUser.full_name || matchedUser.email.split('@')[0]
        actorEmail = matchedUser.email
      } else if (lowerActor.includes('admin')) {
        actorDisplayName = 'Admin'
        actorEmail = rawActor.includes('@') ? rawActor : 'admin@flagforge.com'
      } else if (rawActor.includes('@')) {
        actorDisplayName = rawActor.split('@')[0]
        actorEmail = rawActor
      } else {
        actorDisplayName = rawActor
      }

      const initial = actorDisplayName.charAt(0).toUpperCase()

      return {
        ...log,
        flagKey,
        envName,
        cleanDetails,
        actionType,
        formattedTime,
        actorName: rawActor,
        actorDisplayName,
        actorEmail,
        initial
      }
    })
  }, [logs, userMap])

  const [allFlagsList, setAllFlagsList] = useState([])

  // Fetch all flags from system on mount so the dropdown always has complete flag list
  useEffect(() => {
    apiClient
      .get('/flags')
      .then((res) => {
        if (Array.isArray(res.data)) {
          const keys = res.data.map((f) => f.flag_key || f.key).filter(Boolean)
          setAllFlagsList((prev) => Array.from(new Set([...prev, ...keys])).sort())
        }
      })
      .catch((err) => {
        console.error('Failed to fetch flags list:', err)
      })
  }, [])

  // Accumulate all flags seen in logs into allFlagsList state
  useEffect(() => {
    if (processedLogs.length > 0) {
      const keysFromLogs = processedLogs.map((l) => l.flagKey).filter((k) => k && k !== 'system')
      if (keysFromLogs.length > 0) {
        setAllFlagsList((prev) => Array.from(new Set([...prev, ...keysFromLogs])).sort())
      }
    }
  }, [processedLogs])

  // Extract unique platform users for dropdown filter (shows Name only)
  const actorDropdownOptions = useMemo(() => {
    const optionsMap = new Map()

    // Add registered/signed-in platform users first
    platformUsers.forEach((u) => {
      const email = u.email
      const name = u.full_name || u.email.split('@')[0]
      if (email && !optionsMap.has(email)) {
        optionsMap.set(email, { name, email })
      }
    })

    // Include any active log actors not in users table
    processedLogs.forEach((l) => {
      const email = l.actorEmail || l.actorName
      const name = l.actorDisplayName || email
      if (email && !optionsMap.has(email)) {
        optionsMap.set(email, { name, email })
      }
    })

    return Array.from(optionsMap.values())
  }, [platformUsers, processedLogs])

  // Extract unique environments for dropdown (always includes dev, staging, prod)
  const uniqueEnvironments = useMemo(() => {
    const set = new Set(['development', 'staging', 'production'])
    processedLogs.forEach((l) => {
      if (l.envName) set.add(l.envName.toLowerCase())
    })
    return Array.from(set)
  }, [processedLogs])

  // Apply filtering rules
  const filteredLogs = useMemo(() => {
    return processedLogs.filter((log) => {
      // Date Range Filter
      if (log.created_at) {
        const logTime = new Date(log.created_at).getTime()
        if (startDate) {
          const startMs = new Date(startDate).setHours(0, 0, 0, 0)
          if (logTime < startMs) return false
        }
        if (endDate) {
          const endMs = new Date(endDate).setHours(23, 59, 59, 999)
          if (logTime > endMs) return false
        }
      }

      // Environment filter
      if (selectedEnvFilter && selectedEnvFilter !== 'all') {
        const targetEnv = selectedEnvFilter.toLowerCase()
        const logEnv = (log.envName || '').toLowerCase()
        if (logEnv !== targetEnv && !logEnv.includes(targetEnv) && !targetEnv.includes(logEnv)) {
          return false
        }
      }

      // Action filter
      if (selectedAction !== 'all' && log.actionType !== selectedAction) {
        return false
      }
      // Flag filter
      if (selectedFlag !== 'all' && log.flagKey !== selectedFlag) {
        return false
      }
      // Actor filter (matching by email, display name, or actor name)
      if (selectedActor && selectedActor !== 'all') {
        const sel = selectedActor.toLowerCase()
        const isMatch =
          (log.actorEmail || '').toLowerCase() === sel ||
          (log.actorName || '').toLowerCase() === sel ||
          (log.actorDisplayName || '').toLowerCase() === sel
        if (!isMatch) return false
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const match =
          log.flagKey.toLowerCase().includes(term) ||
          log.actorDisplayName.toLowerCase().includes(term) ||
          log.actorEmail.toLowerCase().includes(term) ||
          (log.details && log.details.toLowerCase().includes(term))
        if (!match) return false
      }
      return true
    })
  }, [processedLogs, startDate, endDate, selectedAction, selectedFlag, selectedActor, searchTerm])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedAction, selectedFlag, selectedActor, searchTerm, startDate, endDate, logsPerPage])

  // Pagination calculation
  const totalLogs = filteredLogs.length
  const effectivePerPage = logsPerPage === 'all' ? Math.max(1, totalLogs) : Number(logsPerPage)
  const totalPages = Math.max(1, Math.ceil(totalLogs / effectivePerPage))
  const startIndex = totalLogs === 0 ? 0 : (currentPage - 1) * effectivePerPage
  const endIndex = Math.min(startIndex + effectivePerPage, totalLogs)
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

  // Smart Pagination Range generator (windowed pagination for large log sets)
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

  // Badge styling lookup
  const getBadgeStyle = (type) => {
    switch (type) {
      case 'CREATE':
        return { background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }
      case 'ENABLE':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }
      case 'TARGETING':
        return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }
      case 'DELETE':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }
      case 'UPDATE':
      default:
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }
    }
  }

  // Precise Event Parser: Standardizes JSON schema (enabled, rollout_percentage, target_groups, whitelist_users) to match reference design
  const getDiffData = (log) => {
    if (!log) return { before: {}, after: {}, summary: [], changedKeys: new Set() }

    const parseList = (val) => {
      if (Array.isArray(val)) return val
      if (typeof val === 'string' && val.trim()) return val.split(',').map((s) => s.trim()).filter(Boolean)
      return []
    }

    const parseNum = (val) => {
      if (val !== undefined && val !== null && val !== '') {
        const n = Number(val)
        return isNaN(n) ? 0 : n
      }
      return 0
    }

    const prev = log.previous_state || {}
    const curr = log.new_state || {}

    // Build standardized JSON objects matching reference image structure
    const before = {
      enabled: prev.is_enabled ?? prev.enabled ?? false,
      rollout_percentage: parseNum(prev.percentage ?? prev.rollout_percentage ?? 0),
      target_groups: parseList(prev.groups ?? prev.target_groups),
      whitelist_users: parseList(prev.whitelist ?? prev.whitelist_users)
    }

    const after = {
      enabled: curr.is_enabled ?? curr.enabled ?? false,
      rollout_percentage: parseNum(curr.percentage ?? curr.rollout_percentage ?? 0),
      target_groups: parseList(curr.groups ?? curr.target_groups),
      whitelist_users: parseList(curr.whitelist ?? curr.whitelist_users)
    }

    const summary = []
    const changedKeys = new Set()

    Object.keys(after).forEach((key) => {
      const bVal = before[key]
      const aVal = after[key]
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        changedKeys.add(key)
        let type = 'add'
        if (Array.isArray(aVal) && Array.isArray(bVal)) {
          type = aVal.length >= bVal.length ? 'add' : 'remove'
        } else if (typeof aVal === 'boolean') {
          type = aVal ? 'add' : 'remove'
        } else if (typeof aVal === 'number') {
          type = aVal >= bVal ? 'add' : 'remove'
        }
        summary.push({
          key,
          from: bVal,
          to: aVal,
          type
        })
      }
    })

    return { before, after, summary, changedKeys }
  }

  // Syntax Highlighted JSON Renderer matching dark project theme
  const renderHighlightedJson = (obj, changedKeys, isAfter) => {
    const jsonStr = JSON.stringify(obj, null, 2)
    if (!jsonStr) return null

    const lines = jsonStr.split('\n')

    return (
      <div style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '1.65', color: 'var(--text-primary)' }}>
        {lines.map((line, idx) => {
          let isLineChanged = false

          changedKeys.forEach((k) => {
            if (line.includes(`"${k}":`) || line.includes(`"${k}"`)) {
              isLineChanged = true
            }
          })

          const parts = line.split(':')
          if (parts.length >= 2) {
            const keyPart = parts[0]
            const valPart = parts.slice(1).join(':')

            return (
              <div key={idx} style={{ display: 'flex' }}>
                <span style={{ color: '#f4f4f5', fontWeight: 600 }}>{keyPart}:</span>
                <span
                  style={{
                    color: isLineChanged ? (isAfter ? '#34d399' : '#f87171') : '#a1a1aa',
                    fontWeight: isLineChanged ? 700 : 400,
                    marginLeft: 6
                  }}
                >
                  {valPart}
                </span>
              </div>
            )
          }

          // Array items or brackets
          const isArrayValLine = !line.includes('{') && !line.includes('}') && !line.includes('[') && !line.includes(']')
          return (
            <div
              key={idx}
              style={{
                color: isArrayValLine ? (isAfter ? '#34d399' : '#f87171') : '#a1a1aa',
                fontWeight: isArrayValLine ? 700 : 400
              }}
            >
              {line}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40, animation: 'fadeIn 0.3s ease-out' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Audit Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, margin: 0 }}>
            View all changes made in your project.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchLogs}
          style={{
            height: 36,
            padding: '0 16px',
            fontSize: 12,
            border: '1px solid #52525b',
            background: '#18181b',
            color: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
          }}
        >
          <span>↺</span> Refresh
        </button>
      </div>

      {/* Minimalistic & Well-Spaced Filter Toolbar Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          gap: 12,
          border: '1px solid var(--border-zinc-800)',
          borderRadius: 8
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          {/* Custom Date Range Picker */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Start Date"
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12, userSelect: 'none' }}>➔</span>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="End Date"
            />
          </div>

          {/* Action Filter Dropdown */}
          <SelectDropdown
            value={selectedAction}
            onChange={setSelectedAction}
            placeholder="All Actions"
            options={[
              { value: 'all', label: 'All Actions' },
              { value: 'UPDATE', label: 'UPDATE' },
              { value: 'CREATE', label: 'CREATE' },
              { value: 'ENABLE', label: 'ENABLE' },
              { value: 'TARGETING', label: 'TARGETING' },
              { value: 'DELETE', label: 'DELETE' },
            ]}
          />

          {/* Actor Filter Dropdown */}
          <SelectDropdown
            value={selectedActor}
            onChange={setSelectedActor}
            placeholder="All Actors"
            options={[
              { value: 'all', label: 'All Actors' },
              ...actorDropdownOptions.map(opt => ({ value: opt.email, label: `${opt.name} (${opt.email})` }))
            ]}
          />

          {/* Flag Filter Dropdown */}
          <SelectDropdown
            value={selectedFlag}
            onChange={setSelectedFlag}
            placeholder="All Flags"
            options={[
              { value: 'all', label: 'All Flags' },
              ...allFlagsList.map(flag => ({ value: flag, label: flag }))
            ]}
          />

          {/* Environment Filter Dropdown */}
          <SelectDropdown
            value={selectedEnvFilter}
            onChange={setSelectedEnvFilter}
            placeholder="All Environments"
            options={[
              { value: 'all', label: 'All Environments' },
              ...uniqueEnvironments.map(env => ({ value: env, label: env.toUpperCase() }))
            ]}
          />


          {/* Search Term Input */}
          <input
            type="text"
            placeholder="Search actor, details, or flag key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              height: 36,
              padding: '0 12px',
              fontSize: 12,
              borderRadius: 6,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-zinc-800)',
              color: 'var(--text-primary)',
              outline: 'none',
              minWidth: 200,
              flex: 1
            }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {}}
          style={{ height: 36, padding: '0 20px', fontSize: 12 }}
        >
          Filter
        </button>
      </div>

      {/* Main Table Viewer Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-zinc-800)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: 13 }}>Loading audit history...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '32px 24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, margin: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 20, color: '#f87171' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#f87171', fontSize: 14, fontWeight: 600 }}>
                  Error Loading Audit Logs
                </h4>
                <p style={{ margin: '0 0 12px 0', color: '#a1a1aa', fontSize: 13, lineHeight: 1.5 }}>
                  {error.includes('Network Error')
                    ? 'Unable to connect to the backend server at http://localhost:8000. Please ensure the Python FastAPI backend service is running and accessible.'
                    : error}
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={fetchLogs}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    fontSize: 12,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                >
                  ↻ Retry Connection
                </button>
              </div>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <p style={{ fontSize: 13, margin: 0 }}>No audit logs match your filter criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-zinc-800)', color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>TIMESTAMP</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>ACTOR</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>FLAG</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>ENVIRONMENT</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>TYPE</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>DETAILS</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>DIFF</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => {
                  const badgeStyle = getBadgeStyle(log.actionType)
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-zinc-800)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Timestamp Column */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {log.formattedTime}
                      </td>

                      {/* Actor Column */}
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-primary)'
                            }}
                          >
                            {log.initial}
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
                              {log.actorDisplayName}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                              {log.actorEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Flag Column */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#38bdf8' }}>
                        {log.flagKey}
                      </td>

                      {/* Environment Column */}
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',

                            textTransform: 'uppercase'
                          }}
                        >
                          {log.envName}
                        </span>
                      </td>

                      {/* Action Type Column */}
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.4px',
                            ...badgeStyle
                          }}
                        >
                          {log.actionType}
                        </span>
                      </td>

                      {/* Details Column */}
                      <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: 12, maxWidth: 320, lineHeight: 1.4 }}>
                        {log.cleanDetails}
                      </td>

                      {/* Diff Button Column */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setDiffModalLog(log)}
                          style={{ padding: '6px 12px', fontSize: 11 }}
                        >
                          View Diff
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer Row */}
        {!loading && filteredLogs.length > 0 && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-zinc-800)',
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
                Showing {totalLogs === 0 ? 0 : startIndex + 1} to {endIndex} of {totalLogs} logs
              </div>

              {/* Per-Page Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Per page:</span>
                <select
                  value={logsPerPage}
                  onChange={(e) => setLogsPerPage(e.target.value)}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    fontSize: 12,
                    borderRadius: 4,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-zinc-800)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            {/* Smart Windowed Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* First Page Button */}
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First Page"
                style={{ padding: '4px 8px', fontSize: 12, opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                «
              </button>

              {/* Previous Page Button */}
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Previous Page"
                style={{ padding: '4px 10px', fontSize: 12, opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                ‹
              </button>

              {/* Page Number Buttons with Ellipses Truncation */}
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
                      border: currentPage === page ? 'none' : '1px solid var(--border-zinc-800)'
                    }}
                  >
                    {page}
                  </button>
                )
              })}

              {/* Next Page Button */}
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Next Page"
                style={{ padding: '4px 10px', fontSize: 12, opacity: currentPage === totalPages ? 0.4 : 1 }}
              >
                ›
              </button>

              {/* Last Page Button */}
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

      {/* 3-Column Change Diff Modal matching Project Dark Theme */}
      {diffModalLog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
            backdropFilter: 'blur(6px)'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 1080,
              background: '#09090b',
              color: 'var(--text-primary)',
              borderRadius: 16,
              border: '1px solid var(--border-zinc-800)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                padding: '20px 28px',
                borderBottom: '1px solid var(--border-zinc-800)',
                background: 'rgba(255, 255, 255, 0.02)'
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                Change Diff – <span style={{ color: '#38bdf8' }}>{diffModalLog.flagKey}</span>{' '}
                <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 600 }}>({diffModalLog.actionType})</span>
              </h3>
              <button
                onClick={() => setDiffModalLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: 3 Equal Columns */}
            {(() => {
              const { before, after, summary, changedKeys } = getDiffData(diffModalLog)
              return (
                <div
                  style={{
                    padding: 24,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 20,
                    overflowY: 'auto',
                    background: '#0c0c0e',
                    flex: 1
                  }}
                >
                  {/* Column 1: Before */}
                  <div
                    style={{
                      background: 'rgba(18, 18, 22, 0.8)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 18px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        fontSize: 14,
                        fontWeight: 700,
                        borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      Before
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {renderHighlightedJson(before, changedKeys, false)}
                    </div>
                  </div>

                  {/* Column 2: After */}
                  <div
                    style={{
                      background: 'rgba(18, 18, 22, 0.8)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 18px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#34d399',
                        fontSize: 14,
                        fontWeight: 700,
                        borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      After
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {renderHighlightedJson(after, changedKeys, true)}
                    </div>
                  </div>

                  {/* Column 3: Summary of Changes */}
                  <div
                    style={{
                      background: 'rgba(18, 18, 22, 0.8)',
                      border: '1px solid var(--border-zinc-800)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 18px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border-zinc-800)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      Summary of Changes
                    </div>
                    <div
                      style={{
                        padding: '18px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        overflowY: 'auto',
                        flex: 1
                      }}
                    >
                      {summary.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No changes detected.
                        </div>
                      ) : (
                        summary.map((item, idx) => {
                          const isScalar = typeof item.from !== 'object' && typeof item.to !== 'object'
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                              {/* Icon: Minus for scalar/remove, Plus for add/array */}
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: item.type === 'add' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: item.type === 'add' ? '#34d399' : '#f87171',
                                  border: item.type === 'add' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  marginTop: 2,
                                  flexShrink: 0
                                }}
                              >
                                {item.type === 'add' ? '+' : '−'}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'hidden' }}>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                                  {item.key}:
                                  {isScalar && (
                                    <span style={{ fontWeight: 500, marginLeft: 6 }}>
                                      <span style={{ color: '#f87171' }}>{String(item.from)}</span>
                                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>➔</span>
                                      <span style={{ color: '#34d399' }}>{String(item.to)}</span>
                                    </span>
                                  )}
                                </div>

                                {!isScalar && (
                                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <div style={{ color: '#f87171' }}>{JSON.stringify(item.from)}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399' }}>
                                      <span style={{ color: 'var(--text-muted)' }}>➔</span>
                                      <span>{JSON.stringify(item.to)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 28px',
                background: '#09090b',
                borderTop: '1px solid var(--border-zinc-800)',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() => setDiffModalLog(null)}
                style={{
                  height: 36,
                  padding: '0 24px',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLog
