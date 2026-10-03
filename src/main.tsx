import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ensureSeed } from './lib/db'
import { captureInstallPrompt } from './lib/install'
import { applyTheme, storedTheme } from './lib/theme'
import { installRipple } from './lib/ripple'
import { isNative } from './lib/native/platform'

captureInstallPrompt()
installRipple()
{
  const t = storedTheme()
  applyTheme(t.theme, t.seed)
}

if (isNative) {
  // Android app: native notifications, back button, status bar.
  void import('./lib/native/init').then((m) => m.initNative())
} else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  })
}

ensureSeed()
  .catch((e) => console.error('Could not open local database', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
