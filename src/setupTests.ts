import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'node:util'

/**
 * Global test setup.
 *
 * Deliberately minimal: module mocks belong in the individual test files that
 * need them. A global `jest.mock('zustand')` / `jest.mock('react-router-dom')`
 * (as this file previously had) breaks every suite that wants the real
 * implementations — including the NavControls render tests.
 */

// jsdom omits these Web APIs; react-router v7 touches TextEncoder at import time.
global.TextEncoder ??= TextEncoder as unknown as typeof global.TextEncoder
global.TextDecoder ??= TextDecoder as unknown as typeof global.TextDecoder

// jsdom implements neither of these, and Radix/recharts call them on mount.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Supabase's client reads env vars at import time; provide inert defaults so
// importing a module that pulls in the client doesn't throw during tests.
process.env.VITE_SUPABASE_URL ??= 'http://localhost:54321'
process.env.VITE_SUPABASE_ANON_KEY ??= 'test-anon-key'
