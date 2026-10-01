/**
 * Telemetry technique vers la table tech_logs.
 *
 * Règles:
 *  - Buffer mémoire, flush par batch: toutes les 5s OU 20 entrées OU
 *    visibilitychange/beforeunload. Jamais 1 requête par log.
 *  - Chaque entrée embarque build, route, user_id (si session), timestamp.
 *  - Un échec d'envoi est SILENCIEUX (ré-enqueue avec plafond) : le logging
 *    ne doit JAMAIS casser l'UX.
 */
import { supabase } from '@/lib/supabase'
import { APP_BUILD } from '@/lib/build'
import { REST_URL, REST_API_KEY } from '@/lib/restConfig'

export type LogLevel = 'info' | 'warn' | 'error'

export interface TechLogEntry {
  level: LogLevel
  source: string
  message: string
  context: Record<string, unknown> | null
  build: string
  route: string
  user_id: string | null
  created_at: string
}

const FLUSH_INTERVAL_MS = 5000
const FLUSH_THRESHOLD = 20
const REQUEUE_CAP = 200

let buffer: TechLogEntry[] = []
let timerStarted = false
let flushing = false

function currentRoute(): string {
  return typeof window !== 'undefined' ? window.location.pathname : 'unknown'
}

/** Insère le batch courant. keepalive pour les flush en fin de session. */
async function sendBatch(entries: TechLogEntry[], keepalive: boolean): Promise<void> {
  // Une session illisible ne doit pas tuer le flush: user_id null, token anon.
  let accessToken: string | null = null
  let userId: string | null = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    accessToken = sessionData.session?.access_token ?? null
    userId = sessionData.session?.user.id ?? null
  } catch {
    // Session indisponible — on logge quand même.
  }

  // user_id stampé au flush (l'entrée est créée synchrone, sans await)
  const stamped = entries.map((entry) => ({ ...entry, user_id: userId }))

  await fetch(`${REST_URL}/rest/v1/tech_logs`, {
    method: 'POST',
    keepalive,
    headers: {
      'Content-Type': 'application/json',
      apikey: REST_API_KEY,
      Authorization: `Bearer ${accessToken ?? REST_API_KEY}`,
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(stamped),
  })
}

export async function flushTelemetry(): Promise<void> {
  if (flushing || buffer.length === 0) return
  flushing = true
  const batch = buffer
  buffer = []

  try {
    await sendBatch(batch, false)
  } catch {
    // Silencieux: ré-enqueue (plafonné) pour le prochain flush.
    buffer = [...batch, ...buffer].slice(0, REQUEUE_CAP)
  } finally {
    flushing = false
  }
}

function deviceContext(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  return {
    userAgent: window.navigator.userAgent,
    standalone:
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false,
  }
}

function enqueue(level: LogLevel, source: string, message: string, context?: Record<string, unknown>): void {
  try {
    // Synchronisé: l'entrée est dans le buffer AVANT tout await, donc un
    // flush déclenché juste après un log la contient toujours.
    buffer.push({
      level,
      source,
      message,
      // userAgent + standalone sur chaque log (diagnostic terrain PWA)
      context: { ...(context ?? {}), ...deviceContext() },
      build: APP_BUILD,
      route: currentRoute(),
      user_id: null,
      created_at: new Date().toISOString(),
    })

    if (buffer.length >= FLUSH_THRESHOLD) {
      void flushTelemetry()
    }
  } catch {
    // Jamais de crash dû au logging.
  }
}

export function logInfo(source: string, message: string, context?: Record<string, unknown>): void {
  enqueue('info', source, message, context)
}

export function logWarn(source: string, message: string, context?: Record<string, unknown>): void {
  enqueue('warn', source, message, context)
}

export function logError(source: string, message: string, context?: Record<string, unknown>): void {
  enqueue('error', source, message, context)
}

/** Flush périodique + fin de session (onglet caché / fermeture). */
function startTimers(): void {
  if (timerStarted || typeof window === 'undefined') return
  timerStarted = true

  window.setInterval(() => void flushTelemetry(), FLUSH_INTERVAL_MS)

  const flushOnExit = () => {
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    try {
      // keepalive: la requête survit à la fermeture de l'onglet.
      void sendBatch(batch, true)
    } catch {
      // Silencieux.
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnExit()
  })
  window.addEventListener('beforeunload', flushOnExit)
}

/** Capture globale: erreurs JS non rattrapées + promesses rejetées. */
function setupGlobalCapture(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    logError('window', event.message ?? 'Erreur JS', {
      file: event.filename,
      line: event.lineno,
      col: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logError('window', 'Promesse rejetée non gérée', {
      reason: reason instanceof Error ? reason.message : String(reason),
      code: (reason as { code?: string } | null)?.code,
    })
  })
}

/** Test-only: vide le buffer (état module persiste entre les tests). */
export function _resetTelemetryForTests(): void {
  buffer = []
  flushing = false
}

/** À appeler une fois au démarrage (main.tsx). */
export function setupTelemetry(): void {
  startTimers()
  setupGlobalCapture()
}
