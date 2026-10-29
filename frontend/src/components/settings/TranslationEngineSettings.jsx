import { useTranslation } from '../../context/TranslationContext.jsx'

export default function TranslationEngineSettings() {
  const { translationEngine, setTranslationEngine } = useTranslation()

  const isGoogle = translationEngine === 'google_widget'

  return (
    <div className="card" style={{ padding: '28px' }}>
      <h2
        className="detail-section-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          fontSize: '1.1rem'
        }}
      >
        🌍 Translation Engine
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 22 }}>
        Pick how the app translates. Your choice is saved automatically.
      </p>

      {/* Simple Toggle Pill */}
      <div
        style={{
          display: 'inline-flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '12px',
          border: '1px solid var(--border-default)',
          padding: '4px',
          gap: 4
        }}
      >
        <button
          onClick={() => setTranslationEngine('google_widget')}
          style={{
            padding: '10px 22px',
            borderRadius: '9px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.84rem',
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            transition: 'all 0.2s ease',
            background: isGoogle
              ? 'var(--primary)'
              : 'transparent',
            color: isGoogle
              ? '#fff'
              : 'var(--text-muted)',
            boxShadow: isGoogle
              ? '0 2px 12px rgba(255, 87, 34, 0.3)'
              : 'none'
          }}
        >
          🔤 Google Translate
        </button>

        <button
          onClick={() => setTranslationEngine('libretranslate')}
          style={{
            padding: '10px 22px',
            borderRadius: '9px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.84rem',
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            transition: 'all 0.2s ease',
            background: !isGoogle
              ? 'var(--primary)'
              : 'transparent',
            color: !isGoogle
              ? '#fff'
              : 'var(--text-muted)',
            boxShadow: !isGoogle
              ? '0 2px 12px rgba(255, 87, 34, 0.3)'
              : 'none'
          }}
        >
          🌐 LibreTranslate
        </button>
      </div>

      {/* One-liner hint */}
      <p style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 14, marginBottom: 0 }}>
        {isGoogle
          ? '⚡ Fast, free, zero-setup — uses the Google widget in the navbar.'
          : '🔒 Private & offline — requires Docker. Configure the server below.'}
      </p>
    </div>
  )
}
