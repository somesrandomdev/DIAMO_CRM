import '@testing-library/jest-dom'

// Extend Jest matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
    }
  }
}

// Mock Supabase
const mockSupabase = {
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
      })),
    },
  },
}

jest.mock('./lib/supabase', () => mockSupabase)

// Mock react-router-dom
const mockReactRouterDom = {
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, ...props }: any) => {
    const React = require('react')
    return React.createElement('a', props, children)
  },
  BrowserRouter: ({ children }: any) => {
    const React = require('react')
    return React.createElement('div', null, children)
  },
}

jest.mock('react-router-dom', () => mockReactRouterDom)

// Mock Zustand
const mockZustand = {
  create: jest.fn((fn: any) => fn),
}

jest.mock('zustand', () => mockZustand)

// Global test utilities
global.fetch = jest.fn()
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
}
