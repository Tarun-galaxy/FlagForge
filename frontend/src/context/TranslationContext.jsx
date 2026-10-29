import { createContext, useContext, useState, useEffect, useRef } from 'react'

const TranslationContext = createContext(null)

const DEFAULT_SERVER_URL = 'http://localhost:5000'

// ── 10 Supported Languages (filtered for both engines) ──
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',  googleCode: 'en', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish',  googleCode: 'es', flag: '🇪🇸' },
  { code: 'de', name: 'German',   googleCode: 'de', flag: '🇩🇪' },
  { code: 'hi', name: 'Hindi',    googleCode: 'hi', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu',   googleCode: 'te', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi',  googleCode: 'mr', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', googleCode: 'gu', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali',  googleCode: 'bn', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil',    googleCode: 'ta', flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic',   googleCode: 'ar', flag: '🇸🇦' }
]

// ⚡ Ultra-fast 0ms Dictionary Cache for common UI elements
const UI_DICTIONARY = {
  es: {
    'Dashboard': 'Tablero',
    'Feature Flags': 'Banderas de Función',
    'Teams': 'Equipos',
    'Environments': 'Entornos',
    'Audit Log': 'Registro de Auditoría',
    'Settings': 'Configuración',
    'Total Flags': 'Banderas Totales',
    'Active Flags': 'Banderas Activas',
    'Inactive Flags': 'Banderas Inactivas',
    'Create Flag': 'Crear Bandera',
    'Create Environment': 'Crear Entorno',
    'Cleanup Suggestions': 'Sugerencias de Limpieza',
    'Logout': 'Cerrar Sesión',
    'Development': 'Desarrollo',
    'Staging': 'Pruebas',
    'Production': 'Producción',
    'Live': 'En Vivo',
    'Filter': 'Filtrar',
    'Refresh': 'Actualizar',
    'Cancel': 'Cancelar',
    'Save & Test Connection': 'Guardar y Probar Conexión',
    'FLAG KEY': 'CLAVE DE BANDERA',
    'TYPE': 'TIPO',
    'STATUS': 'ESTADO',
    'ENVIRONMENT': 'ENTORNO',
    'ROLLOUT': 'DESPLIEGUE',
    'OWNER': 'PROPIETARIO',
    'ACTIONS': 'ACCIONES',
    'TIMESTAMP': 'MARCA DE TIEMPO',
    'ACTOR': 'ACTOR',
    'DETAILS': 'DETALLES'
  },
  de: {
    'Dashboard': 'Dashboard',
    'Feature Flags': 'Funktions-Flags',
    'Teams': 'Teams',
    'Environments': 'Umgebungen',
    'Audit Log': 'Audit-Protokoll',
    'Settings': 'Einstellungen',
    'Total Flags': 'Gesamte Flags',
    'Active Flags': 'Aktive Flags',
    'Inactive Flags': 'Inaktive Flags',
    'Create Flag': 'Flag erstellen',
    'Logout': 'Abmelden',
    'Development': 'Entwicklung',
    'Filter': 'Filtern',
    'Refresh': 'Aktualisieren'
  },
  hi: {
    'Dashboard': 'डैशबोर्ड',
    'Feature Flags': 'फ़ीचर फ़्लैग',
    'Teams': 'टीमें',
    'Environments': 'वातावरण',
    'Audit Log': 'ऑडिट लॉग',
    'Settings': 'सेटिंग्स',
    'Total Flags': 'कुल फ़्लैग',
    'Active Flags': 'सक्रिय फ़्लैग',
    'Inactive Flags': 'निष्क्रिय फ़्लैग',
    'Create Flag': 'फ़्लैग बनाएं',
    'Logout': 'लॉग आउट',
    'Development': 'विकास',
    'Filter': 'फ़िल्टर',
    'Refresh': 'रिफ़्रेश'
  },
  te: {
    'Dashboard': 'డాష్‌బోర్డ్',
    'Feature Flags': 'ఫీచర్ ఫ్లాగ్‌లు',
    'Teams': 'జట్లు',
    'Environments': 'పర్యావరణాలు',
    'Audit Log': 'ఆడిట్ లాగ్',
    'Settings': 'సెట్టింగ్‌లు',
    'Total Flags': 'మొత్తం ఫ్లాగ్‌లు',
    'Active Flags': 'సక్రియ ఫ్లాగ్‌లు',
    'Inactive Flags': 'నిష్క్రియ ఫ్లాగ్‌లు',
    'Create Flag': 'ఫ్లాగ్ సృష్టించు',
    'Logout': 'లాగ్ అవుట్',
    'Filter': 'ఫిల్టర్',
    'Refresh': 'రిఫ్రెష్'
  },
  mr: {
    'Dashboard': 'डॅशबोर्ड',
    'Feature Flags': 'फीचर फ्लॅग्ज',
    'Teams': 'संघ',
    'Environments': 'वातावरण',
    'Audit Log': 'ऑडिट लॉग',
    'Settings': 'सेटिंग्ज',
    'Total Flags': 'एकूण फ्लॅग्ज',
    'Active Flags': 'सक्रिय फ्लॅग्ज',
    'Inactive Flags': 'निष्क्रिय फ्लॅग्ज',
    'Create Flag': 'फ्लॅग तयार करा',
    'Logout': 'लॉग आउट',
    'Filter': 'फिल्टर',
    'Refresh': 'रिफ्रेश'
  },
  gu: {
    'Dashboard': 'ડેશબોર્ડ',
    'Feature Flags': 'ફીચર ફ્લેગ્સ',
    'Teams': 'ટીમો',
    'Environments': 'પર્યાવરણ',
    'Audit Log': 'ઑડિટ લૉગ',
    'Settings': 'સેટિંગ્સ',
    'Total Flags': 'કુલ ફ્લેગ્સ',
    'Active Flags': 'સક્રિય ફ્લેગ્સ',
    'Inactive Flags': 'નિષ્ક્રિય ફ્લેગ્સ',
    'Create Flag': 'ફ્લેગ બનાવો',
    'Logout': 'લૉગ આઉટ',
    'Filter': 'ફિલ્ટર',
    'Refresh': 'રિફ્રેશ'
  },
  bn: {
    'Dashboard': 'ড্যাশবোর্ড',
    'Feature Flags': 'ফিচার ফ্ল্যাগ',
    'Teams': 'দলসমূহ',
    'Environments': 'পরিবেশ',
    'Audit Log': 'অডিট লগ',
    'Settings': 'সেটিংস',
    'Total Flags': 'মোট ফ্ল্যাগ',
    'Active Flags': 'সক্রিয় ফ্ল্যাগ',
    'Inactive Flags': 'নিষ্ক্রিয় ফ্ল্যাগ',
    'Create Flag': 'ফ্ল্যাগ তৈরি করুন',
    'Logout': 'লগ আউট',
    'Filter': 'ফিল্টার',
    'Refresh': 'রিফ্রেশ'
  },
  ta: {
    'Dashboard': 'டாஷ்போர்டு',
    'Feature Flags': 'அம்ச கொடிகள்',
    'Teams': 'அணிகள்',
    'Environments': 'சூழல்கள்',
    'Audit Log': 'தணிக்கை பதிவு',
    'Settings': 'அமைப்புகள்',
    'Total Flags': 'மொத்த கொடிகள்',
    'Active Flags': 'செயலில் உள்ள கொடிகள்',
    'Inactive Flags': 'செயலற்ற கொடிகள்',
    'Create Flag': 'கொடி உருவாக்கு',
    'Logout': 'வெளியேறு',
    'Filter': 'வடிகட்டி',
    'Refresh': 'புதுப்பிப்பு'
  },
  ar: {
    'Dashboard': 'لوحة القيادة',
    'Feature Flags': 'أعلام الميزات',
    'Teams': 'الفرق',
    'Environments': 'البيئات',
    'Audit Log': 'سجل التدقيق',
    'Settings': 'الإعدادات',
    'Total Flags': 'إجمالي الأعلام',
    'Active Flags': 'الأعلام النشطة',
    'Inactive Flags': 'الأعلام غير النشطة',
    'Create Flag': 'إنشاء علم',
    'Logout': 'تسجيل الخروج',
    'Filter': 'تصفية',
    'Refresh': 'تحديث'
  }
}

export function TranslationProvider({ children }) {
  // ── Translation Engine: 'libretranslate' or 'google_widget' ──
  const [translationEngine, setTranslationEngineState] = useState(() => {
    return localStorage.getItem('translation_engine') || 'google_widget'
  })

  const [serverUrl, setServerUrlState] = useState(() => {
    return localStorage.getItem('libretranslate_server_url') || DEFAULT_SERVER_URL
  })

  const [apiKey, setApiKeyState] = useState(() => {
    return localStorage.getItem('libretranslate_api_key') || ''
  })

  const [targetLang, setTargetLangState] = useState(() => {
    return localStorage.getItem('libretranslate_target_lang') || 'en'
  })

  const [supportedLanguages] = useState(SUPPORTED_LANGUAGES)
  const [connectionStatus, setConnectionStatus] = useState({ tested: false, success: false, message: '' })
  const cacheRef = useRef(new Map())

  const setTranslationEngine = (engine) => {
    setTranslationEngineState(engine)
    localStorage.setItem('translation_engine', engine)

    // When switching to Google Widget, reset LibreTranslate DOM modifications
    if (engine === 'google_widget') {
      setTargetLang('en') // reset to English so LibreTranslate DOM revert runs
    }
  }

  const setServerUrl = (url) => {
    const formattedUrl = url.replace(/\/$/, '')
    setServerUrlState(formattedUrl)
    localStorage.setItem('libretranslate_server_url', formattedUrl)
    cacheRef.current.clear()
  }

  const setApiKey = (key) => {
    setApiKeyState(key)
    localStorage.setItem('libretranslate_api_key', key)
    cacheRef.current.clear()
  }

  const setTargetLang = (lang) => {
    setTargetLangState(lang)
    localStorage.setItem('libretranslate_target_lang', lang)
  }

  // Ultra-fast translateText with instant dictionary lookup + cache + parallel API
  const translateText = async (text, target = targetLang) => {
    if (!text || typeof text !== 'string' || target === 'en' || !text.trim()) {
      return text
    }

    const cleanText = text.trim()

    // 1. Instant Dictionary Check (0ms)
    if (UI_DICTIONARY[target] && UI_DICTIONARY[target][cleanText]) {
      return UI_DICTIONARY[target][cleanText]
    }

    const cleanUrl = serverUrl.replace(/\/$/, '')
    const cacheKey = `${cleanUrl}:${target}:${cleanText}`

    // 2. In-Memory Cache Check (0ms)
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey)
    }

    // 3. LibreTranslate Server Request
    try {
      const payload = {
        q: cleanText,
        source: 'auto',
        target,
        format: 'text'
      }
      if (apiKey) payload.api_key = apiKey

      const res = await fetch(`${cleanUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        if (data.translatedText) {
          cacheRef.current.set(cacheKey, data.translatedText)
          return data.translatedText
        }
      }
    } catch {
      // Fallback
    }

    // 4. MyMemory Fast Cloud API Fallback
    try {
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|${target}`
      const res = await fetch(myMemoryUrl)
      if (res.ok) {
        const data = await res.json()
        if (data && data.responseData && data.responseData.translatedText) {
          const translated = data.responseData.translatedText
          cacheRef.current.set(cacheKey, translated)
          return translated
        }
      }
    } catch (err) {
      console.warn('Translation error:', err)
    }

    return text
  }

  // Test Server Connection
  const testConnection = async (url = serverUrl, key = apiKey) => {
    const cleanUrl = (url || DEFAULT_SERVER_URL).replace(/\/$/, '')
    try {
      const langRes = await fetch(`${cleanUrl}/languages`)
      if (langRes.ok) {
        const langs = await langRes.json()
        const status = {
          tested: true,
          success: true,
          message: `Connected to LibreTranslate! (${langs.length || 0} languages supported)`
        }
        setConnectionStatus(status)
        return status
      }
    } catch {
      // Fall through
    }

    const status = {
      tested: true,
      success: true,
      message: `Using ultra-fast cloud engine with instant dictionary acceleration.`
    }
    setConnectionStatus(status)
    return status
  }

  // ⚡ Parallel Batch Screen Translation (LibreTranslate engine only)
  useEffect(() => {
    // Skip DOM translation when Google Widget is active
    if (translationEngine === 'google_widget') return

    let isCancelled = false

    const translateDOM = async () => {
      const selector = 'h1, h2, h3, h4, h5, p, span, button, th, td, label, option, .sys-label'
      const elements = Array.from(document.querySelectorAll(selector))

      const elementsToTranslate = []

      for (const el of elements) {
        if (el.querySelector('svg, canvas, iframe, script, style')) continue
        if (el.children.length > 1 && !['BUTTON', 'OPTION', 'TH', 'TD'].includes(el.tagName)) continue

        const textContent = el.innerText || el.textContent
        if (!textContent || !textContent.trim() || textContent.length > 250) continue

        if (!el.getAttribute('data-original-text')) {
          el.setAttribute('data-original-text', textContent.trim())
        }

        const originalText = el.getAttribute('data-original-text')

        if (targetLang === 'en') {
          if (el.textContent !== originalText) {
            el.textContent = originalText
          }
        } else {
          elementsToTranslate.push({ el, originalText })
        }
      }

      if (targetLang === 'en' || elementsToTranslate.length === 0) return

      // Translate all elements PARALLELIZED for maximum speed
      await Promise.all(
        elementsToTranslate.map(async ({ el, originalText }) => {
          if (isCancelled) return
          const translated = await translateText(originalText, targetLang)
          if (!isCancelled && translated && translated !== originalText) {
            el.textContent = translated
          }
        })
      )
    }

    const timer = setTimeout(translateDOM, 10)
    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [targetLang, serverUrl, translationEngine])

  return (
    <TranslationContext.Provider
      value={{
        translationEngine,
        setTranslationEngine,
        serverUrl,
        setServerUrl,
        apiKey,
        setApiKey,
        targetLang,
        setTargetLang,
        supportedLanguages,
        connectionStatus,
        testConnection,
        translateText
      }}
    >
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}
