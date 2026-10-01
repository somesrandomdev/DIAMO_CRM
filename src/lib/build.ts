/**
 * Build marker : la version réellement SERVIE est dans /version.json
 * (généré au build, fetché no-store). APP_BUILD est un fallback 'dev'
 * pour les contextes sans injection (Jest).
 */
export const APP_BUILD = 'dev'

/** Fetch le build servi par le serveur (no-store). null si indisponible. */
export async function fetchServedBuild(): Promise<string | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' })
    if (!response.ok) return null
    const data = (await response.json()) as { build?: string }
    return data.build ?? null
  } catch {
    return null
  }
}
