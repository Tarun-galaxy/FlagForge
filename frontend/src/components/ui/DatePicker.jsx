import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}
function formatDate(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function DatePicker({ value, onChange, placeholder = 'Select date' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewMode, setViewMode] = useState('days') // 'days' | 'months' | 'years'
  const [yearRangeStart, setYearRangeStart] = useState(Math.floor(new Date().getFullYear() / 12) * 12)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedDate = parseDate(value)

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear())
      setViewMonth(selectedDate.getMonth())
    }
  }, [value])

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 6 + window.scrollY, left: rect.left + window.scrollX })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClick = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
        setViewMode('days')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleScroll = () => {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        setDropdownPos({ top: rect.bottom + 6 + window.scrollY, left: rect.left + window.scrollX })
      }
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen])

  const handleSelectDay = useCallback((day) => {
    onChange(formatDate(new Date(viewYear, viewMonth, day)))
    setIsOpen(false)
    setViewMode('days')
  }, [viewYear, viewMonth, onChange])

  const handleSelectMonth = useCallback((monthIdx) => {
    setViewMonth(monthIdx)
    setViewMode('days')
  }, [])

  const handleSelectYear = useCallback((year) => {
    setViewYear(year)
    setYearRangeStart(Math.floor(year / 12) * 12)
    setViewMode('months')
  }, [])

  const handleClear = useCallback(() => { onChange(''); setIsOpen(false); setViewMode('days') }, [onChange])
  const handleToday = useCallback(() => {
    const now = new Date()
    onChange(formatDate(now))
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setIsOpen(false)
    setViewMode('days')
  }, [onChange])

  // Nav handlers per mode
  const handlePrev = useCallback(() => {
    if (viewMode === 'days') {
      setViewMonth(prev => { if (prev === 0) { setViewYear(y => y - 1); return 11 } return prev - 1 })
    } else if (viewMode === 'months') {
      setViewYear(y => y - 1)
    } else {
      setYearRangeStart(s => s - 12)
    }
  }, [viewMode])

  const handleNext = useCallback(() => {
    if (viewMode === 'days') {
      setViewMonth(prev => { if (prev === 11) { setViewYear(y => y + 1); return 0 } return prev + 1 })
    } else if (viewMode === 'months') {
      setViewYear(y => y + 1)
    } else {
      setYearRangeStart(s => s + 12)
    }
  }, [viewMode])

  const handleHeaderClick = useCallback(() => {
    if (viewMode === 'days') setViewMode('months')
    else if (viewMode === 'months') { setYearRangeStart(Math.floor(viewYear / 12) * 12); setViewMode('years') }
  }, [viewMode, viewYear])

  // Build day grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1)
  const today = new Date()
  const todayStr = formatDate(today)

  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, current: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true })
  const rem = 42 - cells.length
  for (let i = 1; i <= rem; i++) cells.push({ day: i, current: false })

  const displayValue = selectedDate
    ? `${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : ''

  // Header title per mode
  const headerTitle = viewMode === 'days'
    ? `${MONTH_FULL[viewMonth]} ${viewYear}`
    : viewMode === 'months'
      ? `${viewYear}`
      : `${yearRangeStart} – ${yearRangeStart + 11}`

  const navBtnStyle = {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'transparent',
    color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.12s',
  }

  const gridCellStyle = (isActive, isCurrentHighlight) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '10px 0', fontSize: 12, fontWeight: isActive ? 700 : 500,
    fontFamily: 'var(--font-mono)', borderRadius: 8, cursor: 'pointer',
    transition: 'all 0.12s ease', border: 'none',
    background: isActive ? 'var(--primary)' : 'transparent',
    color: isActive ? '#fff' : isCurrentHighlight ? 'var(--primary)' : 'var(--text-secondary)',
  })

  const calendarDropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute', top: dropdownPos.top, left: dropdownPos.left,
        zIndex: 99999, width: 280, background: 'var(--bg-elevated)',
        border: '1px solid var(--border-zinc-800)', borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'datepickerSlideIn 0.18s ease-out', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button type="button" onClick={handlePrev} style={navBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <button
          type="button"
          onClick={handleHeaderClick}
          style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.3px',
            background: 'transparent', border: 'none', cursor: viewMode !== 'years' ? 'pointer' : 'default',
            padding: '4px 10px', borderRadius: 6, transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { if (viewMode !== 'years') e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {headerTitle}
        </button>

        <button type="button" onClick={handleNext} style={navBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* === DAYS VIEW === */}
      {viewMode === 'days' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 10px 4px' }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0', userSelect: 'none' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '2px 10px 8px', gap: 2 }}>
            {cells.map((cell, idx) => {
              const cellDateStr = cell.current ? formatDate(new Date(viewYear, viewMonth, cell.day)) : ''
              const isSelected = cell.current && value === cellDateStr
              const isToday = cell.current && cellDateStr === todayStr
              return (
                <button key={idx} type="button" disabled={!cell.current} onClick={() => cell.current && handleSelectDay(cell.day)}
                  style={{
                    width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: isSelected ? 700 : isToday ? 600 : 400, fontFamily: 'var(--font-mono)',
                    border: isToday && !isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                    borderRadius: 8, cursor: cell.current ? 'pointer' : 'default', transition: 'all 0.12s ease',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    color: isSelected ? '#fff' : !cell.current ? 'var(--text-muted)' : isToday ? 'var(--primary)' : 'var(--text-secondary)',
                    opacity: cell.current ? 1 : 0.3,
                  }}
                  onMouseEnter={(e) => { if (cell.current && !isSelected) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                  onMouseLeave={(e) => { if (cell.current && !isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isToday ? 'var(--primary)' : 'var(--text-secondary)' } }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* === MONTHS VIEW === */}
      {viewMode === 'months' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '12px 10px', gap: 6 }}>
          {MONTH_NAMES.map((m, idx) => {
            const isActive = idx === viewMonth && viewYear === (selectedDate ? selectedDate.getFullYear() : -1) && idx === (selectedDate ? selectedDate.getMonth() : -1)
            const isCurrent = idx === today.getMonth() && viewYear === today.getFullYear()
            return (
              <button key={m} type="button" onClick={() => handleSelectMonth(idx)}
                style={gridCellStyle(isActive, isCurrent)}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isCurrent ? 'var(--primary)' : 'var(--text-secondary)' } }}
              >
                {m}
              </button>
            )
          })}
        </div>
      )}

      {/* === YEARS VIEW === */}
      {viewMode === 'years' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '12px 10px', gap: 6 }}>
          {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(yr => {
            const isActive = selectedDate && yr === selectedDate.getFullYear()
            const isCurrent = yr === today.getFullYear()
            return (
              <button key={yr} type="button" onClick={() => handleSelectYear(yr)}
                style={gridCellStyle(isActive, isCurrent)}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isCurrent ? 'var(--primary)' : 'var(--text-secondary)' } }}
              >
                {yr}
              </button>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 12px', borderTop: '1px solid var(--border-subtle)' }}>
        <button type="button" onClick={handleClear}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, transition: 'all 0.12s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
        >Clear</button>
        <button type="button" onClick={handleToday}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-subtle)', border: '1px solid var(--primary-glow)', cursor: 'pointer', padding: '4px 12px', borderRadius: 6, transition: 'all 0.12s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-glow)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary-subtle)' }}
        >Today</button>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button ref={btnRef} type="button" onClick={() => { setIsOpen(!isOpen); setViewMode('days') }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px',
          background: 'var(--bg-input)', border: '1px solid var(--border-zinc-800)', borderRadius: 6,
          color: displayValue ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', outline: 'none',
          transition: 'all 0.15s ease', whiteSpace: 'nowrap', minWidth: 130,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-zinc-800)'; e.currentTarget.style.boxShadow = 'none' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{displayValue || placeholder}</span>
      </button>
      {calendarDropdown}
    </div>
  )
}
