import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/layout/Layout.jsx'

import LandingPage from '../pages/LandingPage.jsx'
import OAuthCallback from '../pages/OAuthCallback.jsx'
import Dashboard from '../pages/Dashboard.jsx'
import Flags from '../pages/Flags.jsx'
import FlagDetail from '../pages/FlagDetail.jsx'
import Environments from '../pages/Environments.jsx'
import AuditLog from '../pages/AuditLog.jsx'
import Settings from '../pages/Settings.jsx'
import Teams from '../pages/Teams.jsx'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-mono)',
        gap: 12
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid rgba(255, 87, 34, 0.2)',
          borderTop: '2px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '2px' }}>
          LOADING SESSION...
        </span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        {/* Landing & Auth Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="flags" element={<Flags />} />
          <Route path="flags/:key" element={<FlagDetail />} />
          <Route path="teams" element={<Teams />} />
          <Route path="environments" element={<Environments />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default AppRoutes