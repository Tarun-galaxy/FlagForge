import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const GOOGLE_CLIENT_ID = '476869353697-2jn3l4noaf5niu37af7c676bqa1vpe26.apps.googleusercontent.com'
const GITHUB_CLIENT_ID = 'Ov23li5TSWLsjJwx1ido'
const REDIRECT_BASE = typeof window !== 'undefined' && window.location?.origin
  ? `${window.location.origin}/auth/callback`
  : 'http://localhost:5173/auth/callback'

function LandingPage() {
  const navigate = useNavigate()
  const { user, loginWithEmail, registerWithEmail, isAuthenticated } = useAuth()

  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSocialLogin = (provider) => {
    setError('')
    if (provider === 'google') {
      const redirectUri = `${REDIRECT_BASE}/google`
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile`
    } else if (provider === 'github') {
      const redirectUri = `${REDIRECT_BASE}/github`
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) return

    setLoading(true)
    try {
      if (authMode === 'login') {
        await loginWithEmail(email, password)
      } else {
        await registerWithEmail(email, password, fullName)
      }
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      {/* Ambient background effects */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-grid-overlay" />

      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="landing-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="#000" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <div>
              <span className="landing-logo-name">FlagForge</span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#architecture">Architecture</a>
          </nav>

          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <button className="landing-btn-primary" onClick={() => navigate('/dashboard')}>
                Open Console →
              </button>
            ) : (
              <>
                <button className="landing-btn-ghost" onClick={() => { setAuthMode('login'); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }) }}>
                  Sign In
                </button>
                <button className="landing-btn-primary" onClick={() => { setAuthMode('register'); document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }) }}>
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className={`landing-hero-content ${mounted ? 'animate-in' : ''}`}>
          <div className="landing-hero-badge">
            <span className="pulse-dot" />
            <span>FEATURE FLAG MANAGEMENT PLATFORM</span>
          </div>

          <h1 className="landing-hero-title">
            Ship Features with
            <br />
            <span className="landing-gradient-text">Precision Control</span>
          </h1>

          <p className="landing-hero-desc">
            Toggle production features in real-time, execute targeted rollouts,
            manage environment pipelines, and maintain immutable audit trails —
            all without redeploying code.
          </p>

          {/* Metrics bar */}
          <div className="landing-metrics">
            <div className="landing-metric">
              <span className="landing-metric-value">&lt; 1ms</span>
              <span className="landing-metric-label">Evaluation Latency</span>
            </div>
            <div className="landing-metric-divider" />
            <div className="landing-metric">
              <span className="landing-metric-value">100%</span>
              <span className="landing-metric-label">Auditable Ledger</span>
            </div>
            <div className="landing-metric-divider" />
            <div className="landing-metric">
              <span className="landing-metric-value">3 Envs</span>
              <span className="landing-metric-label">Pipeline Support</span>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div id="auth-section" className={`landing-auth-card-wrapper ${mounted ? 'animate-in delay-200' : ''}`}>
          <div className="landing-auth-glow" />
          <div className="landing-auth-card">
            {/* Card header */}
            <div className="landing-auth-header">
              <div className="landing-auth-header-left">
                <div className="landing-auth-dot" />
                <span>AUTHENTICATION</span>
              </div>
              <span className="landing-auth-secure-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                SECURE
              </span>
            </div>

            {isAuthenticated ? (
              <div className="landing-auth-authenticated">
                <div className="landing-auth-check">✓</div>
                <p className="landing-auth-check-text">Session Active</p>
                <p className="landing-auth-check-email">{user?.email}</p>
                <button className="landing-auth-submit" onClick={() => navigate('/dashboard')}>
                  OPEN CONSOLE →
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="landing-auth-tabs">
                  <button
                    className={`landing-auth-tab ${authMode === 'login' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('login'); setError('') }}
                  >
                    SIGN IN
                  </button>
                  <button
                    className={`landing-auth-tab ${authMode === 'register' ? 'active' : ''}`}
                    onClick={() => { setAuthMode('register'); setError('') }}
                  >
                    CREATE ACCOUNT
                  </button>
                </div>

                {error && (
                  <div className="landing-auth-error">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Social Buttons */}
                <div className="landing-auth-social">
                  <button className="landing-social-btn" onClick={() => handleSocialLogin('google')} disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Google
                  </button>
                  <button className="landing-social-btn" onClick={() => handleSocialLogin('github')} disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                </div>

                <div className="landing-auth-divider">
                  <span>OR CONTINUE WITH EMAIL</span>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="landing-auth-form">
                  {authMode === 'register' && (
                    <div className="landing-field">
                      <label>Full Name</label>
                      <input type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                  )}
                  <div className="landing-field">
                    <label>Email Address</label>
                    <input type="email" placeholder="developer@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="landing-field">
                    <label>Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ paddingRight: '42px', width: '100%' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'transparent',
                          border: 'none',
                          color: showPassword ? 'var(--primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          transition: 'color 0.2s ease',
                          zIndex: 2
                        }}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="landing-auth-submit" disabled={loading}>
                    {loading
                      ? 'AUTHENTICATING...'
                      : authMode === 'login'
                        ? 'SIGN IN →'
                        : 'CREATE ACCOUNT →'
                    }
                  </button>
                </form>

                <div className="landing-auth-footer-info">
                  <span>🔒 256-BIT ENCRYPTED</span>
                  <span>•</span>
                  <span>OAUTH 2.0</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <span className="landing-section-tag">CORE CAPABILITIES</span>
          <h2>Everything for Release Control</h2>
          <p>Built for engineering teams who demand predictability, speed, and safety.</p>
        </div>

        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>Dynamic Feature Switches</h3>
            <p>Turn features on or off instantly across Development, Staging, and Production without code redeployments.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
              </svg>
            </div>
            <h3>Targeted Rollouts</h3>
            <p>Release to specific percentage thresholds, user email domains, or custom audience segments with precision.</p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>Immutable Audit Logs</h3>
            <p>Full governance compliance with detailed activity tracking for every flag creation, change, and rule update.</p>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="landing-arch">
        <div className="landing-section-header">
          <span className="landing-section-tag">SYSTEM ARCHITECTURE</span>
          <h2>Built for Performance</h2>
          <p>Production-grade infrastructure designed for sub-millisecond evaluation.</p>
        </div>

        <div className="landing-arch-grid">
          <div className="landing-arch-item">
            <span className="landing-arch-label">BACKEND</span>
            <span className="landing-arch-value">FastAPI + SQLite</span>
          </div>
          <div className="landing-arch-item">
            <span className="landing-arch-label">FRONTEND</span>
            <span className="landing-arch-value">React 18 + Vite</span>
          </div>
          <div className="landing-arch-item">
            <span className="landing-arch-label">CACHE</span>
            <span className="landing-arch-value">Redis (Optional)</span>
          </div>
          <div className="landing-arch-item">
            <span className="landing-arch-label">AUTH</span>
            <span className="landing-arch-value">JWT + OAuth 2.0</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-logo" style={{ gap: 10 }}>
            <div className="landing-logo-mark" style={{ width: 28, height: 28 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="#000" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <span className="landing-logo-name" style={{ fontSize: '1rem' }}>FlagForge</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-ghost)' }}>
            © 2026 FlagForge Systems • All Rights Reserved
          </span>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
