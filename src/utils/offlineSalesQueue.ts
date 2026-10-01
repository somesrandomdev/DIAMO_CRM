import { openDB, type DBSchema } from 'idb'
import { supabase } from '@/lib/supabase'
import { generateTicket } from '@/lib/ticketGenerator'
import { ticketPath } from '@/lib/ticketFormat'
import { isDuplicateIdempotencyError } from '@/lib/saleErrors'
import { logError, logWarn } from '@/lib/telemetry'
import type { QueuedClient } from './offlineClientQueue'

export interface QueuedSaleItem {
  offre_id: string
  quantite: number
  montant_total: number
}

export interface QueuedSale {
  id: string
  kiosque_id: string
  client_id: string
  /** Anti-duplicate: same key as the original attempt (unique index on ventes). */
  idempotency_key: string
  items: QueuedSaleItem[]
  created_at: string
  queued_at: string
}

interface OfflineDB extends DBSchema {
  sales: {
    key: string
    value: QueuedSale
    indexes: {
      'by-queued-at': string
    }
  }
  // v2: clients created while offline. The offline_id key lets queued sales
  // reference these clients and be re-pointed to the real uuid on flush.
  offlineClients: {
    key: string
    value: QueuedClient
  }
}

const DB_NAME = 'diamo-offline-sales'
const DB_VERSION = 2

export async function getDb() {
  return openDB<OfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' })
        store.createIndex('by-queued-at', 'queued_at')
      }
      if (!db.objectStoreNames.contains('offlineClients')) {
        db.createObjectStore('offlineClients', { keyPath: 'offline_id' })
      }
    },
  })
}

export async function queueOfflineSale(
  sale: Omit<QueuedSale, 'id' | 'queued_at'>
): Promise<QueuedSale> {
  const queuedSale: QueuedSale = {
    ...sale,
    id: crypto.randomUUID(),
    queued_at: new Date().toISOString(),
  }

  const db = await getDb()
  await db.put('sales', queuedSale)
  return queuedSale
}

export async function getQueuedSales(): Promise<QueuedSale[]> {
  const db = await getDb()
  const tx = db.transaction('sales')
  const index = tx.store.index('by-queued-at')
  return index.getAll()
}

export async function removeQueuedSale(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('sales', id)
}

export async function getQueuedSalesCount(): Promise<number> {
  const db = await getDb()
  return db.count('sales')
}

export interface FlushOfflineSalesResult {
  flushed: number
  failed: number
}

export async function flushOfflineSales(
  clientIdMap: Record<string, string> = {}
): Promise<FlushOfflineSalesResult> {
  const queuedSales = await getQueuedSales()
  let flushed = 0
  let failed = 0

  for (const sale of queuedSales) {
    // Sales recorded against a client created offline carry a placeholder
    // 'offline-...' id; resolve it to the real uuid from the client flush.
    // Unresolvable sales stay queued for the next attempt rather than
    // becoming orphan rows.
    const clientId = sale.client_id.startsWith('offline-')
      ? clientIdMap[sale.client_id]
      : sale.client_id

    if (!clientId) {
      failed += 1
      logWarn('sync', 'vente hors-ligne bloquée: client non synchronisé', {
        idempotencyKey: sale.idempotency_key,
      })
      console.warn('Offline sale skipped: its offline client has not synced yet', sale.id)
      continue
    }

    const rows = sale.items.map((item) => ({
      kiosque_id: sale.kiosque_id,
      client_id: clientId,
      offre_id: item.offre_id,
      quantite: item.quantite,
      montant_total: item.montant_total,
      created_at: sale.created_at,
      // Same key as the original attempt: a partial unique index makes the
      // sync idempotent — a re-flush can never duplicate a sale.
      idempotency_key: sale.idempotency_key,
    }))

    // Basic offline sync: insert sales when back online, then remove from the
    // queue, then best-effort generate + upload the missing tickets.
    const { data: inserted, error } = await supabase
      .from('ventes')
      .insert(rows)
      .select('id')

    if (error) {
      // 23505 on the idempotency index (idempotency_key, offre_id) = SOME lines
      // already exist (earlier flush, or an online attempt that landed
      // partially before the sale was queued). The batch insert is atomic, so
      // nothing was written: insert only the missing offers, then drop the
      // queue entry. Never drop it while an offer is still missing.
      if (isDuplicateIdempotencyError(error)) {
        if (await insertMissingLines(rows, sale.idempotency_key)) {
          await removeQueuedSale(sale.id)
          flushed += 1
        } else {
          failed += 1
        }
        continue
      }
      failed += 1
      logError('sync', 'sync hors-ligne échouée', {
        code: (error as { code?: string }).code,
        message: (error as { message?: string }).message,
        idempotencyKey: sale.idempotency_key,
      })
      console.error('Offline sale sync failed:', error)
      continue
    }

    await removeQueuedSale(sale.id)
    flushed += 1

    // Best-effort ticket for the freshly-synced sale (the real sale ids only
    // exist after the insert). A ticket failure never blocks the sync.
    try {
      const saleIds = ((inserted ?? []) as Array<{ id: string }>).map((row) => row.id)
      if (saleIds.length > 0) {
        await generateTicketForSyncedSale({
          kiosqueId: sale.kiosque_id,
          clientId,
          saleId: saleIds[0],
          items: sale.items,
          montantTotal: sale.items.reduce((sum, item) => sum + item.montant_total, 0),
        })
      }
    } catch (ticketError) {
      console.error('Offline ticket generation/upload failed (sale synced, ticket missing):', ticketError)
    }
  }

  return { flushed, failed }
}

/**
 * Inserts the queued lines whose offer is not yet recorded under this key.
 * Returns true once every offer of the sale exists in ventes.
 */
async function insertMissingLines(
  rows: Array<{ offre_id: string }>,
  idempotencyKey: string
): Promise<boolean> {
  const { data: existing, error: lookupError } = await supabase
    .from('ventes')
    .select('offre_id')
    .eq('idempotency_key', idempotencyKey)
  if (lookupError) {
    logError('sync', 'sync hors-ligne: lecture des lignes existantes échouée', {
      code: (lookupError as { code?: string }).code,
      idempotencyKey,
    })
    return false
  }

  const recorded = new Set(((existing ?? []) as Array<{ offre_id: string }>).map((row) => row.offre_id))
  const missing = rows.filter((row) => !recorded.has(row.offre_id))
  if (missing.length === 0) return true

  const { error } = await supabase.from('ventes').insert(missing)
  if (error && !isDuplicateIdempotencyError(error)) {
    logError('sync', 'sync hors-ligne: insertion des offres manquantes échouée', {
      code: (error as { code?: string }).code,
      message: (error as { message?: string }).message,
      idempotencyKey,
    })
    return false
  }
  // A concurrent flush may have won the race (23505): the next flush re-checks.
  return !error
}

/** Names needed to draw a synced sale's ticket, fetched once per flush batch. */
async function generateTicketForSyncedSale(input: {
  kiosqueId: string
  clientId: string
  saleId: string
  items: Array<{ offre_id: string; quantite: number; montant_total: number }>
  montantTotal: number
}): Promise<void> {
  const [clientRes, kiosqueRes, offresRes] = await Promise.all([
    supabase.from('clients').select('nom, telephone').eq('id', input.clientId).maybeSingle(),
    supabase.from('kiosques').select('nom').eq('id', input.kiosqueId).maybeSingle(),
    supabase.from('offres').select('id, nom, volume_ml').in('id', input.items.map((item) => item.offre_id)),
  ])

  const offresById = new Map(
    ((offresRes.data ?? []) as Array<{ id: string; nom: string; volume_ml: number | null }>).map((o) => [o.id, o])
  )

  const ticket = await generateTicket({
    saleId: input.saleId,
    client: {
      nom: (clientRes.data as { nom?: string } | null)?.nom ?? 'Client',
      telephone: (clientRes.data as { telephone?: string } | null)?.telephone ?? undefined,
    },
    offres: input.items.map((item) => {
      const offre = offresById.get(item.offre_id)
      return {
        nom: offre?.nom ?? 'Offre',
        volume_ml: offre?.volume_ml ?? undefined,
        prix: item.quantite > 0 ? Math.round(item.montant_total / item.quantite) : item.montant_total,
        quantite: item.quantite,
        sous_total: item.montant_total,
      }
    }),
    montant_total: input.montantTotal,
    kiosque: { nom: (kiosqueRes.data as { nom?: string } | null)?.nom ?? "Diam'o" },
  })

  const pdfBlob = await (await fetch(ticket)).blob()
  const fileName = ticketPath(input.kiosqueId, input.saleId)
  const { error: uploadError } = await supabase.storage
    .from('private_tickets')
    .upload(fileName, pdfBlob, { upsert: false, contentType: 'application/pdf' })
  if (uploadError) throw uploadError

  await supabase.from('ventes').update({ lien_ticket: fileName }).eq('id', input.saleId)
}
