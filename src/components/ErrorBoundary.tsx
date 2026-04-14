import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '../lib/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component to catch JavaScript errors in component tree
 * Provides fallback UI and logs errors for debugging
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      captureException(error, {
        componentStack: errorInfo.componentStack
      })
    }

    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-md w-full text-center p-8 rounded-xl shadow-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(250, 82, 82, 0.1)' }}>
                <svg className="w-10 h-10" style={{ color: 'var(--color-error)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
              Une erreur est survenue
            </h1>
            
            <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Nous sommes désolés, mais une erreur inattendue s'est produite. 
              Veuillez réessayer ou contacter le support si le problème persiste.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Détails techniques
                </summary>
                <pre className="p-4 rounded-lg overflow-auto text-xs" style={{ 
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-error)',
                  maxHeight: '200px'
                }}>
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              Réessayer
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full mt-3 py-3 px-6 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
