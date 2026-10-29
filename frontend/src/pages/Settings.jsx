import { useState, useEffect } from 'react'
import TranslationEngineSettings from '../components/settings/TranslationEngineSettings.jsx'
import LibreTranslateSettings from '../components/settings/LibreTranslateSettings.jsx'
import { useTranslation } from '../context/TranslationContext.jsx'

function Settings() {
  const [theme, setTheme] = useState('dark')
  const { translationEngine } = useTranslation()

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
  }, [])

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'light') {
      document.documentElement.classList.add('theme-light')
    } else {
      document.documentElement.classList.remove('theme-light')
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', position: 'relative' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Manage your interface theme and translation engine settings.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: '820px' }}>
        
        {/* Section 1: Interface Customization (Theme) */}
        <div className="card" style={{ padding: '28px' }}>
          <h2 className="detail-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '1.1rem' }}>
            🎨 Interface Customization
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 20 }}>
            Choose how FlagForge is presented on your screen. The active theme is persisted locally.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {/* Dark Mode Card */}
            <div 
              onClick={() => handleThemeChange('dark')}
              style={{
                padding: '18px',
                background: '#09090b',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: theme === 'dark' ? 'var(--primary)' : 'var(--border-zinc-800)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {theme === 'dark' && (
                <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Dark Mode (Default)</span>
              <span style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>
                Low light comfort, high-contrast orange accents, sleek dark dashboard layout.
              </span>
            </div>

            {/* Light Mode Card */}
            <div 
              onClick={() => handleThemeChange('light')}
              style={{
                padding: '18px',
                background: '#f4f4f5',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: theme === 'light' ? 'var(--primary)' : 'var(--border-zinc-900)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {theme === 'light' && (
                <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: '#09090b' }}>Light Mode</span>
              <span style={{ fontSize: 11, color: '#71717a', lineHeight: 1.4 }}>
                High contrast visibility, clean paper grid background, bright typography.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Translation Engine Toggle */}
        <TranslationEngineSettings />

        {/* Section 3: LibreTranslate Settings (only visible when LibreTranslate engine is selected) */}
        {translationEngine === 'libretranslate' && <LibreTranslateSettings />}

      </div>
    </div>
  )
}

export default Settings