import { useCallback, useRef, useState } from 'react'
import { useToast } from '@/components/Toast'
import {
  describeSaleError,
  isDuplicateIdempotencyError,
  isRetryableSaleError,
  logSaleError,
} from '@/lib/saleErrors'
import { supabase } from '@/lib/supabase'
import { logInfo } from '@/lib/telemetry'
import type { QueuedSale } from '@/utils/offlineSalesQueue'
import type { TicketUploadInput } from './useTicketUpload'
import type { CartItem } from './useVenteForm'

export interface SubmitSaleContext {
  kiosqueId: string
  kiosqueNom: string
  clientId: string
  cartItems: CartItem[]
  total: number
  /** Client label for the ticket (falls back to "Client"). */
  ticketClient: { nom: string; telephone?: string }
  isOnline: boolean
}

interface UseSubmitSaleOptions {
  enqueueOfflineSale: (sale: Omit<QueuedSale, 'id' | 'queued_at'>) => Promise<void>
  uploadTicket: (input: TicketUploadInput) => Promise<boolean>
  resetForm: () => void
  reloadSummary: () => void
  /** Test hook: default 1500ms verify wait / 800 + 2000ms retry backoff. */
  timings?: { verifyDelayMs?: number; retry1Ms?: number; retry2Ms?: number; resetDelayMs?: number }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** crypto.randomUUID is secure-context only — fallback for tests/older webviews. */
const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/**
 * The sale submission flow, hardened against double-submits and network blips:
 *
 * click → ONE idempotency key per attempt (reused by every retry and kept by
 * the offline queue) → insert with idempotency_key →
 *   success            → ticket + toast + reset
 *   23505 idempotency  → the sale ALREADY exists: success toast, reset, no dupe
 *   retryable failure  → wait → SELECT by idempotency_key →
 *       found          → success (ticket on the real sale id)
 *       not found      → retry ×2 (same key) → still failing → offline queue
 *   non-retryable      → explicit toast, no retry, no queue
 */
export function useSubmitSale({
  enqueueOfflineSale,
  uploadTicket,
  resetForm,
  reloadSummary,
  timings,
}: UseSubmitSaleOptions) {
  const { showToast } = useToast()
  const verifyDelayMs = timings?.verifyDelayMs ?? 1500
  const retry1Ms = timings?.retry1Ms ?? 800
  const retry2Ms = timings?.retry2Ms ?? 2000
  const resetDelayMs = timings?.resetDelayMs ?? 1200

  const [loading, setLoading] = useState(false)
  const [saleSaved, setSaleSaved] = useState(false)
  /** Bumped after each completed sale so the client picker clears its field. */
  const [resetKey, setResetKey] = useState(0)

  // Synchronous double-click guard: set before ANY await, so a second click
  // within the same render frame cannot start a parallel submission.
  const inFlightRef = useRef(false)
  // ONE idempotency key per attempt: every retry/queue of this submission
  // reuses it, so at most one ventes row can ever exist for the attempt.
  const idempotencyKeyRef = useRef<string | null>(null)

  const finishAttempt = useCallback(() => {
    idempotencyKeyRef.current = newIdempotencyKey() // fresh key for the next sale
    inFlightRef.current = false
  }, [])

  const finishWithReset = useCallback(
    (delayMs: number) => {
      window.setTimeout(() => {
        resetForm()
        setResetKey((key) => key + 1)
        setSaleSaved(false)
        reloadSummary()
      }, delayMs)
    },
    [reloadSummary, resetForm]
  )

  const submit = useCallback(
    async (context: SubmitSaleContext) => {
      // Sync double-click guard (the disabled state only applies after re-render)
      if (inFlightRef.current) return
      inFlightRef.current = true

      const { kiosqueId, clientId, cartItems } = context
      if (!kiosqueId || !clientId || cartItems.length === 0) {
        finishAttempt()
        return
      }

      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey()
      const idempotencyKey = idempotencyKeyRef.current

      const queueOffline = async () => {
        await enqueueOfflineSale({
          kiosque_id: kiosqueId,
          client_id: clientId,
          created_at: new Date().toISOString(),
          idempotency_key: idempotencyKey,
          items: cartItems.map((item) => ({
            offre_id: item.offreId,
            quantite: item.qty,
            montant_total: item.prix * item.qty,
          })),
        })

        // Keep the key INSIDE the queued sale (anti-duplicate at sync), hand a
        // fresh key to the next sale.
        finishAttempt()
        setSaleSaved(true)
        logInfo('sync', 'vente mise en file hors-ligne', {
          idempotencyKey,
          kiosqueId,
          items: cartItems.length,
        })
        showToast({
          type: 'success',
          title: 'Vente enregistrée',
          message: 'Vente enregistrée — synchronisation automatique au retour du réseau',
        })
        finishWithReset(resetDelayMs)
      }

      // ── Offline: straight to the queue ─────────────────────────────────
      if (!context.isOnline) {
        await queueOffline()
        return
      }

      // ── Online: insert (with retry + idempotency verification) ─────────
      setLoading(true)

      const insertOnce = async () => {
        const sales = []
        for (const item of cartItems) {
          const total = item.prix * item.qty

          const { data: sale, error: saleError } = await supabase
            .from('ventes')
            .insert({
              kiosque_id: kiosqueId,
              client_id: clientId,
              offre_id: item.offreId,
              quantite: item.qty,
              montant_total: total,
              idempotency_key: idempotencyKey,
            })
            .select('id')
            .single()

          if (saleError) {
            logSaleError('échec insert ventes', saleError)
            throw saleError
          }
          sales.push({ ...sale, ...item, montant_total: total })
        }
        return sales as Array<{ id: string } & (typeof cartItems)[number] & { montant_total: number }>
      }

      const verifyByIdempotencyKey = async () => {
        const { data } = await supabase
          .from('ventes')
          .select('id, lien_ticket')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()
        return (data as { id: string; lien_ticket?: string | null } | null) ?? null
      }

      const reportSaleError = (error: unknown) => {
        logSaleError('échec soumission', error)
        showToast({
          type: 'error',
          title: 'Erreur lors de la vente',
          message: describeSaleError(error),
        })
      }

      try {
        let recordedSaleIds: Array<{ id: string }> | null = null
        let skipTicket = false
        let attempt = 0

        while (true) {
          attempt += 1
          try {
            recordedSaleIds = await insertOnce()
            break
          } catch (insertError) {
            // 23505 on idx_ventes_idempotency_key = the sale is ALREADY there
            // (double-click or retried request). Success, never a duplicate.
            if (isDuplicateIdempotencyError(insertError)) {
              setLoading(false)
              setSaleSaved(true)
              showToast({
                type: 'success',
                title: 'Vente déjà enregistrée',
                message: 'Vente déjà enregistrée — aucune duplication effectuée.',
              })
              finishAttempt()
              finishWithReset(resetDelayMs)
              return
            }

            // Non-retryable (RLS, FK, NOT NULL, other uniques): explicit toast,
            // no retry, no queue.
            if (!isRetryableSaleError(insertError)) {
              reportSaleError(insertError)
              setLoading(false)
              setSaleSaved(false)
              finishAttempt()
              return
            }

            // Retryable: maybe the request landed anyway — verify by key.
            await sleep(verifyDelayMs)
            const existing = await verifyByIdempotencyKey()
            if (existing) {
              recordedSaleIds = [{ id: existing.id }]
              skipTicket = Boolean(existing.lien_ticket)
              break
            }

            if (attempt > 2) {
              // Retries exhausted with the same key → offline queue. The key
              // travels with the sale: the sync cannot create a duplicate.
              setLoading(false)
              await queueOffline()
              return
            }

            reportSaleError(insertError) // honest in-flight status while retrying
            await sleep(attempt === 1 ? retry1Ms : retry2Ms)
          }
        }

        const firstSaleId = recordedSaleIds![0].id

        const ticketOk = skipTicket
          ? true
          : await uploadTicket({
              saleId: firstSaleId,
              kiosqueId,
              kiosqueNom: context.kiosqueNom,
              client: context.ticketClient,
              offres: cartItems.map((item) => ({
                ...item.offre,
                prix: item.prix,
                quantite: item.qty,
                sous_total: item.prix * item.qty,
              })),
              montantTotal: context.total,
            })
        if (!ticketOk) {
          setLoading(false)
          return
        }

        setLoading(false)
        setSaleSaved(true)
        showToast({
          type: 'success',
          title: 'Vente enregistrée',
          message: skipTicket
            ? `${cartItems.length} offre(s) enregistrée(s).`
            : `${cartItems.length} offre(s) - ticket telecharge.`,
        })
        finishAttempt()
        finishWithReset(resetDelayMs + 800)
      } catch (error: unknown) {
        logSaleError('échec soumission', error)
        showToast({
          type: 'error',
          title: 'Erreur lors de la vente',
          message: describeSaleError(error),
        })
        setLoading(false)
        setSaleSaved(false)
        finishAttempt()
      }
    },
    [
      enqueueOfflineSale,
      resetDelayMs,
      finishAttempt,
      finishWithReset,
      retry1Ms,
      retry2Ms,
      showToast,
      uploadTicket,
      verifyDelayMs,
    ]
  )

  return { submit, loading, saleSaved, resetKey }
}
