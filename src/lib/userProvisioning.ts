import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getEnvConfig } from '@/utils/env'
import { normalizePhone } from '@/lib/phone'
import type { UserRole } from '@/stores/authStore'

export interface ProvisionEmployeeInput {
  fullName: string
  email: string
  password: string
  role: UserRole
  kiosqueId: string | null
  /** Optional contact number; stored normalized (digits only). */
  phone?: string
}

export interface ProvisionEmployeeResult {
  success: boolean
  /** Plain-French message, safe to show a non-technical admin. */
  message: string
  /** True when the account exists but the employee must confirm their e-mail. */
  needsEmailConfirmation?: boolean
  /** True when the signUp e-mail is already registered (caller may retry with a different synthetic address). */
  emailTaken?: boolean
  /** True when profiles_phone_unique rejected the number. */
  phoneConflict?: boolean
}

/**
 * Creates an isolated auth client for provisioning.
 *
 * WHY THIS EXISTS — do not replace this with the shared `supabase` client.
 *
 * `auth.signUp()` returns a session for the newly-created user whenever e-mail
 * confirmation is disabled. The shared client has `persistSession: true`, so it
 * would immediately write that session to localStorage, evicting the admin's
 * own token: the admin would be silently signed out and signed back in AS the
 * new employee (typically a `fontainier`), losing admin access mid-task.
 *
 * This client persists nothing and refreshes nothing. The new user's session
 * exists only in memory for the duration of the call and is then discarded.
 * A distinct storageKey keeps Supabase's "multiple GoTrueClient instances"
 * warning quiet.
 */
function createProvisioningClient() {
  // getEnvConfig(), not useEnv(): the latter is a plain function with a
  // hook-shaped name, so calling it outside a component trips
  // react-hooks/rules-of-hooks. Same values, no false positive.
  const env = getEnvConfig()

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'diamo-provisioning-ephemeral',
    },
  })
}

/**
 * Creates a new internal employee: an Auth account plus their `profiles` row
 * with role and kiosk assignment already applied.
 *
 * Runs in two steps because `options.data` only populates
 * `auth.users.raw_user_meta_data` — it does NOT create or update the
 * `public.profiles` row that the app's RLS policies and UI read from.
 */
export async function provisionEmployee(
  input: ProvisionEmployeeInput
): Promise<ProvisionEmployeeResult> {
  const provisioningClient = createProvisioningClient()

  // ── Step 1: create the Auth account ──────────────────────────────────
  const { data, error } = await provisioningClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        username: input.fullName,
        role: input.role,
        kiosque_id: input.kiosqueId,
      },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  })

  if (error) {
    const message = error.message.toLowerCase()
    // Email collisions are retriable: the caller (AddEmployeeDialog) regenerates
    // a synthetic address with a random suffix when this flag is set.
    const emailTaken =
      message.includes('already registered') || message.includes('already exists')
    return { success: false, emailTaken, message: friendlySignUpError(error.message) }
  }

  const newUser = data.user
  if (!newUser) {
    return {
      success: false,
      message: "Le compte n'a pas pu être créé. Veuillez réessayer.",
    }
  }

  // When e-mail confirmations are enabled, Supabase returns an obfuscated user
  // with an empty `identities` array for an address that already exists —
  // this is deliberate, to prevent account enumeration. It is the only signal
  // that the e-mail was already taken.
  if (newUser.identities && newUser.identities.length === 0) {
    return {
      success: false,
      emailTaken: true,
      message: 'Un compte existe déjà avec cette adresse e-mail.',
    }
  }

  // ── Step 2: apply role and kiosk to the profiles row ─────────────────
  // upsert, not insert: some deployments have a `handle_new_user` trigger that
  // already created the row. upsert covers both cases — it fills in the row if
  // absent, and applies the admin's role/kiosk choice if a trigger made it
  // with defaults.
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: newUser.id,
      username: input.fullName,
      email: input.email,
      // profiles_phone_unique: normalized digits, or null (multiple NULLs allowed).
      phone: input.phone ? normalizePhone(input.phone) : null,
      role: input.role,
      // profiles.kiosque_id is fontainier-only; commercials are supervised
      // via commercials_kiosques, assigned separately by an admin.
      kiosque_id: input.role === 'fontainier' ? input.kiosqueId : null,
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    console.error('Employee profile upsert failed:', profileError)
    if (profileError.code === '23505') {
      return {
        success: false,
        phoneConflict: true,
        message: 'Ce numéro est déjà utilisé par un autre compte.',
      }
    }
    // The Auth account now exists but has no usable profile. Say so plainly
    // rather than reporting a success the admin can't act on.
    return {
      success: false,
      message:
        "Le compte a été créé, mais le rôle et le kiosque n'ont pas pu être enregistrés. " +
        "Modifiez l'utilisateur dans la liste pour terminer la configuration.",
    }
  }

  // No session was returned => the project requires e-mail confirmation.
  const needsEmailConfirmation = !data.session

  return {
    success: true,
    needsEmailConfirmation,
    message: needsEmailConfirmation
      ? `${input.fullName} doit confirmer son adresse e-mail avant de pouvoir se connecter.`
      : `${input.fullName} peut maintenant se connecter avec le mot de passe temporaire.`,
  }
}

/** Maps Supabase's English sign-up errors to plain French. */
function friendlySignUpError(raw: string): string {
  const message = raw.toLowerCase()

  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Un compte existe déjà avec cette adresse e-mail.'
  }
  if (message.includes('password') && message.includes('short')) {
    return 'Le mot de passe est trop court (6 caractères minimum).'
  }
  if (message.includes('weak') || message.includes('pwned')) {
    return 'Ce mot de passe est trop faible. Choisissez-en un autre.'
  }
  if (message.includes('invalid') && message.includes('email')) {
    return "L'adresse e-mail n'est pas valide."
  }
  if (message.includes('rate') || message.includes('too many')) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.'
  }
  if (message.includes('signups not allowed') || message.includes('signup is disabled')) {
    return (
      'La création de comptes est désactivée sur le serveur. ' +
      'Activez « Enable Sign Ups » dans les réglages Supabase.'
    )
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion internet.'
  }

  return "Le compte n'a pas pu être créé. Veuillez vérifier les informations saisies."
}

/**
 * Generates a readable temporary password an admin can dictate over the phone.
 * Avoids look-alike characters (O/0, l/1/I) that cause support calls.
 */
export function generateTemporaryPassword(): string {
  const words = ['Eau', 'Diamo', 'Kiosque', 'Soleil', 'Baobab', 'Teranga']
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'

  const pick = <T,>(source: T[] | string, length: number): string => {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) =>
      typeof source === 'string'
        ? source[byte % source.length]
        : String(source[byte % source.length])
    ).join('')
  }

  return `${pick(words, 1)}-${pick(letters, 2)}${pick(digits, 3)}`
}
