// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { validateEnv } from './utils/env'
import { APP_BUILD } from './lib/build'
import { setupTelemetry } from './lib/telemetry'

console.info(`DIAMO CRM — build ${APP_BUILD}`)

// Validate environment configuration on startup
validateEnv()

// Telemetry technique (buffer + capture globale) — silencieux par design
setupTelemetry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)