import { openDB, type DBSchema } from 'idb'
import { supabase } from '@/lib/supabase'

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

interface OfflineSalesDB extends DBSchema {
  sales: {
    key: string
    value: QueuedSale
    indexes: {
      'by-queued-at': string
    }
  }
}

const DB_NAME = 'diamo-offline-sales'
const DB_VERSION = 1

async function getDb() {
  return openDB<OfflineSalesDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sales')) {
        const store = db.createObjectStore('sales', { keyPath: 'id' })
        store.createIndex('by-queued-at', 'queued_at')
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

export async function flushOfflineSales(): Promise<FlushOfflineSalesResult> {
  const queuedSales = await getQueuedSales()
  let flushed = 0
  let failed = 0

  for (const sale of queuedSales) {
    const rows = sale.items.map((item) => ({
      kiosque_id: sale.kiosque_id,
      client_id: sale.client_id,
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
