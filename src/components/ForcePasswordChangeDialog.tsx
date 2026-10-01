import { useState } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PosInput, PosLabel } from '@/components/pos'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * Blocking first-login password change. Rendered INSTEAD of the app while
 * profiles.must_change_password is true: no close button, no backdrop close,
 * no Escape (Radix events are cancelled and onOpenChange is a no-op).
 * The user cannot reach any route until the password is updated.
 */
export function ForcePasswordChangeDialog() {
  const { loadProfile } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Set once auth.updateUser succeeded: a retry after a failed flag reset must
  // not re-send the password (Supabase rejects an identical one).
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setIsSaving(true)
    try {
      if (!passwordUpdated) {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
        if (updateError) {
          setError(
            updateError.message.toLowerCase().includes('different')
              ? 'Le nouveau mot de passe doit être différent de l\'actuel.'
              : 'Le changement a échoué. Veuillez réessayer.'
          )
          setIsSaving(false)
          return
        }
        setPasswordUpdated(true)
      }

      const { data: profileData } = await supabase.auth.getUser()
      const flagError = profileData.user
        ? (
            await supabase
              .from('profiles')
              .update({ must_change_password: false })
              .eq('id', profileData.user.id)
          ).error
        : new Error('Session introuvable')

      // The password IS changed at this point; only the flag failed. Without
      // this, loadProfile() kept must_change_password = true and the dialog
      // stayed on its spinner forever.
      if (flagError) {
        console.error('must_change_password reset failed:', flagError)
        setError(
          'Votre mot de passe a bien été changé, mais la validation a échoué. ' +
            'Appuyez à nouveau sur le bouton pour réessayer.'
        )
        setIsSaving(false)
        return
      }

      // Re-fetch the profile: must_change_password flips to false, the gate
      // unmounts and App renders the authenticated routes.
      await loadProfile()
      // Profile still flagged (or not reloaded): never leave the button stuck.
      if (useAuthStore.getState().profile?.must_change_password !== false) {
        setError('Le changement a échoué. Veuillez réessayer.')
        setIsSaving(false)
      }
    } catch (caught) {
      console.error('Forced password change failed:', caught)
      setError('Le changement a échoué. Veuillez réessayer.')
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent
          hideClose
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-[#009EFB]" aria-hidden="true" />
              Changement de mot de passe requis
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[#1C5376]">
            Votre mot de passe doit être changé avant de continuer.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <PosLabel htmlFor="force-new-password">Nouveau mot de passe *</PosLabel>
              <PosInput
                id="force-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="8 caractères minimum"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <PosLabel htmlFor="force-confirm-password">Confirmer le mot de passe *</PosLabel>
              <PosInput
                id="force-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Répétez le mot de passe"
              />
            </div>
            {error && <p className="text-sm font-medium text-[#FF4949]">{error}</p>}
            <Button type="submit" variant="pos-primary" className="w-full" loading={isSaving}>
              <KeyRound className="h-4 w-4" />
              Changer mon mot de passe
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
