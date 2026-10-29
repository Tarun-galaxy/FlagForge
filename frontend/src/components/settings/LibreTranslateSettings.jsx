import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/TranslationContext.jsx'

export default function LibreTranslateSettings() {
  const {
    serverUrl,
    setServerUrl,
    apiKey,
    setApiKey,
    connectionStatus,
    testConnection
  } = useTranslation()

  const [inputUrl, setInputUrl] = useState(serverUrl)
  const [inputKey, setInputKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState(connectionStatus)

  useEffect(() => {
    setInputUrl(serverUrl)
    setInputKey(apiKey)
  }, [serverUrl, apiKey])

  const handleSaveAndTest = async () => {
    setTesting(true)
    setServerUrl(inputUrl)
    setApiKey(inputKey)
    const result = await testConnection(inputUrl, inputKey)
    setStatus(result)
    setTesting(false)
  }

  const handleApplyPreset = (presetUrl) => {
    setInputUrl(presetUrl)
  }

  const copyDockerCmd = () => {
    navigator.clipboard.writeText('docker run -p 5000:5000 libretranslate/libretranslate')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="detail-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '1.1rem' }}>
          🌐 LibreTranslate API & Local Server
        </h2>
        {status.tested && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: '12px',
            background: status.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: status.success ? '#10b981' : '#ef4444',
            border: status.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            fontFamily: 'var(--font-mono)'
          }}>
            {status.success ? 'ONLINE & CONNECTED' : 'SERVER DISCONNECTED'}
          </span>
        )}
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 20 }}>
        Configure LibreTranslate for open-source translation. Use a local Docker container (`http://localhost:5000`) for 100% free offline translation, or connect to a public mirror or cloud API key.
      </p>

      {/* Presets */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
          Quick Connection Presets
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleApplyPreset('http://localhost:5000')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: inputUrl === 'http://localhost:5000' ? '1px solid var(--primary)' : '1px solid var(--border-default)',
              background: inputUrl === 'http://localhost:5000' ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🐳 Docker Local (http://localhost:5000)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('https://translate.argosopentech.com')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: inputUrl === 'https://translate.argosopentech.com' ? '1px solid var(--primary)' : '1px solid var(--border-default)',
              background: inputUrl === 'https://translate.argosopentech.com' ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🌍 Argos Public Mirror (Free)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('https://libretranslate.com')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: inputUrl === 'https://libretranslate.com' ? '1px solid var(--primary)' : '1px solid var(--border-default)',
              background: inputUrl === 'https://libretranslate.com' ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ☁️ Official Cloud (Requires Key)
          </button>
        </div>
      </div>

      {/* Form Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            Server Endpoint URL
          </label>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://localhost:5000"
            className="input-field"
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
            API Key (Optional)
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Leave blank for local Docker or public mirror"
              className="input-field"
              style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            Not required when running Docker locally on <code>http://localhost:5000</code>.
          </span>
        </div>

        {/* Action button & status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={testing}
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700 }}
          >
            {testing ? 'Testing Connection...' : 'Save & Test Connection'}
          </button>
        </div>

        {status.tested && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: status.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: status.success ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.82rem',
              color: status.success ? '#10b981' : '#ef4444'
            }}
          >
            {status.message}
          </div>
        )}
      </div>

      {/* Docker Command Box */}
      <div style={{ marginTop: 24, padding: '16px', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            🐳 How to run LibreTranslate locally via Docker
          </span>
          <button
            type="button"
            onClick={copyDockerCmd}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: copied ? 'var(--success)' : 'var(--bg-input)',
              color: '#ffffff',
              border: '1px solid var(--border-default)',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {copied ? 'Copied!' : 'Copy Command'}
          </button>
        </div>
        <pre style={{
          margin: 0,
          padding: '10px 14px',
          borderRadius: '6px',
          background: '#09090b',
          color: '#38bdf8',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          overflowX: 'auto'
        }}>
          docker run -p 5000:5000 libretranslate/libretranslate
        </pre>
      </div>
    </div>
  )
}
