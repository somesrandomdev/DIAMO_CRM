import { useEffect, useState } from 'react'
import { Copy, Key, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PosInput, PosLabel } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/phone'

interface PasswordResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  username: string
  telephone?: string | null
}

type Mode = 'choice' | 'specific' | 'revealed'

/**
 * Admin password reset through the admin-reset-password Edge Function
 * (service role lives server-side). Two paths: generated temporary
 * password (revealed once, with copy) or an admin-chosen password
 * (min 8 chars).
 */
export function PasswordResetDialog({ open, onOpenChange, userId, username, telephone }: PasswordResetDialogProps) {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('choice')
  const [newPassword, setNewPassword] = useState('')
  const [generated, setGenerated] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('choice')
    setNewPassword('')
    setGenerated('')
    setError('')
    setIsBusy(false)
    setCopied(false)
  }, [open])

  const reportError = (err: unknown) => {
    const status = (err as { status?: number })?.status ?? 0
    console.error('Password reset failed:', err)
    if (status === 401 || status === 403) {
      showToast({ type: 'error', title: 'Accès refusé', message: 'Accès refusé : seule une administratrice ou un administrateur peut réinitialiser un mot de passe.' })
    } else if (status >= 500) {
      showToast({ type: 'error', title: 'Erreur serveur', message: 'Erreur serveur lors de la réinitialisation. Veuillez réessayer.' })
    } else {
      showToast({ type: 'error', title: 'Réinitialisation impossible', message: 'La réinitialisation a échoué. Veuillez réessayer.' })
    }
    setError('La réinitialisation a échoué.')
  }

  const invoke = async (body: Record<string, unknown>) => {
    setIsBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', { body: { userId, ...body } })
      if (error) {
        reportError(error)
        return null
      }
      return (data ?? {}) as { newPassword?: string }
    } catch (caught) {
      reportError(caught)
      return null
    } finally {
      setIsBusy(false)
    }
  }

  const generateTemp = async () => {
    const data = await invoke({})
    if (!data) return

    showToast({ type: 'success', title: 'Mot de passe réinitialisé', message: 'Mot de passe réinitialisé avec succès' })
    if (data.newPassword) {
      setGenerated(data.newPassword)
      setMode('revealed')
    } else {
      onOpenChange(false)
    }
  }

  const setSpecific = async () => {
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    const data = await invoke({ newPassword })
    if (!data) return

    showToast({ type: 'success', title: 'Mot de passe réinitialisé', message: `Le mot de passe de ${username} a été réinitialisé avec succès.` })
    onOpenChange(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(generated)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast({
        type: 'warning',
        title: 'Copie impossible',
        message: 'Sélectionnez le mot de passe et copiez-le manuellement.',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[#009EFB]" aria-hidden="true" />
            Réinitialiser le mot de passe
          </DialogTitle>
          <DialogDescription>
            {username}
            {telephone ? ` — ${formatPhone(telephone)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {mode === 'choice' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={generateTemp}
              disabled={isBusy}
              className="flex min-h-12 w-full items-center gap-3 rounded-md border-2 border-[#DCE1E5] bg-white p-3 text-left transition-colors hover:border-[#009EFB] disabled:opacity-60"
            >
              <Wand2 className="h-5 w-5 shrink-0 text-[#009EFB]" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-[#12364D]">Générer un mot de passe temporaire</span>
                <span className="block text-xs text-[#1C5376]">Affiché une seule fois, à transmettre à l'utilisateur</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('specific')}
              disabled={isBusy}
              className="flex min-h-12 w-full items-center gap-3 rounded-md border-2 border-[#DCE1E5] bg-white p-3 text-left transition-colors hover:border-[#009EFB] disabled:opacity-60"
            >
              <Key className="h-5 w-5 shrink-0 text-[#12364D]" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-[#12364D]">Définir un mot de passe précis</span>
                <span className="block text-xs text-[#1C5376]">Vous choisissez la valeur (8 caractères minimum)</span>
              </span>
            </button>
            {error && <p className="text-sm font-medium text-[#FF4949]">{error}</p>}
          </div>
        )}

        {mode === 'specific' && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setSpecific()
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <PosLabel htmlFor="reset-password">Nouveau mot de passe *</PosLabel>
              <PosInput
                id="reset-password"
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="8 caractères minimum"
                autoFocus
              />
            </div>
            {error && <p className="text-sm font-medium text-[#FF4949]">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="pos-secondary" onClick={() => setMode('choice')}>
                Retour
              </Button>
              <Button type="submit" variant="pos-primary" loading={isBusy} disabled={newPassword.length < 8}>
                Réinitialiser
              </Button>
            </DialogFooter>
          </form>
        )}

        {mode === 'revealed' && (
          <div className="space-y-4">
            <div className="rounded-md border-2 border-[#009EFB] bg-[#E3F3FE] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1C5376]">
                Mot de passe temporaire
              </p>
              <p className="mt-2 select-all break-all font-mono text-2xl font-bold text-[#12364D]">
                {generated}
              </p>
            </div>
            <Button type="button" variant="pos-secondary" className="w-full" onClick={copy}>
              <Copy className="h-4 w-4" />
              {copied ? 'Copié !' : 'Copier'}
            </Button>
            <p className="text-[13px] leading-relaxed text-[#1C5376]">
              Transmettez ce mot de passe à l'utilisateur. Il devra le changer à sa prochaine
              connexion.
            </p>
            <DialogFooter>
              <Button type="button" variant="pos-primary" onClick={() => onOpenChange(false)}>
                Terminé
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
