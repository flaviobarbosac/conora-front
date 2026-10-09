import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import './styles/global.css'

async function bootstrapNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return
  }
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
  await GoogleAuth.initialize()
}

void bootstrapNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

void SplashScreen.hide().catch(() => undefined)
