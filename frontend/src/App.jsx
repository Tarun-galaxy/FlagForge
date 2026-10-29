import AppRoutes from './routes/AppRoutes.jsx'
import { TranslationProvider } from './context/TranslationContext.jsx'

function App() {
  return (
    <TranslationProvider>
      <AppRoutes />
    </TranslationProvider>
  )
}

export default App

