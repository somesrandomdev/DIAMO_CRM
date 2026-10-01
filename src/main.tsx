// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { validateEnv } from './utils/env'
import { fetchServedBuild } from './lib/build'
import { setupTelemetry } from './lib/telemetry'

// Le build réellement servi (version.json, no-store) — pas un marqueur compilé.
void fetchServedBuild().then((build) => {
  console.info(`DIAMO CRM — build ${build ?? 'dev'}`)
})

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