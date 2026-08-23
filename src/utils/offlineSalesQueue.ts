import { openDB, type DBSchema } from 'idb'
import { supabase } from '@/lib/supabase'
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
    }))

    // Basic offline sync: insert sales when back online, then remove from the queue.
    // Ticket PDF generation/upload is intentionally skipped for queued sales because
    // resolving storage/ticket conflicts needs a richer retry workflow.
    const { error } = await supabase.from('ventes').insert(rows)

    if (error) {
      failed += 1
      console.error('Offline sale sync failed:', error)
      continue
    }

    await removeQueuedSale(sale.id)
    flushed += 1
  }

  return { flushed, failed }
}
