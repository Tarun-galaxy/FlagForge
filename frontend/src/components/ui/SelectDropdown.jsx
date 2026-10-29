import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function SelectDropdown({ value, onChange, options, placeholder = 'Select...' }) {
  // options: [{ value: string, label: string }]
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedOption = options.find(o => o.value === value)
  const displayLabel = selectedOption ? selectedOption.label : placeholder

  const updatePosition = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      let left = rect.left + window.scrollX
      if (dropdownRef.current) {
        const dropWidth = dropdownRef.current.offsetWidth
        if (left + dropWidth > window.innerWidth - 16) {
          left = Math.max(16, window.innerWidth - dropWidth - 16 + window.scrollX)
        }
      }
      setDropdownPos({
        top: rect.bottom + 4 + window.scrollY,
        left,
        width: Math.max(rect.width, 160)
      })
    }
  }

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      const timer = setTimeout(updatePosition, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClick = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleScroll = () => updatePosition()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen])

  const handleSelect = (val) => {
    onChange(val)
    setIsOpen(false)
  }

  const dropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="no-scrollbar"
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        minWidth: Math.max(dropdownPos.width, 240),
        width: 'max-content',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 99999,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-zinc-800)',
        borderRadius: 8,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'datepickerSlideIn 0.15s ease-out',
        overflow: 'hidden',
        maxHeight: 280,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            onClick={() => handleSelect(opt.value)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 14px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--primary-subtle)' : 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.1s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            {/* Check indicator */}
            <span style={{
              width: 14,
              fontSize: 11,
              color: isActive ? 'var(--primary)' : 'transparent',
              flexShrink: 0,
            }}>
              ✓
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>,
    document.body
  ) : null

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        type="button"
        title={displayLabel}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          height: 36,
          padding: '0 10px 0 12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-zinc-800)',
          borderRadius: 6,
          color: value && value !== 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          minWidth: 110,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary)'
          e.currentTarget.style.boxShadow = '0 0 0 1px var(--primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-zinc-800)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {dropdown}
    </div>
  )
}
