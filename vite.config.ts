import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/

// ── Identité de build ──────────────────────────────────────────────────
// sha court du commit (fallback timestamp si git indisponible). Écrit dans
// public/version.json (servi tel quel, fetché avec cache: 'no-store') et
// injecté dans le bundle via __APP_BUILD__ pour la comparaison de version.
let BUILD_ID = ''
try {
  BUILD_ID = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim()
} catch {
  BUILD_ID = `t${Date.now()}`
}
try {
  fs.mkdirSync('public', { recursive: true })
  fs.writeFileSync(
    'public/version.json',
    JSON.stringify({ build: BUILD_ID, generated_at: new Date().toISOString() }, null, 2)
  )
} catch {
  // environnement sans fs writable: la vérification de version se replie sur
  // le controllerchange du SW.
}

export default defineConfig({
  define: {
    'globalThis.__APP_BUILD__': JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'DIAMO CRM',
        short_name: 'DIAMO',
        description: "Système de gestion CRM pour Diam'O",
        theme_color: '#009EFB',
        background_color: '#F6F9FB',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA fallback so deep links work offline
        navigateFallback: '/index.html',
        // Auto-guérison: le nouveau SW s'active dès téléchargé et prend le
        // contrôle; la page détecte le controllerchange -> UpdateGate bloquant.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Auth must never be cached: a replayed /token or /user response
            // can resurrect a session the user has already signed out of.
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase REST API: STRICT network pass-through — never cached,
            // never answered from cache (a cached read or a cache fallback on
            // a flaky network once surfaced stale data as "the filters don't
            // work"). Offline sales go through the IndexedDB queue instead.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Public storage objects are stable and safe to cache.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-public-storage',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Signed URLs (private_tickets) expire after 60s. Caching them
            // would serve a dead link for days, so they always hit the network.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/sign\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Any other storage route (uploads, signed-URL creation) must not
            // be served from cache either.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Server configuration
  server: {
    port: 3000,
    host: true,
    open: false,
  },
  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
  },
})
