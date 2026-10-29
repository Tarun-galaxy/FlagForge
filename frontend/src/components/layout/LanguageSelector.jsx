import { useTranslation } from '../../context/TranslationContext.jsx'

export default function LanguageSelector() {
  const { translationEngine, targetLang, setTargetLang, supportedLanguages } = useTranslation()

  // Hide this custom selector when Google Widget is active (it has its own UI)
  if (translationEngine === 'google_widget') return null

  return (
    <div className="language-selector-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '14px', lineHeight: 1 }} title="Select Application Language">🌐</span>
      <select
        value={targetLang}
        onChange={(e) => setTargetLang(e.target.value)}
        className="language-selector-dropdown"
        style={{
          background: 'var(--bg-input, rgba(255, 255, 255, 0.05))',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
          borderRadius: '8px',
          padding: '6px 10px',
          fontSize: '0.82rem',
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          height: '36px'
        }}
      >
        {supportedLanguages.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            style={{ background: '#1e1e2d', color: '#ffffff' }}
          >
            {lang.flag} {lang.name} ({lang.code.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  )
}
