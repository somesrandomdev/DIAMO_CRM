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

/** What the confirmation screen shows once a sale is recorded or queued. */
export interface SaleReceipt {
  total: number
  clientNom: string
  items: Array<{ nom: string; qty: number; sousTotal: number }>
  /** true = kept on the device, synced later (no ticket yet). */
  queued: boolean
  /** true = every line already existed (double submit): nothing new recorded. */
  alreadyRecorded: boolean
}

interface UseSubmitSaleOptions {
  enqueueOfflineSale: (sale: Omit<QueuedSale, 'id' | 'queued_at'>) => Promise<void>
  uploadTicket: (input: TicketUploadInput) => Promise<boolean>
  resetForm: () => void
  reloadSummary: () => void
  /** Called once per finished sale (recorded, already there, or queued). */
  onRecorded?: (receipt: SaleReceipt) => void
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
 * the offline queue) → one insert per cart line, all with idempotency_key
 * (unique index: idempotency_key + offre_id) →
 *   success            → ticket + toast + reset
 *   23505 idempotency  → THAT line already exists: reuse it, continue the cart;
 *                        every line already there → success toast, no dupe
 *   retryable failure  → wait → SELECT lines by idempotency_key →
 *       all offers     → success (ticket on the real first line id)
 *       missing offers → retry ×2 (same key, recorded lines skipped) → still
 *                        failing → offline queue
 *   non-retryable      → explicit toast, no retry, no queue
 */
export function useSubmitSale({
  enqueueOfflineSale,
  uploadTicket,
  resetForm,
  reloadSummary,
  onRecorded,
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

      const receipt = (flags: { queued?: boolean; alreadyRecorded?: boolean } = {}): SaleReceipt => ({
        total: context.total,
        clientNom: context.ticketClient.nom,
        items: cartItems.map((item) => ({ nom: item.offre.nom, qty: item.qty, sousTotal: item.prix * item.qty })),
        queued: flags.queued ?? false,
        alreadyRecorded: flags.alreadyRecorded ?? false,
      })

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
        // The confirmation screen (onRecorded) already says it: no duplicate toast.
        if (!onRecorded) {
          showToast({
            type: 'success',
            title: 'Vente enregistrée',
            message: 'Vente enregistrée — synchronisation automatique au retour du réseau',
          })
        }
        onRecorded?.(receipt({ queued: true }))
        finishWithReset(resetDelayMs)
      }

      // ── Offline: straight to the queue ─────────────────────────────────
      if (!context.isOnline) {
        await queueOffline()
        return
      }

      // ── Online: insert (with retry + idempotency verification) ─────────
      setLoading(true)

      type RecordedLine = { id: string; offre_id: string; lien_ticket?: string | null }

      // Every ventes line already recorded under this attempt's key (one per
      // offer: the unique index is (idempotency_key, offre_id)).
      const fetchRecordedLines = async (): Promise<RecordedLine[]> => {
        const { data } = await supabase
          .from('ventes')
          .select('id, offre_id, lien_ticket')
          .eq('idempotency_key', idempotencyKey)
        return (data as RecordedLine[] | null) ?? []
      }

      // Cart order is kept: the ticket hangs off the first line.
      const linesForCart = (lines: RecordedLine[]): RecordedLine[] | null => {
        const ordered = cartItems.map((item) => lines.find((line) => line.offre_id === item.offreId))
        return ordered.every(Boolean) ? (ordered as RecordedLine[]) : null
      }

      const insertOnce = async () => {
        const lines: RecordedLine[] = []
        let alreadyRecorded = 0
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
            // 23505 on (idempotency_key, offre_id) concerns THIS line only: an
            // earlier attempt recorded it. Reuse it and go on with the rest of
            // the cart — never abandon the sibling offers.
            if (isDuplicateIdempotencyError(saleError)) {
              const existing = (await fetchRecordedLines()).find(
                (line) => line.offre_id === item.offreId
              )
              if (existing) {
                lines.push(existing)
                alreadyRecorded += 1
                continue
              }
            }
            logSaleError('échec insert ventes', saleError)
            throw saleError
          }
          lines.push({ id: (sale as { id: string }).id, offre_id: item.offreId, lien_ticket: null })
        }
        return { lines, allAlreadyRecorded: alreadyRecorded === cartItems.length }
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
        let recordedLines: RecordedLine[] | null = null
        let attempt = 0

        while (true) {
          attempt += 1
          try {
            const result = await insertOnce()
            // Every line of the cart was ALREADY there (double-click or
            // retried request): success, never a duplicate.
            if (result.allAlreadyRecorded) {
              setLoading(false)
              setSaleSaved(true)
              if (!onRecorded) {
                showToast({
                  type: 'success',
                  title: 'Vente déjà enregistrée',
                  message: 'Vente déjà enregistrée — aucune duplication effectuée.',
                })
              }
              finishAttempt()
              onRecorded?.(receipt({ alreadyRecorded: true }))
              finishWithReset(resetDelayMs)
              return
            }
            recordedLines = result.lines
            break
          } catch (insertError) {
            // Non-retryable (RLS, FK, NOT NULL, other uniques): explicit toast,
            // no retry, no queue.
            if (!isRetryableSaleError(insertError)) {
              reportSaleError(insertError)
              setLoading(false)
              setSaleSaved(false)
              finishAttempt()
              return
            }

            // Retryable: maybe the requests landed anyway — verify by key.
            // Success only when EVERY offer of the cart is recorded; a partial
            // cart goes back through insertOnce, which skips the lines
            // already there.
            await sleep(verifyDelayMs)
            const complete = linesForCart(await fetchRecordedLines())
            if (complete) {
              recordedLines = complete
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

        const firstSaleId = recordedLines![0].id
        // A ticket already uploaded by an earlier attempt: don't redo it.
        const skipTicket = recordedLines!.some((line) => Boolean(line.lien_ticket))

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
        if (!onRecorded) {
          showToast({
            type: 'success',
            title: 'Vente enregistrée',
            message: skipTicket
              ? `${cartItems.length} offre(s) enregistrée(s).`
              : `${cartItems.length} offre(s) enregistrée(s) - ticket prêt.`,
          })
        }
        finishAttempt()
        onRecorded?.(receipt())
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
      onRecorded,
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
