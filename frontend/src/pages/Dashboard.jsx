import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import apiClient from '../api/client.js'

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, LabelList
} from 'recharts'


// Animated KPI Counter for premium microinteraction
function AnimatedCounter({ value, duration = 500 }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = parseInt(value, 10)
    if (isNaN(end) || end === 0) {
      setCount(value)
      return
    }
    
    const totalSteps = 15
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

const formatXAxis = (isoString) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch (e) {
    return isoString
  }
}

const getTeamGradient = (name) => {
  if (!name) return 'url(#teamDefault)'
  const lower = name.toLowerCase()
  if (lower.includes('frontend')) return 'url(#teamFrontend)'
  if (lower.includes('platform')) return 'url(#teamPlatform)'
  if (lower.includes('security')) return 'url(#teamSecurity)'
  if (lower.includes('support')) return 'url(#teamSupport)'
  return 'url(#teamDefault)'
}

function Dashboard() {
  const { selectedEnv } = useOutletContext()
  const navigate = useNavigate()

  const [flags, setFlags] = useState([])
  const [activities, setActivities] = useState([])
  const [logs, setLogs] = useState([])
  const [expandedDays, setExpandedDays] = useState(new Set())
  const [filterHourKey, setFilterHourKey] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      apiClient.get(`/flags?environment=${selectedEnv}`),
      apiClient.get('/audit-logs')
    ])
      .then(([flagsRes, logsRes]) => {
        setFlags(flagsRes.data)
        setActivities(logsRes.data.slice(0, 5))
        setLogs(logsRes.data)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        // Slow down loading slightly to let skeleton animation render nicely
        setTimeout(() => setLoading(false), 300)
      })
  }

  useEffect(() => {
    fetchData()
  }, [selectedEnv])

  useEffect(() => {
    // Listen to sync events from the Navbar
    const handleSync = () => {
      fetchData()
    }
    window.addEventListener('sync-dashboard', handleSync)
    return () => window.removeEventListener('sync-dashboard', handleSync)
  }, [selectedEnv])

  // Process timelineData dynamically (squeeze days with no changes automatically, remove zero-hour & future hours)
  const timelineData = useMemo(() => {
    // Group logs by date string
    const logsByDate = {}
    logs.forEach((log) => {
      if (log.created_at) {
        const d = new Date(log.created_at)
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        if (!logsByDate[dateStr]) logsByDate[dateStr] = []
        logsByDate[dateStr].push(log)
      }
    })

    // Generate last 7 days of timeline
    const chartData = []
    const now = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const dayLogs = logsByDate[dateStr] || []
      
      const isExpanded = expandedDays.has(dateStr) || dayLogs.length > 0

      if (!isExpanded) {
        // Squeezed: only 1 data point representing the entire day
        chartData.push({
          hourKey: d.toISOString(),
          count: 0,
          isSqueezed: true,
          dateStr
        })
      } else {
        // Expanded: plot ONLY hours that had changes and are NOT in the future
        const activeHours = []
        for (let h = 0; h < 24; h++) {
          const hourDate = new Date(d)
          hourDate.setHours(h)
          
          // Remove future hours completely
          if (hourDate.getTime() > now.getTime()) {
            continue
          }
          
          const count = dayLogs.filter((log) => {
            const logDate = new Date(log.created_at)
            return logDate.getHours() === h
          }).length
          
          // Remove hours where no changes occurred
          if (count > 0) {
            activeHours.push({
              hourKey: hourDate.toISOString(),
              count,
              isSqueezed: false,
              dateStr
            })
          }
        }

        if (activeHours.length > 0) {
          chartData.push(...activeHours)
        } else {
          // If expanded day somehow has 0 logs, provide single baseline marker
          chartData.push({
            hourKey: d.toISOString(),
            count: 0,
            isSqueezed: true,
            dateStr
          })
        }
      }
    }
    return chartData
  }, [logs, expandedDays])

  // Extract unique X-axis ticks (one tick per date to avoid duplicates)
  const uniqueTicks = useMemo(() => {
    const ticks = []
    const seenDates = new Set()
    timelineData.forEach((item) => {
      try {
        const d = new Date(item.hourKey)
        if (!isNaN(d.getTime())) {
          const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          if (!seenDates.has(dateStr)) {
            seenDates.add(dateStr)
            ticks.push(item.hourKey)
          }
        }
      } catch (e) {}
    })
    return ticks
  }, [timelineData])

  // Filter activities to display on Recent Operations card
  const filteredActivities = useMemo(() => {
    if (!filterHourKey) {
      return logs.slice(0, 5) // Default top 5
    }

    const clickedPoint = timelineData.find(p => p.hourKey === filterHourKey)
    if (!clickedPoint) return logs.slice(0, 5)

    return logs.filter((log) => {
      if (!log.created_at) return false
      
      const logDate = new Date(log.created_at)
      
      if (clickedPoint.isSqueezed) {
        // Filter by entire date string
        const logDateStr = logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return logDateStr === clickedPoint.dateStr
      } else {
        // Filter by exact hour (using robust timezone-safe string match)
        const filterDate = new Date(filterHourKey)
        const logMatchStr = `${logDate.toLocaleDateString()}_${logDate.getHours()}`
        const filterMatchStr = `${filterDate.toLocaleDateString()}_${filterDate.getHours()}`
        return logMatchStr === filterMatchStr
      }
    })
  }, [logs, filterHourKey, timelineData])

  const flagsCreatedThisWeek = useMemo(() => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    return flags.filter((f) => {
      if (!f.created_at) return false
      return new Date(f.created_at).getTime() >= oneWeekAgo.getTime()
    }).length
  }, [flags])

  const activeFlagsCount = flags.filter(f => f.is_enabled).length
  const inactiveFlagsCount = flags.length - activeFlagsCount
  const totalFlagsCount = flags.length || 1
  const activePercent = Math.round((activeFlagsCount / totalFlagsCount) * 100)
  const inactivePercent = 100 - activePercent

  // Flag Type Distribution Data (Horizontal Bar Chart)
  const booleanCount = flags.filter(f => f.type === 'boolean').length
  const stringCount = flags.filter(f => f.type === 'string').length
  const numberCount = flags.filter(f => f.type === 'number').length

  const typeData = [
    { name: 'Boolean', count: booleanCount },
    { name: 'String', count: stringCount },
    { name: 'Number', count: numberCount }
  ]

  // Flag Ownership Team Data (Vertical Bar Chart)
  const teamsMap = {}
  flags.forEach((f) => {
    const team = f.owner_team || 'Unassigned'
    teamsMap[team] = (teamsMap[team] || 0) + 1
  })
  const ownershipData = Object.entries(teamsMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Visual log details parser for catching visual operations feed
  const parseLogDetails = (log) => {
    const details = log.details || ''
    
    // Extract flag key between single quotes
    const keyMatch = details.match(/'([^']+)'/)
    const flagKey = keyMatch ? keyMatch[1] : 'unknown_flag'
    
    // Detect state/action
    let stateBadge = null
    let logIcon = '●'
    let iconColor = 'var(--text-muted)'
    
    if (log.action === 'flag_created') {
      stateBadge = (
        <span style={{ padding: '2px 6px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px' }} className="sys-label">
          CREATED
        </span>
      )
      logIcon = '＋'
      iconColor = '#38bdf8'
    } else if (log.action === 'flag_deleted') {
      stateBadge = (
        <span style={{ padding: '2px 6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px' }} className="sys-label">
          DELETED
        </span>
      )
      logIcon = '×'
      iconColor = '#ef4444'
    } else {
      // Check if it toggled active or inactive (fixed substring bug where INACTIVE matched ACTIVE)
      const isInactive = details.includes('INACTIVE') || details.includes('disabled')
      if (isInactive) {
        stateBadge = (
          <span style={{ padding: '2px 6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px' }} className="sys-label">
            INACTIVE
          </span>
        )
        logIcon = '▼'
        iconColor = '#ef4444' // Red color for inactive state
      } else {
        stateBadge = (
          <span style={{ padding: '2px 6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px' }} className="sys-label">
            ACTIVE
          </span>
        )
        logIcon = '▲'
        iconColor = 'var(--success)' // Green color for active state
      }
    }

    // Extract environment name
    let envName = 'GLOBAL'
    if (details.includes('in DEVELOPMENT')) envName = 'DEV'
    if (details.includes('in STAGING')) envName = 'STAGE'
    if (details.includes('in PRODUCTION')) envName = 'PROD'

    // Extract clean detail message
    let displayMessage = 'Configuration updated'
    if (details.includes('status changed to')) {
      const parts = details.split(':')
      displayMessage = parts[1] ? parts[1].trim() : details
    } else if (log.action === 'flag_created') {
      displayMessage = 'New flag schema registered'
    } else if (log.action === 'flag_deleted') {
      displayMessage = 'Flag removed from catalog'
    }

    return { flagKey, stateBadge, logIcon, iconColor, envName, displayMessage }
  }

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-zinc-800)', padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            {payload[0].payload.name || payload[0].payload.date}
          </p>
          <p style={{ color: 'var(--primary)', margin: '4px 0 0', fontWeight: 600 }}>
            {payload[0].value} {payload[0].value === 1 ? 'FLAG' : 'FLAGS'}
          </p>
        </div>
      )
    }
    return null
  }

  const TimelineTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { hourKey, count, isSqueezed } = payload[0].payload
      let label = hourKey
      try {
        const d = new Date(hourKey)
        if (!isNaN(d.getTime())) {
          const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          const hourStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          label = isSqueezed ? `${dateStr}` : `${dateStr} ${hourStr}`
        }
      } catch (err) {}

      return (
        <div style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-zinc-800)', padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            {label}
          </p>
          <p style={{ color: 'var(--primary)', margin: '4px 0 0', fontWeight: 600 }}>
            {isSqueezed ? '0 CHANGES' : `${count} ${count === 1 ? 'CHANGE' : 'CHANGES'}`}
          </p>
          {isSqueezed && (
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 10 }}>
              (Click to expand hourly timeline)
            </p>
          )}
          {!isSqueezed && count === 0 && (
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 10 }}>
              (Click to squeeze day)
            </p>
          )}
          {!isSqueezed && count > 0 && (
            <p style={{ color: 'var(--primary)', margin: '4px 0 0', fontSize: 10 }}>
              (Click to filter Recent Operations list)
            </p>
          )}
        </div>
      )
    }
    return null
  }

  // Handle timeline graph clicks (filter operations feed, or toggle squeeze/expansion)
  const handlePointSelect = (clickedPoint) => {
    if (!clickedPoint) return
    
    if (clickedPoint.isSqueezed) {
      // Squeezed: expand the day
      setExpandedDays((prev) => {
        const next = new Set(prev)
        next.add(clickedPoint.dateStr)
        return next
      })
      // Filter operations by the entire day
      setFilterHourKey(clickedPoint.hourKey)
    } else {
      // Hourly point: toggle filtering by this specific hour
      setFilterHourKey(prev => prev === clickedPoint.hourKey ? null : clickedPoint.hourKey)
    }
  }

  const handleChartClick = (data) => {
    // 1. Fallback to activeTooltipIndex if activePayload is empty (robust Recharts tooltip overlay click handling)
    if (data && data.activeTooltipIndex !== undefined) {
      const clickedPoint = timelineData[data.activeTooltipIndex]
      if (clickedPoint) {
        handlePointSelect(clickedPoint)
        return
      }
    }
    
    // 2. Direct activePayload click fallback
    if (data && data.activePayload && data.activePayload.length) {
      handlePointSelect(data.activePayload[0].payload)
    }
  }

  const handleAreaClick = (entry) => {
    if (entry) {
      const point = entry.payload || entry
      handlePointSelect(point)
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Reduced vertical margin gap from 32px to 12px */}
      <div style={{ marginBottom: 12 }}>
        <h1 className="fade-slide-in">Dashboard</h1>
        <p className="sys-label fade-slide-in delay-100" style={{ marginTop: 4 }}>
          Diagnostic analytics and telemetry for the <strong style={{ color: 'var(--primary)' }}>{selectedEnv.toUpperCase()}</strong> environment.
        </p>
      </div>

      {/* KPI Cards section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 32 }}>
        {loading ? (
          <>
            {/* KPI Cards Skeletons */}
            <div className="card skeleton fade-slide-in" style={{ height: '146px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '40%' }}></div>
              <div className="skeleton-text" style={{ width: '25%', height: '28px' }}></div>
              <div className="skeleton-text" style={{ width: '60%' }}></div>
            </div>
            <div className="card skeleton fade-slide-in" style={{ height: '146px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '45%' }}></div>
              <div className="skeleton-text" style={{ width: '20%', height: '28px' }}></div>
              <div className="skeleton-text" style={{ width: '50%' }}></div>
            </div>
            <div className="card skeleton fade-slide-in" style={{ height: '146px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '35%' }}></div>
              <div className="skeleton-text" style={{ width: '25%', height: '28px' }}></div>
              <div className="skeleton-text" style={{ width: '55%' }}></div>
            </div>
          </>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="card card-total fade-slide-in delay-100" style={{ height: '146px', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div>
                <div className="sys-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Total Flags</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1.5px', lineHeight: 1 }}>
                    <AnimatedCounter value={flags.length} />
                  </span>
                  <span style={{ fontSize: 11, color: flagsCreatedThisWeek > 0 ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {flagsCreatedThisWeek > 0 ? `↑ ${flagsCreatedThisWeek}` : '0'} this week
                  </span>
                </div>
              </div>
            </div>

            <div className="card card-active fade-slide-in delay-200" style={{ height: '146px', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="sys-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Active Flags</span>
                  <span className="pulse-dot" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--success)', letterSpacing: '-1.5px', lineHeight: 1 }}>
                    <AnimatedCounter value={activeFlagsCount} />
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    ● {activeFlagsCount} live
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="sys-label" style={{ background: 'rgba(16, 185, 129, 0.02)', padding: '3px 8px', border: '1px solid rgba(16, 185, 129, 0.1)', fontSize: 12, color: 'var(--success)', opacity: 0.65, fontWeight: 700 }}>
                  {activePercent}% ACTIVE
                </span>
              </div>
            </div>

            {/* Inactive Flags card */}
            <div className="card card-inactive fade-slide-in delay-300" style={{ height: '146px', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div>
                <div className="sys-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Inactive Flags</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: '#ef4444', letterSpacing: '-1.5px', lineHeight: 1 }}>
                    <AnimatedCounter value={inactiveFlagsCount} />
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="sys-label" style={{ background: 'rgba(239, 68, 68, 0.02)', padding: '3px 8px', border: '1px solid rgba(239, 68, 68, 0.1)', fontSize: 12, color: '#ef4444', opacity: 0.65, fontWeight: 700 }}>
                  {inactivePercent}% INACTIVE
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Middle Section: Timeline Graph & Recent Operations Side-by-Side */}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, marginBottom: 32, alignItems: 'stretch' }}>

        {loading ? (
          <>
            {/* Timeline & Operations Skeletons */}
            <div className="card skeleton fade-slide-in" style={{ height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '30%' }}></div>
              <div className="skeleton-text" style={{ width: '100%', height: '220px', marginTop: '16px' }}></div>
            </div>
            <div className="card skeleton fade-slide-in" style={{ height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '40%' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: '20px', flex: 1 }}>
                <div className="skeleton-text" style={{ height: '28px' }}></div>
                <div className="skeleton-text" style={{ height: '28px' }}></div>
                <div className="skeleton-text" style={{ height: '28px' }}></div>
                <div className="skeleton-text" style={{ height: '28px' }}></div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Recent Changes Timeline */}
            <div className="card fade-slide-in delay-200" style={{ display: 'flex', flexDirection: 'column', padding: '28px', height: '340px' }}>
              <h2 className="detail-section-title" style={{ fontSize: '13px' }}>Recent Changes Timeline</h2>
              <div style={{ width: '100%', height: 260, marginTop: 'auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timelineData}
                    onClick={handleChartClick}
                    margin={{ top: 10, right: 10, left: -25, bottom: 20 }}
                    style={{ cursor: 'pointer' }}
                  >
                    <defs>
                      <linearGradient id="timelineOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border-zinc-900)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hourKey" ticks={uniqueTicks} tickFormatter={formatXAxis} stroke="#27272a" tick={{ fill: '#a1a1aa' }} fontSize={10} fontFamily="var(--font-mono)" axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis stroke="#27272a" tick={{ fill: '#a1a1aa' }} fontSize={10} fontFamily="var(--font-mono)" axisLine={false} tickLine={false} tickMargin={8} />
                    <Tooltip 
                      content={<TimelineTooltip />} 
                      cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                      offset={16}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="var(--primary)" 
                      fill="url(#timelineOrange)" 
                      strokeWidth={3.5}
                      dot={{ r: 4, stroke: 'var(--primary)', strokeWidth: 1.5, fill: '#09090b', cursor: 'pointer' }}
                      activeDot={{ r: 6, stroke: 'var(--primary)', strokeWidth: 2, fill: '#ffffff', cursor: 'pointer' }}
                      onClick={handleAreaClick}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Operations log list (displays filtered subset on timeline point clicks) */}
            <div className="card fade-slide-in delay-300" style={{ display: 'flex', flexDirection: 'column', padding: '28px', height: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 className="detail-section-title" style={{ fontSize: '13px', margin: 0 }}>Recent Operations</h2>
                {filterHourKey && (
                  <button 
                    onClick={() => setFilterHourKey(null)}
                    style={{
                      background: 'rgba(255, 90, 0, 0.08)',
                      border: '1px solid rgba(255, 90, 0, 0.3)',
                      color: 'var(--primary)',
                      fontSize: '9px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    RESET FILTER
                  </button>
                )}
              </div>

              {/* Reset filter feedback box */}
              {filterHourKey && (
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-zinc-900)', padding: '6px 10px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Showing logs for:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {(() => {
                      const clickedPoint = timelineData.find(p => p.hourKey === filterHourKey)
                      if (!clickedPoint) return ''
                      const d = new Date(filterHourKey)
                      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return clickedPoint.isSqueezed ? dateStr : `${dateStr} ${timeStr}`
                    })()}
                  </strong>
                </div>
              )}

              {filteredActivities.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', gap: 4 }}>
                  <span>NO CHANGES RECORDED FOR THIS TIME.</span>
                  {filterHourKey && (
                    <span style={{ fontSize: 9, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setFilterHourKey(null)}>
                      (click to clear filter)
                    </span>
                  )}
                </div>
              ) : (
                <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                  {filteredActivities.map((log) => {
                    const { flagKey, stateBadge, logIcon, iconColor, envName, displayMessage } = parseLogDetails(log)
                    return (
                      <div 
                        key={log.id} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: 6,
                          padding: '10px 12px', 
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid var(--border-zinc-900)',
                          fontSize: 12,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Line 1: Icon, Key, Badge, Env & Time */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ color: iconColor, fontSize: 16, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                              {logIcon}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '12px' }}>
                              {flagKey}
                            </span>
                            {stateBadge}
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '1px 5px', border: '1px solid var(--border-default)', borderRadius: 3, fontWeight: 700 }}>
                              {envName}
                            </span>
                          </div>
                          
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Line 2: Descriptive Action Message */}
                        <div style={{ paddingLeft: 18 }}>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, textTransform: 'capitalize' }}>
                            {displayMessage.toLowerCase()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Section: Type & Ownership Distribution Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {loading ? (
          <>
            {/* Bottom Skeletons */}
            <div className="card skeleton fade-slide-in" style={{ height: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '40%' }}></div>
              <div className="skeleton-text" style={{ width: '100%', height: '160px', marginTop: '16px' }}></div>
            </div>
            <div className="card skeleton fade-slide-in" style={{ height: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px' }}>
              <div className="skeleton-text" style={{ width: '45%' }}></div>
              <div className="skeleton-text" style={{ width: '100%', height: '160px', marginTop: '16px' }}></div>
            </div>
          </>
        ) : (
          <>
            {/* Horizontal Bar Chart: Type Distribution */}
            <div className="card fade-slide-in delay-300" style={{ minHeight: '280px', padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <h2 className="detail-section-title" style={{ fontSize: '13px', margin: 0 }}>Type Distribution</h2>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>[3 DISTINCT TYPES]</span>
              </div>
              {flags.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '24px 0' }}>No flag data available.</p>
              ) : (
                <div style={{ width: '100%', height: 180, marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={typeData}
                      layout="vertical"
                      margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="booleanGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.95} />
                        </linearGradient>
                        <linearGradient id="stringGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#0284c7" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.95} />
                        </linearGradient>
                        <linearGradient id="numberGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#059669" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border-zinc-900)" horizontal={false} strokeDasharray="2 4" />
                      <XAxis type="number" hide={true} />
                      <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} fontFamily="var(--font-mono)" axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.01)' }} offset={16} />
                      <Bar dataKey="count" radius={[0, 0, 0, 0]} barSize={16}>
                        {typeData.map((entry, index) => {
                          let fillUrl = 'url(#stringGrad)'
                          if (entry.name === 'Boolean') fillUrl = 'url(#booleanGrad)'
                          if (entry.name === 'Number') fillUrl = 'url(#numberGrad)'
                          return <Cell key={`cell-${index}`} fill={fillUrl} />
                        })}
                        <LabelList dataKey="count" position="right" fill="var(--text-primary)" fontSize={11} fontFamily="var(--font-mono)" fontWeight={700} offset={10} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Vertical Bar Chart: Ownership Distribution */}
            <div className="card fade-slide-in delay-400" style={{ minHeight: '280px', padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <h2 className="detail-section-title" style={{ fontSize: '13px', margin: 0 }}>Ownership Distribution</h2>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>[{ownershipData.length} ACTIVE TEAMS]</span>
              </div>
              {flags.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '24px 0' }}>No ownership data available.</p>
              ) : (
                <div style={{ width: '100%', height: 180, marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ownershipData}
                      margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="teamFrontend" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#e03d00" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#ff7a45" stopOpacity={0.95} />
                        </linearGradient>
                        <linearGradient id="teamPlatform" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#0891b2" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.95} />
                        </linearGradient>
                        <linearGradient id="teamSecurity" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#ca8a04" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#eab308" stopOpacity={0.95} />
                        </linearGradient>
                        <linearGradient id="teamSupport" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#6d28d9" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.95} />
                        </linearGradient>
                        <linearGradient id="teamDefault" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="#be185d" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#f472b6" stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border-zinc-900)" vertical={false} strokeDasharray="2 4" />
                      <XAxis dataKey="name" interval={0} stroke="#27272a" tick={{ fill: '#a1a1aa' }} fontSize={9} fontFamily="var(--font-mono)" axisLine={false} tickLine={false} />
                      <YAxis hide={true} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,90,0,0.02)' }} offset={16} />
                      <Bar dataKey="count" radius={[0, 0, 0, 0]} barSize={20}>
                        {ownershipData.map((entry, index) => {
                          const fillUrl = getTeamGradient(entry.name)
                          return <Cell key={`cell-${index}`} fill={fillUrl} />
                        })}
                        <LabelList dataKey="count" position="top" fill="var(--text-primary)" fontSize={11} fontFamily="var(--font-mono)" fontWeight={700} offset={6} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard