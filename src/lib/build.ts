/**
 * Build marker — source unique de vérité pour la version déployée.
 * main.tsx l'affiche en console ; telemetry l'embarque dans chaque log.
 * La valeur est injectée par le define Vite 'globalThis.__APP_BUILD__'
 * (voir vite.config.ts) : en Jest, absent → fallback 'dev'.
 */
const globalScope = globalThis as { __APP_BUILD__?: string }
export const APP_BUILD: string = globalScope.__APP_BUILD__ ?? 'dev'
