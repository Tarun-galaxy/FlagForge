import { useState, useEffect, useRef } from 'react'
import EnvironmentSwitcher from './EnvironmentSwitcher.jsx'
import LanguageSelector from './LanguageSelector.jsx'
import GoogleTranslateWidget from './GoogleTranslateWidget.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'

import apiClient from '../../api/client.js'

function Navbar({ selectedEnv, onEnvChange, onToggleSidebar }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [lastSync, setLastSync] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
  const [syncing, setSyncing] = useState(false)
  const [backendOnline, setBackendOnline] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light')
    } else {
      document.documentElement.classList.remove('theme-light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const checkHealth = () => {
    apiClient.get('/health')
      .then((res) => {
        setBackendOnline(res.data && res.data.status === 'ok')
      })
      .catch(() => setBackendOnline(false))
  }

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 8000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSyncClick = () => {
    setSyncing(true)
    checkHealth()
    setTimeout(() => {
      setLastSync(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
      setSyncing(false)
      window.dispatchEvent(new CustomEvent('sync-dashboard'))
    }, 600)
  }

  const userInitial = (user?.full_name || user?.email || 'U')[0].toUpperCase()

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onToggleSidebar} className="navbar-icon-btn" title="Toggle Navigation Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="navbar-title">FlagForge</div>
      </div>

      <div className="navbar-actions">
        {/* Sync */}
        <div className="navbar-group">
          <span className="sys-label navbar-sync-label">SYNCED: {lastSync}</span>
          <button onClick={handleSyncClick} disabled={syncing} className="navbar-icon-btn" title="Sync Data">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: syncing ? 'spin 0.6s linear infinite' : 'none' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>

        {/* Backend Status */}
        <div className="navbar-group">
          <span className="pulse-dot" style={{
            backgroundColor: backendOnline ? 'var(--success)' : '#ff3333',
            boxShadow: backendOnline ? '0 0 8px var(--success)' : '0 0 8px #ff3333',
            animation: backendOnline ? 'pulseGreen 2s infinite' : 'pulseRed 2s infinite'
          }} />
          <span className="sys-label" style={{ fontSize: 11, color: backendOnline ? 'var(--success)' : '#ff3333', fontWeight: 700 }}>
            {backendOnline ? 'API: ONLINE' : 'API: OFFLINE'}
          </span>
        </div>

        {/* Environment Switcher */}
        <EnvironmentSwitcher selectedEnv={selectedEnv} onChange={onEnvChange} />

        {/* Theme Change Switch - Icon Only */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          {theme === 'dark' ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* LibreTranslate Language Selector */}
        <LanguageSelector />

        {/* Google Translate Widget */}
        <GoogleTranslateWidget />

        {/* User Profile (Far Right) */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button onClick={() => setProfileOpen(!profileOpen)} className="navbar-profile-btn"
            style={{ background: profileOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="navbar-avatar" />
            ) : (
              <div className="navbar-avatar-fallback">{userInitial}</div>
            )}
            <span className="navbar-profile-name">
              {user?.full_name || user?.email?.split('@')[0] || 'Profile'}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {profileOpen && (
            <div className="navbar-dropdown">
              {/* User info */}
              <div className="navbar-dropdown-header">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div className="navbar-avatar-fallback" style={{ width: 36, height: 36, fontSize: 14 }}>{userInitial}</div>
                )}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.full_name || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="navbar-dropdown-section">
                <button className="navbar-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/settings') }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Settings
                </button>
              </div>

              {/* Logout */}
              <div className="navbar-dropdown-section">
                <button className="navbar-dropdown-item navbar-dropdown-danger" onClick={() => { setProfileOpen(false); logout() }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>

  )
}

export default Navbar