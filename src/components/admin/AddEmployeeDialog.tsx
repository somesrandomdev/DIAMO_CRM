import { useEffect, useId, useMemo, useState } from 'react'
import { AlertCircle, Copy, RefreshCw, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/Toast'
import { normalizePhone } from '@/lib/phone'
import { KiosqueSearchSelect } from '@/components/KiosqueSearchSelect'
import { logAudit } from '@/lib/audit'
import {
  generateTemporaryPassword,
  provisionEmployee,
  type ProvisionEmployeeResult,
} from '@/lib/userProvisioning'
import type { UserRole } from '@/stores/authStore'
import { Input, Select } from '@/components/ui/input'

interface KiosqueOption {
  id: string
  nom: string
}

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kiosques: KiosqueOption[]
  /** Called after a successful creation so the parent can refresh its list. */
  onCreated: (message: string) => void
}

const roleOptions: { value: UserRole; label: string; help: string }[] = [
  {
    value: 'fontainier',
    label: 'Fontainier',
    help: 'Enregistre les ventes et gère les clients de son kiosque.',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    help: "Supervise les kiosques que l'administrateur lui assigne après la création (aucun kiosque attitré).",
  },
  {
    value: 'administrateur',
    label: 'Administrateur',
    help: 'Accès complet à tout le réseau, sans kiosque assigné.',
  },
]

interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
  kiosqueId?: string
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  kiosques,
  onCreated,
}: AddEmployeeDialogProps) {
  const fieldId = useId()
  const { showToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('fontainier')
  const [kiosqueId, setKiosqueId] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // profiles.kiosque_id is fontainier-only: commercials get their kiosques
  // from the commercials_kiosques junction, assigned by an admin after creation.
  const needsKiosque = role === 'fontainier'
  const selectedRoleHelp = useMemo(
    () => roleOptions.find((option) => option.value === role)?.help ?? '',
    [role]
  )

  // Reset to a clean slate each time the dialog opens, and pre-fill a temporary
  // password so the admin never has to invent one (they tended to reuse the
  // same weak password for every employee).
  useEffect(() => {
    if (!open) return
    setFullName('')
    setEmail('')
    setPhone('')
    setPassword(generateTemporaryPassword())
    setRole('fontainier')
    setKiosqueId('')
    setErrors({})
    setFormError('')
    setIsSaving(false)
    setCopied(false)
  }, [open])

  const validate = (): boolean => {
    const next: FieldErrors = {}

    if (!fullName.trim()) next.fullName = 'Veuillez saisir le nom complet.'
    // Email is OPTIONAL since login works with identifiant or phone; when left
    // empty a synthetic @diamo.local address is generated at submit time.
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Cette adresse e-mail n'est pas valide."
    }
    if (password.length < 6) {
      next.password = 'Le mot de passe doit contenir au moins 6 caractères.'
    }
    if (needsKiosque && !kiosqueId) {
      next.kiosqueId = 'Veuillez choisir un kiosque pour ce rôle.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  /**
   * Synthetic address for accounts created without an email: the user logs in
   * with their identifiant or phone and NEVER sees this address. Normalized
   * phone first (it doubles as a login identifier), else a slug of the name.
   * Retried with a random suffix if the address is already registered.
   */
  const buildSyntheticEmail = (attempt: number): string => {
    const base = normalizePhone(phone) || slugify(fullName) || 'utilisateur'
    const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6)}`
    return `${base}${suffix}@diamo.local`
  }

  const slugify = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]/g, '')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')

    if (!validate()) return

    setIsSaving(true)

    const submittedEmail = email.trim().toLowerCase()
    let lastResult: ProvisionEmployeeResult = {
      success: false,
      message: "Le compte n'a pas pu être créé. Veuillez réessayer.",
    }
    // Retry with suffixes when a synthetic address collides (real emails are
    // used as-is and only tried once — the admin chose them deliberately).
    for (let attempt = 0; attempt <= (submittedEmail ? 0 : 3); attempt += 1) {
      const effectiveEmail = submittedEmail || buildSyntheticEmail(attempt)
      lastResult = await provisionEmployee({
        fullName: fullName.trim(),
        email: effectiveEmail,
        password,
        role,
        kiosqueId: needsKiosque ? kiosqueId : null,
        phone: phone.trim() || undefined,
      })
      if (!(lastResult.emailTaken && !submittedEmail)) break
    }
    const result = lastResult
    setIsSaving(false)

    if (!result.success && result.phoneConflict) {
      showToast({
        type: 'error',
        title: 'Numéro déjà utilisé',
        message: 'Ce numéro est déjà utilisé par un autre compte.',
      })
    }

    if (!result.success) {
      setFormError(result.message)
      return
    }

    await logAudit('user.create', 'profiles', result.userId ?? null, {
      username: fullName.trim(),
      role,
      kiosqueId: needsKiosque ? kiosqueId : null,
      emailSynthetique: !submittedEmail,
    })

    onCreated(result.message)
    onOpenChange(false)
  }

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(
        `Diam'o — accès\nE-mail : ${email.trim()}\nMot de passe : ${password}`
      )
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The password
      // is visible on screen regardless, so this is non-fatal.
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5 text-blue" aria-hidden="true" />
            Ajouter un employé
          </DialogTitle>
          <DialogDescription>
            Créez un accès à l'application. Communiquez ensuite l'e-mail et le mot de
            passe temporaire à l'employé.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Nom complet */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-name`} className="text-sm">
              Nom complet
            </Label>
            <Input
              id={`${fieldId}-name`}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ex. Aminata Diallo"
              autoComplete="off"
              error={!!errors.fullName}
              aria-invalid={!!errors.fullName}
              aria-describedby={`${fieldId}-name-help${errors.fullName ? ` ${fieldId}-name-error` : ''}`}
            />
            <p id={`${fieldId}-name-help`} className="text-xs text-text-secondary">
              Sert d'identifiant de connexion (en plus du téléphone).
            </p>
            {errors.fullName && (
              <FieldError id={`${fieldId}-name-error`}>{errors.fullName}</FieldError>
            )}
          </div>

          {/* Téléphone (optionnel) — sert d'identifiant de connexion */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-phone`} className="text-sm">
              Téléphone (optionnel)
            </Label>
            <Input
              id={`${fieldId}-phone`}
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Ex : 77 123 45 67"
              autoComplete="off"
            />
          </div>

          {/* E-mail (optionnel) */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-email`} className="text-sm">
              Adresse e-mail (optionnelle)
            </Label>
            <Input
              id={`${fieldId}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value.trim())}
              placeholder="prenom.nom@exemple.com"
              autoComplete="off"
              error={!!errors.email}
              aria-invalid={!!errors.email}
              aria-describedby={`${fieldId}-email-help${errors.email ? ` ${fieldId}-email-error` : ''}`}
            />
            <p id={`${fieldId}-email-help`} className="text-xs text-text-secondary">
              Optionnel — l'utilisateur pourra se connecter avec son identifiant ou son téléphone.
            </p>
            {errors.email && (
              <FieldError id={`${fieldId}-email-error`}>{errors.email}</FieldError>
            )}
          </div>

          {/* Mot de passe temporaire */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-password`} className="text-sm">
              Mot de passe temporaire
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${fieldId}-password`}
                // Intentionally type="text": the admin must be able to read this
                // aloud to the employee. Masking it here helps no one — nobody is
                // shoulder-surfing an internal back office, and a hidden value
                // leads admins to retype it wrongly.
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                error={!!errors.password}
                aria-invalid={!!errors.password}
                aria-describedby={`${fieldId}-password-help`}
              />
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={() => setPassword(generateTemporaryPassword())}
                aria-label="Générer un nouveau mot de passe"
                title="Générer un nouveau mot de passe"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={copyCredentials}
                aria-label="Copier l'e-mail et le mot de passe"
                title="Copier l'e-mail et le mot de passe"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p id={`${fieldId}-password-help`} className="text-xs text-text-secondary">
              {copied
                ? '✓ Identifiants copiés dans le presse-papiers.'
                : "L'employé pourra le changer depuis son profil."}
            </p>
            {errors.password && (
              <FieldError id={`${fieldId}-password-error`}>{errors.password}</FieldError>
            )}
          </div>

          {/* Rôle */}
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-role`} className="text-sm">
              Rôle
            </Label>
            <Select
              id={`${fieldId}-role`}
              value={role}
              onChange={(event) => {
                const nextRole = event.target.value as UserRole
                setRole(nextRole)
                // Only fontainiers carry a kiosque_id; clear any kiosk the
                // admin had already picked to avoid sending a stale value.
                if (nextRole !== 'fontainier') setKiosqueId('')
                setErrors((current) => ({ ...current, kiosqueId: undefined }))
              }}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-text-secondary">{selectedRoleHelp}</p>
          </div>

          {/* Kiosque — fontainier only */}
          {needsKiosque && (
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-kiosque`} className="text-sm">
                Kiosque assigné
              </Label>
              <KiosqueSearchSelect
                id={`${fieldId}-kiosque`}
                kiosques={kiosques.map((kiosque) => ({ id: kiosque.id, nom: kiosque.nom }))}
                value={kiosqueId}
                onChange={(value) => setKiosqueId(value)}
                emptyLabel="Choisir un kiosque..."
                required
                invalid={!!errors.kiosqueId}
              />
              {kiosques.length === 0 && (
                <p className="text-xs text-amber">
                  Aucun kiosque n'existe encore. Créez d'abord un kiosque.
                </p>
              )}
              {errors.kiosqueId && (
                <FieldError id={`${fieldId}-kiosque-error`}>{errors.kiosqueId}</FieldError>
              )}
            </div>
          )}

          {/* Server-side failure */}
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-md border-2 border-red bg-red-light p-3"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red" aria-hidden="true" />
              <p className="text-sm font-medium leading-snug text-red">{formError}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="default"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button type="submit" variant="primary" loading={isSaving} loadingText="Création du compte…">
              <UserPlus className="h-4 w-4" />
              Créer le compte
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs font-medium text-red">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}
