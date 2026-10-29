import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

function Sidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth()

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div
        className="sidebar-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          width: '100%',
          paddingLeft: isCollapsed ? 0 : 4,
          paddingRight: isCollapsed ? 0 : 4
        }}
      >
        <h2
          className="sys-label sidebar-brand"
          onClick={onToggle}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: 0,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'opacity 0.2s ease'
          }}
        >
          <svg width={isCollapsed ? "22" : "18"} height={isCollapsed ? "22" : "18"} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="var(--primary)" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          {!isCollapsed && <span>FLAGFORGE</span>}
        </h2>
      </div>
      
      <nav>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')} title="Dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
          </svg>
          <span className="sidebar-link-text">Dashboard</span>
        </NavLink>
        <NavLink to="/flags" className={({ isActive }) => (isActive ? 'active' : '')} title="Feature Flags">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <span className="sidebar-link-text">Feature Flags</span>
        </NavLink>
        <NavLink to="/teams" className={({ isActive }) => (isActive ? 'active' : '')} title="Teams">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="sidebar-link-text">Teams</span>
        </NavLink>
        <NavLink to="/environments" className={({ isActive }) => (isActive ? 'active' : '')} title="Environments">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
          </svg>
          <span className="sidebar-link-text">Environments</span>
        </NavLink>
        <NavLink to="/audit-log" className={({ isActive }) => (isActive ? 'active' : '')} title="Audit Log">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="sidebar-link-text">Audit Log</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')} title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="sidebar-link-text">Settings</span>
        </NavLink>

      </nav>

      {/* User + Logout at bottom */}
      <div className="sidebar-footer">
        {user && !isCollapsed && (
          <div className="sidebar-user-info">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            ) : (
              <div className="navbar-avatar-fallback" style={{ width: 28, height: 28, fontSize: 11 }}>
                {(user.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user.full_name || user.email}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user.provider} Auth
              </div>
            </div>
          </div>
        )}

        {!isCollapsed ? (
          <button onClick={logout} className="sidebar-logout-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            LOGOUT
          </button>
        ) : (
          <button onClick={logout} title="Logout" className="sidebar-logout-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  )
}

export default Sidebar