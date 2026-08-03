# DIAMO_CRM — Comprehensive Audit & Solutions

> Audit date: 2026-08-03 | Stack: React 19 · Vite 7 · TypeScript 5.8 · Zustand 5 · Supabase JS 2 · Tailwind CSS 4 · React Router 7 · PWA (Workbox)

---

## 1. Executive Summary

DIAMO_CRM is a well-structured franchise water-kiosk CRM with a clean component hierarchy, lazy-loaded routes, offline sale queuing, and a role-based access model (`fontainier` / `commercial` / `administrateur`). The codebase shows deliberate security thinking (rate limiting, input validation, CSP headers) but contains several **critical gaps** that must be closed before production:

| Pillar | Health | Verdict |
|---|---|---|
| Code Quality | ⚠️ Fair | Dead code (~130 KB of unused pages), N+1 queries, shared loading state |
| Performance | 🔴 Poor | Admin dashboard fetches all rows client-side; 3 overlapping ventes queries |
| Security | 🔴 Critical | Stored XSS in ticket generator; storage path bypass breaks RLS; CSP blocks Supabase in prod |
| UI/UX | ⚠️ Fair | Good mobile layout; missing skeleton loaders; offline banner needs polish |

---

## 2. Database & RLS Alignment

### 2.1 Function Name Conflict — Two Competing Policy Sets

The committed migration (`20260521000000_crm_improvement_plan.sql`) creates helper functions `current_profile_role()` and `current_profile_kiosque_id()` and builds all policies around them. The **Master Fix script** (provided separately) creates `get_my_role()` and `is_admin()` and rebuilds all policies using those names. If both scripts have been applied, the database now has **duplicate, overlapping policies** on `ventes`, `clients`, `offres`, `profiles`, and `objectifs`.

**Action required:** After applying the Master Fix, drop the old functions and the policies created by the migration:

```sql
-- Run after the Master Fix script
DROP FUNCTION IF EXISTS public.current_profile_role();
DROP FUNCTION IF EXISTS public.current_profile_kiosque_id();

-- Drop migration-era policies (they were already dropped by the Master Fix,
-- but confirm with: SELECT policyname FROM pg_policies WHERE tablename IN
-- ('ventes','clients','offres','profiles','objectifs');)
```

Also update `get_admin_alerts()` in the migration — it still calls `current_profile_role()`:

```sql
-- Before (migration)
WITH is_admin AS (
  SELECT public.current_profile_role() = 'administrateur' AS allowed
)

-- After (aligned with Master Fix)
WITH is_admin AS (
  SELECT public.is_admin() AS allowed
)
```

### 2.2 `admin_dashboard_summary` View — No Admin Guard

The view grants `SELECT` to all `authenticated` users, but contains cross-kiosk revenue data. RLS on the underlying `ventes` table does not apply to views by default in Postgres unless `security_invoker = true`.

```sql
-- Before (insecure — any authenticated user can read all kiosk revenue)
CREATE OR REPLACE VIEW public.admin_dashboard_summary AS ...;
GRANT SELECT ON public.admin_dashboard_summary TO authenticated;

-- After
CREATE OR REPLACE VIEW public.admin_dashboard_summary
  WITH (security_invoker = true)   -- RLS of underlying tables applies
AS
SELECT ...;
-- OR restrict to admin role only:
REVOKE ALL ON public.admin_dashboard_summary FROM authenticated;
GRANT SELECT ON public.admin_dashboard_summary TO authenticated;
-- and add a policy on the view itself, or wrap in a SECURITY DEFINER function
-- that checks is_admin() before returning rows.
```

### 2.3 Required Indexes for RLS Performance

Every row evaluation for `ventes`, `clients`, and `objectifs` executes a subquery against `profiles`. Without the right indexes this becomes O(n) per query.

```sql
-- Already in migration (keep these):
CREATE INDEX IF NOT EXISTS idx_ventes_kiosque_date ON public.ventes (kiosque_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_client       ON public.ventes (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_kiosque     ON public.clients (kiosque_id);

-- ADD these (missing):
-- Speeds up get_my_role() / is_admin() / current_profile_kiosque_id() lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id_role       ON public.profiles (id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_id_kiosque    ON public.profiles (id, kiosque_id);

-- Speeds up objectifs RLS
CREATE INDEX IF NOT EXISTS idx_objectifs_kiosque      ON public.objectifs (kiosque_id);

-- Speeds up offres_kiosque joins in venteStore
CREATE INDEX IF NOT EXISTS idx_offres_kiosque_active  ON public.offres_kiosque (kiosque_id, est_actif);
```

### 2.4 App Queries vs. New RLS Policies — Alignment Check

| Query location | Table | Filter sent | RLS policy match | Status |
|---|---|---|---|---|
| `venteStore.loadClients` | `clients` | `.eq('kiosque_id', kiosqueId)` | `kiosque_id = get_my_role()…` subquery | ✅ Redundant but harmless |
| `venteStore.loadOffres` | `offres_kiosque` | `.eq('kiosque_id', kiosqueId)` | Read-all authenticated | ✅ |
| `useAdminDashboard` | `ventes` | `.gte('created_at', …)` only | Admin-only SELECT policy | ✅ (admin context) |
| `VenteUltraSimple.loadVenteSummary` | `ventes` | `.eq('kiosque_id', kiosqueId)` | User own-kiosk policy | ✅ |
| `VenteUltraSimple.handleSubmit` | `storage/private_tickets` | uploads to root `/ticket-multi-{id}.pdf` | Policy requires `{kiosque_id}/` prefix | 🔴 **FAILS** |
| `authStore.loadProfile` | `profiles` | `.eq('id', user.id)` | `id = auth.uid()` | ✅ |

---

## 3. Audit Findings & Actionable Solutions

### Pillar 1 — Code Quality & Architecture

---

#### CQ-1 · Dead / Unreachable Pages (High)

`AdminDashboard.tsx` (27 KB), `AdminDashboardEnhanced.tsx` (76 KB), `Dashboard.tsx` (16 KB), `CommercialStatsUltra.tsx` (22 KB), and `FontainierDashboard.tsx` (8 KB) are never imported in `App.tsx`. Together they add ~150 KB of dead TypeScript that is still compiled, type-checked, and potentially bundled if a future import is added by mistake.

**Before:** five files exist, none referenced in the router.

**After:** delete them, or if they are work-in-progress, move them to `src/_wip/` and add a `.gitignore` rule so they are excluded from CI type-checking:

```bash
# remove dead pages
rm src/pages/AdminDashboard.tsx
rm src/pages/AdminDashboardEnhanced.tsx
rm src/pages/Dashboard.tsx
rm src/pages/CommercialStatsUltra.tsx
rm src/pages/FontainierDashboard.tsx
```

---

#### CQ-2 · Duplicate Login Flow — `authStore.signIn` vs `Login.tsx` (Medium)

`Login.tsx` calls `supabase.auth.signInWithPassword` directly and then calls `loadProfile()`, bypassing the rate-limiter and email-validation logic in `authStore.signIn`. There are now two parallel sign-in paths that can diverge.

**Before (`Login.tsx`):**
```ts
const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) throw signInError
await loadProfile()
setTimeout(() => { window.location.href = '/dashboard' }, 500)
```

**After (`Login.tsx`):**
```ts
const { success, error } = await signIn(email, password)
if (!success) { setError(error ?? 'Erreur inconnue'); return }
// authStore.signIn already calls loadProfile(); router handles redirect via profile state
```

Also remove the `setTimeout + window.location.href` hard-reload — the router already redirects when `profile` becomes non-null in `App.tsx`.

---

#### CQ-3 · `authStore.loadProfile` — Unauthenticated Profile Auto-Creation (High)

When `profiles` returns an error for a valid auth user, the store silently inserts a new profile with `role: 'fontainier'`. This means any Supabase Auth user (including ones created by mistake or via the public sign-up form) automatically gets a CRM profile. It also fires two extra round-trips on every cold start.

**Before:**
```ts
if (error || !profile) {
  const { error: insertError } = await supabase.from('profiles').insert({ ... role: 'fontainier' })
  // re-fetch ...
}
```

**After:** remove the auto-insert; surface the error so an admin can provision the profile explicitly:
```ts
if (error || !profile) {
  console.error('Profile not found for authenticated user:', user.id)
  set({ user: null, profile: null })
  return
}
```

---

#### CQ-4 · Shared `isLoading` in `venteStore` Causes Race Condition (Medium)

`loadClients` and `loadOffres` both write to the same `isLoading` flag. If called concurrently (as they are in `VenteUltraSimple`'s `useEffect`), the second call resets `isLoading: true` after the first has already set it to `false`, producing a flicker.

**Before:**
```ts
loadClients: async (kiosqueId) => {
  set({ isLoading: true, error: null })   // shared flag
  ...
  set({ clients: data, isLoading: false })
}
```

**After:** use separate flags:
```ts
interface VenteStore {
  clientsLoading: boolean
  offresLoading: boolean
  ...
}
// each action sets only its own flag
loadClients: async (kiosqueId) => {
  set({ clientsLoading: true })
  ...
  set({ clients: data ?? [], clientsLoading: false })
}
```

---

#### CQ-5 · `hasSQLInjectionPatterns` and `SecureTokenStorage` — Unused Exports (Low)

`security.ts` exports `hasSQLInjectionPatterns`, `SecureTokenStorage`, `constantTimeCompare`, and `generateCSPNonce`. None are imported anywhere in the app. Supabase uses parameterised queries so client-side SQL-injection scanning is security theatre. Remove or document them.

---

#### CQ-6 · `src/Plan Détaillé des Pages.txt` and `src/plan.txt` Committed to Repo (Low)

Two plain-text planning documents (10 KB + 13 KB) are committed inside `src/`. They are not imported, not excluded by `.gitignore`, and will be included in the Vite build output scan.

**Fix:** move to a `docs/` folder at the repo root and add to `.gitignore` if they contain internal business logic.

---

### Pillar 2 — Performance

---

#### PERF-1 · Admin Dashboard Fetches All Rows Client-Side (Critical)

`useAdminDashboard` fires **three** full `ventes` table scans in parallel (current month, previous month, last 30 days), pulling every column including joined `kiosques` and `offres` for every row. On a table with 50 000 rows this transfers megabytes of JSON on every dashboard load.

**Before:**
```ts
supabase.from('ventes')
  .select('id, kiosque_id, client_id, offre_id, quantite, montant_total, created_at, kiosques(id, nom), offres(id, nom, volume_ml)')
  .gte('created_at', monthStart.toISOString())
// repeated 3 times with different date ranges
```

**After:** replace with a single Postgres RPC that aggregates server-side:

```sql
-- Add to a new migration
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_month_start date,
  p_prev_start  date,
  p_last30_start date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN (
    SELECT json_build_object(
      'current',  (SELECT json_agg(r) FROM (
                    SELECT kiosque_id, offre_id, SUM(montant_total) AS ca,
                           COUNT(*) AS nb, SUM(quantite) AS qty,
                           COUNT(DISTINCT client_id) AS clients
                    FROM ventes WHERE created_at >= p_month_start
                    GROUP BY kiosque_id, offre_id) r),
      'previous', (SELECT json_agg(r) FROM (
                    SELECT kiosque_id, SUM(montant_total) AS ca
                    FROM ventes
                    WHERE created_at >= p_prev_start AND created_at < p_month_start
                    GROUP BY kiosque_id) r),
      'daily',    (SELECT json_agg(r) FROM (
                    SELECT created_at::date AS day, SUM(montant_total) AS ca
                    FROM ventes WHERE created_at >= p_last30_start
                    GROUP BY created_at::date ORDER BY day) r)
    )
  );
END;
$$;
```

```ts
// useAdminDashboard.ts — After
const { data } = await supabase.rpc('get_admin_dashboard_stats', {
  p_month_start: monthStart.toISOString().slice(0, 10),
  p_prev_start:  prevStart.toISOString().slice(0, 10),
  p_last30_start: last30Start.toISOString().slice(0, 10),
})
```

---

#### PERF-2 · `VenteUltraSimple` Fires Two Redundant Queries on Mount (Medium)

On mount, `loadVenteSummary` runs two queries against `ventes` (today's stats + last 5 sales). Immediately after a successful sale, `handleSubmit` calls `loadClients`, `loadOffres`, **and** `loadVenteSummary` again — three sequential awaits inside a `setTimeout`. The clients and offers lists do not change after a sale; only the summary needs refreshing.

**Before:**
```ts
window.setTimeout(async () => {
  resetForm()
  setSaleSaved(false)
  if (profile.kiosque_id) {
    await loadClients(profile.kiosque_id)   // unnecessary
    await loadOffres(profile.kiosque_id)    // unnecessary
    await loadVenteSummary(profile.kiosque_id)
  }
}, 2000)
```

**After:**
```ts
window.setTimeout(() => {
  resetForm()
  setSaleSaved(false)
  if (profile.kiosque_id) loadVenteSummary(profile.kiosque_id)
}, 2000)
```

---

#### PERF-3 · Workbox Caches Private Storage Responses (Medium)

`vite.config.ts` configures a `CacheFirst` strategy for all `*.supabase.co/storage/*` URLs with a 7-day TTL. The `private_tickets` bucket returns signed URLs that expire in 60 seconds. Caching them means the service worker will serve a stale, expired URL from cache for up to 7 days.

**Before:**
```ts
{ urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  handler: 'CacheFirst',
  options: { expiration: { maxAgeSeconds: 60 * 60 * 24 * 7 } } }
```

**After:** use `NetworkOnly` for storage (signed URLs must always be fresh), or scope the cache to public assets only:
```ts
{ urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
  handler: 'CacheFirst',
  options: { expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } } },
{ urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/sign\/.*/i,
  handler: 'NetworkOnly' },
```

---

#### PERF-4 · PWA Icon Bloat in Bundle (Low)

`pwa-512x512.png` is 314 KB and `apple-touch-icon.png` is 46 KB. Both are in `public/` and served uncompressed. Compress them with `sharp` or `squoosh` to reduce initial load by ~300 KB.

---

### Pillar 3 — Security

---

#### SEC-1 · Stored XSS via `innerHTML` in Ticket Generator (Critical)

`ticketGenerator.ts` builds a DOM node using `container.innerHTML = \`...\`` and interpolates `client.nom`, `kiosque.nom`, `offre.nom`, and `client.telephone` directly without escaping. A client name containing `<img src=x onerror=alert(1)>` would execute when the ticket is rendered.

**Before (`ticketGenerator.ts`):**
```ts
container.innerHTML = `
  <div style="text-align:center">
    <h2>${kiosque.nom || 'Diam\'o'}</h2>
    <p><strong>Client :</strong> ${client.nom}</p>
    ...
  </div>
`
```

**After:** use `textContent` for every user-supplied value:
```ts
function el(tag: string, text?: string, style?: string): HTMLElement {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  if (style) node.style.cssText = style
  return node
}

const wrap = document.createElement('div')
wrap.style.cssText = 'text-align:center'

const title = el('h2', kiosque.nom || "Diam'o")
const addr  = el('p', kiosque.adresse || '')
const clientLine = el('p')
clientLine.append(el('strong', 'Client : '), document.createTextNode(client.nom))
// ... build the rest with el() and append()
container.appendChild(wrap)
```

---

#### SEC-2 · Storage Upload Ignores Folder-Scoped RLS Policy (Critical)

The Master Fix storage policy requires uploads to be placed under `{kiosque_id}/filename`. The app uploads to the bucket root:

**Before (`VenteUltraSimple.tsx`):**
```ts
const fileName = `ticket-multi-${sales[0].id}.pdf`
await supabase.storage.from('private_tickets').upload(fileName, pdfBlob, { upsert: false })
// stored as: private_tickets/ticket-multi-<uuid>.pdf  ← no kiosque_id prefix
```

The RLS policy `(storage.foldername(name))[1] = (SELECT kiosque_id::text FROM profiles WHERE id = auth.uid())` will **reject this upload** because `foldername` of a root-level file returns an empty array. This is why uploads silently fail in production.

**After:**
```ts
const kiosqueFolder = profile.kiosque_id   // already validated non-null above
const fileName = `${kiosqueFolder}/ticket-${sales[0].id}.pdf`
await supabase.storage.from('private_tickets').upload(fileName, pdfBlob, { upsert: false })
// stored as: private_tickets/<kiosque_id>/ticket-<uuid>.pdf  ← matches policy
```

Also update the signed URL call and the `lien_ticket` value stored in `ventes`:
```ts
const { data: signedData } = await supabase.storage
  .from('private_tickets')
  .createSignedUrl(fileName, 60, { download: true })

await supabase.from('ventes').update({ lien_ticket: fileName }).eq('id', sales[0].id)
```

---

#### SEC-3 · CSP Blocks Supabase in Production (High)

`vercel.json` sets:
```
"Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
```

There is no `connect-src` directive, so `default-src 'self'` blocks all `fetch()` calls to `*.supabase.co`. The app will silently fail all API calls in production on browsers that enforce CSP.

**Before:**
```json
{ "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:;" }
```

**After** (replace `YOUR_PROJECT_REF` with your Supabase project ref):
```json
{ "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://YOUR_PROJECT_REF.supabase.co wss://YOUR_PROJECT_REF.supabase.co;" }
```

---

#### SEC-4 · Public Self-Registration Enabled (High)

`Login.tsx` exposes a "Créer un compte" flow that calls `supabase.auth.signUp` with `role: 'fontainier'` in user metadata. Anyone with the app URL can create an auth account. Combined with CQ-3 (auto-profile creation), this means any stranger can get a working CRM login.

**Fix — Option A (recommended):** disable public sign-up in the Supabase dashboard under **Authentication → Settings → Enable Sign Ups** and remove the register form from `Login.tsx`.

**Fix — Option B:** keep the form but gate it behind an invite token:
```ts
// Login.tsx — register branch
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: `${window.location.origin}/login` },
})
// Remove the `data: { role }` metadata — role is assigned by admin in AdminUsersPage
```

---

#### SEC-5 · Client-Side Rate Limiter is Bypassable (Medium)

`RateLimiter` in `security.ts` stores attempt counts in a module-level `Map`. It resets on every page refresh and is completely bypassed by opening a new tab or using a different browser. It provides no real brute-force protection.

**Fix:** rely on Supabase Auth's built-in rate limiting (enabled by default) and remove the client-side limiter, or keep it only as a UX hint (disable the button) rather than a security control.

---

#### SEC-6 · `sanitizeHTML` Entity Map Corrupted by Source Encoding (Medium)

The raw bytes of `security.ts` show the HTML entity map stores literal Unicode characters instead of their escape sequences — e.g. the `&` entry maps `'&'` to `'&'` (the literal ampersand character `&amp;` rendered back to `&`). This means `sanitizeHTML('&')` returns `&` unchanged, providing no XSS protection for ampersands.

**Before:**
```ts
const map: Record<string, string> = {
  '&': '&',   // ← literal & stored, not the string "&amp;"
  '<': '<',   // ← literal < stored, not "&lt;"
  ...
}
```

**After:**
```ts
const map: Record<string, string> = {
  '&':  '&amp;',
  '<':  '&lt;',
  '>':  '&gt;',
  '"':  '&quot;',
  "'":  '&#x27;',
  '/':  '&#x2F;',
}
```

Note: this function is not currently called anywhere in the app (see CQ-5). Fix the encoding and wire it into `ticketGenerator.ts` as a fallback, or use the DOM-based approach from SEC-1 instead.

---

#### SEC-7 · `ProfilePage` Allows Self-Escalation of Role (Medium)

`ProfilePage.handleSave` sends `username`, `email`, `phone`, and `address` to `profiles.update`. The RLS "update own" policy from the Master Fix only allows users to update their own row — but if that policy uses `FOR ALL` or `FOR UPDATE` without a `WITH CHECK` that restricts the `role` column, a user could craft a direct Supabase API call to set `role: 'administrateur'`.

**Fix:** add a `WITH CHECK` constraint to the user self-update policy:

```sql
-- In a new migration
DROP POLICY IF EXISTS "user_update_own_profile" ON public.profiles;
CREATE POLICY "user_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND kiosque_id = (SELECT kiosque_id FROM public.profiles WHERE id = auth.uid())
  );
```

This prevents any update that changes `role` or `kiosque_id` through the user's own session.

---

### Pillar 4 — UI/UX

---

#### UX-1 · Login Uses `alert()` for Registration Success (High)

`Login.tsx` calls `alert('Compte créé ! Vérifiez votre e-mail...')` — a blocking browser dialog that is inaccessible, unstyled, and inconsistent with the rest of the app which uses the `Toast` system.

**Before:**
```ts
alert('Compte créé ! Vérifiez votre e-mail ou connectez-vous.')
```

**After:** the `Login` component does not have access to `useToast` (it renders outside `ToastProvider`). Either wrap `Login` inside `ToastProvider` in `App.tsx` (it already is), or use a local inline success state:
```ts
const [successMsg, setSuccessMsg] = useState('')
// ...
setSuccessMsg('Compte créé ! Vérifiez votre e-mail.')
setIsRegister(false)
// render:
{successMsg && <Alert variant="default"><AlertDescription>{successMsg}</AlertDescription></Alert>}
```

---

#### UX-2 · `ProfilePage` Success/Error Message Has No Visual Distinction (Medium)

The `message` state in `ProfilePage` renders in a neutral `bg-surface` box regardless of whether it is a success or an error. A save error looks identical to a success confirmation.

**Before:**
```tsx
{message && (
  <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-text-secondary">
    {message}
  </div>
)}
```

**After:**
```tsx
{message && (
  <div className={cn(
    'rounded-md border p-3 text-[12px]',
    isError ? 'border-destructive bg-destructive/10 text-destructive'
             : 'border-success bg-success/10 text-success'
  )}>
    {message}
  </div>
)}
```

---

#### UX-3 · `AdminUsersPage` Silently Swallows Save Errors (Medium)

`AdminUsersPage.save` logs errors to the console but shows no feedback to the admin. If the update fails (e.g. RLS rejection), the form closes and the table reloads showing the old data with no explanation.

**Before:**
```ts
if (error) console.error('Error updating profile:', error)
await load()
resetForm()
```

**After:**
```ts
if (error) {
  showToast({ type: 'error', title: 'Erreur', message: error.message })
  setIsSaving(false)
  return
}
showToast({ type: 'success', title: 'Utilisateur mis à jour' })
await load()
resetForm()
```

---

#### UX-4 · No Loading Skeleton on `VenteUltraSimple` Initial Data Fetch (Medium)

While `loadClients` and `loadOffres` are in flight, the client search input and offer dropdown are rendered but empty. A user can interact with them and get confusing empty-state results. The `venteStore.isLoading` flag exists but is not used in `VenteUltraSimple`.

**Fix:** read `isLoading` (or the split flags from CQ-4) from the store and render a skeleton or disabled state:
```tsx
const { clients, offres, clientsLoading, offresLoading } = useVenteStore()

// In the client search section:
{clientsLoading
  ? <Skeleton className="h-10 w-full" />
  : <FormInput ... />
}
```

---

#### UX-5 · Toast Container Overlaps Content on Mobile (Low)

`ToastContainer` is `fixed top-4 right-4` with `min-w-[320px]`. On a 375 px wide phone this overflows the viewport and clips the close button. The sticky submit bar at the bottom of `VenteUltraSimple` (`sticky bottom-3 z-10`) can also be obscured by a bottom-anchored keyboard.

**Fix:** move toasts to `bottom-4` on mobile using a responsive class, and add `safe-area-inset` padding for notched devices:
```tsx
// Toast.tsx
<div className="fixed bottom-4 right-4 sm:top-4 sm:bottom-auto z-50 flex flex-col gap-3 pointer-events-none pb-[env(safe-area-inset-bottom)]">
```

---

#### UX-6 · Accessibility — Icon-Only Buttons Missing Labels (Low)

The cart remove button in `VenteUltraSimple` uses `aria-label="Supprimer"` correctly, but the edit button in `AdminUsersPage` uses `aria-label="Modifier"` on a button that contains only an `<Edit>` icon — this is correct. However, the close button in `ToastItem` uses `aria-label="Fermer la notification"` but the `ToastContainer` wrapper also has `role="alert"` and `aria-live="polite"`, which means screen readers announce every toast twice (once via `aria-live`, once via the inner `role="alert"` on each item).

**Fix:** remove `role="alert"` from `ToastContainer` (keep it only on individual `ToastItem`):
```tsx
// Toast.tsx — ToastContainer
<div
  className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
  aria-label="Notifications"
  // remove role="alert" and aria-live here
>
```

---

## 4. Implementation Roadmap

### 🔴 High Priority — Fix Before Any Production Traffic

| # | Task | File(s) |
|---|---|---|
| H-1 | Fix storage upload path to include `kiosque_id/` prefix (SEC-2) | `VenteUltraSimple.tsx` |
| H-2 | Fix `innerHTML` XSS in ticket generator (SEC-1) | `ticketGenerator.ts` |
| H-3 | Add `connect-src` to CSP in `vercel.json` (SEC-3) | `vercel.json` |
| H-4 | Disable public self-registration or add invite gate (SEC-4) | `Login.tsx`, Supabase dashboard |
| H-5 | Add `WITH CHECK` to user self-update policy to block role escalation (SEC-7) | New SQL migration |
| H-6 | Add `security_invoker = true` to `admin_dashboard_summary` view (DB §2.2) | New SQL migration |
| H-7 | Drop old `current_profile_role()` / `current_profile_kiosque_id()` functions and duplicate policies (DB §2.1) | New SQL migration |
| H-8 | Add missing indexes: `idx_profiles_id_role`, `idx_profiles_id_kiosque`, `idx_objectifs_kiosque` (DB §2.3) | New SQL migration |
| H-9 | Remove auto-profile creation in `authStore.loadProfile` (CQ-3) | `authStore.ts` |
| H-10 | Replace admin dashboard full-table scans with server-side RPC (PERF-1) | `useAdminDashboard.ts`, new SQL migration |

### 🟡 Medium Priority — Fix Before Public Launch

| # | Task | File(s) |
|---|---|---|
| M-1 | Consolidate login flow — use `authStore.signIn` in `Login.tsx` (CQ-2) | `Login.tsx` |
| M-2 | Fix `sanitizeHTML` entity encoding (SEC-6) | `security.ts` |
| M-3 | Split `venteStore` loading flags to fix race condition (CQ-4) | `venteStore.ts` |
| M-4 | Scope Workbox storage cache to public objects only (PERF-3) | `vite.config.ts` |
| M-5 | Remove post-sale redundant `loadClients`/`loadOffres` calls (PERF-2) | `VenteUltraSimple.tsx` |
| M-6 | Update `get_admin_alerts()` to call `is_admin()` not `current_profile_role()` (DB §2.1) | SQL migration |
| M-7 | Show save errors in `AdminUsersPage` via toast (UX-3) | `AdminUsersPage.tsx` |
| M-8 | Replace `alert()` in `Login.tsx` with inline success state (UX-1) | `Login.tsx` |
| M-9 | Add visual distinction to `ProfilePage` success/error message (UX-2) | `ProfilePage.tsx` |
| M-10 | Add loading skeleton to `VenteUltraSimple` while data loads (UX-4) | `VenteUltraSimple.tsx` |

### 🟢 Low Priority — Quality & Polish

| # | Task | File(s) |
|---|---|---|
| L-1 | Delete or archive five dead page files (~150 KB) (CQ-1) | `AdminDashboard.tsx`, `AdminDashboardEnhanced.tsx`, `Dashboard.tsx`, `CommercialStatsUltra.tsx`, `FontainierDashboard.tsx` |
| L-2 | Move `plan.txt` and `Plan Détaillé des Pages.txt` out of `src/` (CQ-6) | `src/*.txt` |
| L-3 | Remove unused security exports or add usage (CQ-5) | `security.ts` |
| L-4 | Fix toast container mobile overflow and safe-area padding (UX-5) | `Toast.tsx` |
| L-5 | Remove duplicate `role="alert"` from `ToastContainer` (UX-6) | `Toast.tsx` |
| L-6 | Compress PWA icons to reduce ~300 KB from initial load (PERF-4) | `public/*.png` |
| L-7 | Replace client-side `RateLimiter` with UX-only button debounce (SEC-5) | `authStore.ts`, `security.ts` |

