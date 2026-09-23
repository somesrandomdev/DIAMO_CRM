// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { validateEnv } from './utils/env'

// Build marker — lets anyone verify which version is actually running
// (crucial with the PWA update prompt: a dismissed update pins the old
// precache, and "nothing changed on Vercel" is almost always that).
// Bump on every release.
export const APP_BUILD = '2026-09-23.1'

console.info(`DIAMO CRM — build ${APP_BUILD}`)

// Validate environment configuration on startup
validateEnv()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)