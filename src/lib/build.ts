/**
 * Build marker — source unique de vérité pour la version déployée.
 * main.tsx l'affiche en console ; telemetry l'embarque dans chaque log.
 * Incrémenter à chaque release.
 */
// Valeur injectée par Vite (sha de build) — voir vite.config.ts.
// typeof-safe: en Jest (pas de define), retombe sur 'dev'.
export const APP_BUILD: string =
  typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev'
