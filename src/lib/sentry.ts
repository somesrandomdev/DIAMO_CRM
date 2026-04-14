import * as Sentry from '@sentry/react'
import { getEnvConfig } from '../utils/env'

let isInitialized = false

/**
 * Initializes Sentry if a DSN is provided and we are in production environment
 */
export function initSentry() {
  const env = getEnvConfig()

  if (env.isProduction && env.sentryDsn && !isInitialized) {
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.nodeEnv,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    })
    isInitialized = true
    console.log('✓ Sentry initialized')
  }
}

/**
 * Captures an exception with Sentry if it is initialized
 * @param error The error to capture
 * @param context Additional context like component stack
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (isInitialized) {
    Sentry.captureException(error, {
      extra: context,
    })
  } else if (process.env.NODE_ENV === 'production') {
    // Fallback if Sentry is not configured
    console.error('Production error (Sentry not configured):', {
      error: error.message,
      stack: error.stack,
      ...context
    })
  }
}
