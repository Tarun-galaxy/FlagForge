import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function OAuthCallback() {
  const { provider } = useParams()
  const navigate = useNavigate()
  const { handleOAuthCallback } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (!code) {
      setError('No authorization code received.')
      return
    }

    const redirectUri = `${window.location.origin}/auth/callback/${provider}`
    handleOAuthCallback(provider, code, redirectUri)
      .then(() => {
        navigate('/dashboard')
      })
      .catch((err) => {
        console.error('OAuth callback error:', err)
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Authentication failed. Please try again.')
      })
  }, [])

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        gap: 16
      }}>
        <div style={{ color: '#ef4444', fontSize: 14 }}>⚠ {error}</div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 20px',
            background: 'var(--primary)',
            color: '#000',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.5px'
          }}
        >
          BACK TO HOME
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      fontSize: 13,
      letterSpacing: '1px'
    }}>
      AUTHENTICATING...
    </div>
  )
}

export default OAuthCallback
