import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SlideOverDrawerProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function SlideOverDrawer({ title, isOpen, onClose, children }: SlideOverDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/30"
        aria-label="Fermer"
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card shadow-xl',
          'border-l p-6'
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer le tiroir" title="Fermer le tiroir">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  )
}
