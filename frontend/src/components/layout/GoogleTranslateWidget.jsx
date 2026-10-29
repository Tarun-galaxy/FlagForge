import { useEffect, useRef } from 'react'
import { useTranslation } from '../../context/TranslationContext.jsx'

// Google Translate widget filtered to 10 supported languages
const GOOGLE_LANG_CODES = 'en,es,de,hi,te,mr,gu,bn,ta,ar'

export default function GoogleTranslateWidget() {
  const { translationEngine } = useTranslation()
  const containerRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    // Only mount when Google Widget engine is active
    if (translationEngine !== 'google_widget') {
      // Clean up widget if switching away
      const existingScript = document.getElementById('google-translate-script')
      if (existingScript) existingScript.remove()
      const existingBanner = document.querySelector('.skiptranslate')
      if (existingBanner) existingBanner.style.display = 'none'
      initialized.current = false
      return
    }

    // Don't re-initialize if already done
    if (initialized.current) return

    // Define the Google callback
    window.googleTranslateElementInit = () => {
      if (containerRef.current && !containerRef.current.hasChildNodes()) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: GOOGLE_LANG_CODES,
            layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
            autoDisplay: false,
            multilanguagePage: false
          },
          'google_translate_element'
        )
      }
    }

    // Load Google Translate script
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script')
      script.id = 'google-translate-script'
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      script.async = true
      document.body.appendChild(script)
    } else {
      // Script already loaded, just re-init
      if (window.google && window.google.translate) {
        window.googleTranslateElementInit()
      }
    }

    initialized.current = true

    return () => {
      // Cleanup on unmount
    }
  }, [translationEngine])

  if (translationEngine !== 'google_widget') return null

  return (
    <div
      ref={containerRef}
      id="google_translate_element"
      className="google-translate-widget"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
      }}
    />
  )
}
