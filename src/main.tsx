import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PrefsProvider } from './lib/prefs'
import { UiProvider } from './lib/ui-context'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </PrefsProvider>
  </StrictMode>,
)
