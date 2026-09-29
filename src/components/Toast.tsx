import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

/**
 * Toast Provider component for managing toast notifications
 * Replaces alert() calls with a modern, accessible notification system
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      const newToast: Toast = {
        ...toast,
        id,
        // Succès 3s; les erreurs restent jusqu'à fermeture manuelle.
        duration: toast.duration ?? (toast.type === 'error' ? 0 : 3000),
      }

      setToasts((prev) => [...prev, newToast])

      // Auto-remove after duration
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, newToast.duration)
      }
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

/**
 * Hook to use toast notifications
 * @example
 * const { showToast } = useToast()
 * showToast({ type: 'success', title: 'Success!', message: 'Operation completed' })
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

/**
 * Toast Container component that displays all active toasts
 */
function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[]
  onRemove: (id: string) => void
}) {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    className: 'border-success bg-success/10 text-success',
  },
  error: {
    icon: AlertCircle,
    className: 'border-destructive bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning bg-warning/10 text-warning',
  },
  info: {
    icon: Info,
    className: 'border-primary bg-primary/10 text-primary',
  },
}

/**
 * Individual Toast Item component
 */
function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: (id: string) => void
}) {
  const [isExiting, setIsExiting] = useState(false)

  const handleRemove = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  const config = toastConfig[toast.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'pointer-events-auto min-w-[320px] max-w-md p-4 rounded-lg shadow-lg border transition-all duration-300',
        config.className,
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
      role="alert"
      aria-labelledby={`toast-title-${toast.id}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-6 w-6 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <h3
            id={`toast-title-${toast.id}`}
            className="font-semibold text-sm text-foreground"
          >
            {toast.title}
          </h3>
          {toast.message && (
            <p className="mt-1 text-sm text-muted-foreground">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick()
                handleRemove()
              }}
              className="mt-2 text-sm font-medium underline hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Fermer la notification"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
