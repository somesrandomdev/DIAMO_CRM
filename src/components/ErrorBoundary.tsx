import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Integration point for error tracking service (Sentry, LogRocket, etc.)
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      })
    }

    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = (): void => {
    window.location.href = '/'
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Une erreur est survenue</CardTitle>
            </CardHeader>

            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Nous sommes désolés, mais une erreur inattendue s'est produite. Veuillez
                réessayer ou contacter le support si le problème persiste.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Alert variant="destructive" className="mt-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Détails techniques</AlertTitle>
                  <AlertDescription className="mt-2">
                    <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                      {this.state.error.message}
                      {'\n'}
                      {this.state.error.stack}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button onClick={this.handleReset} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} className="w-full gap-2">
                <Home className="h-4 w-4" />
                Retour à l'accueil
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
