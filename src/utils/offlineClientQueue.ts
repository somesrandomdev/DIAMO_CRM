import { supabase } from '@/lib/supabase'
import { getDb } from './offlineSalesQueue'

/**
 * A client created while offline. `offline_id` (prefixed 'offline-') is the
 * placeholder that offline-recorded sales reference; after the real insert
 * it maps to the generated uuid so those sales can be re-pointed.
 */
export interface QueuedClient {
  offline_id: string
  kiosque_id: string
  nom: string
  telephone: string
  email: string | null
  localite: string
  type_client: string
  nombre_personnes: number | null
  contenant_prefere: string
  preference_contact: string
  accepte_offres: boolean
  created_at: string
}

export async function enqueueClient(client: QueuedClient): Promise<void> {
  const db = await getDb()
  await db.put('offlineClients', client)
}

/** Clients created offline and not synced yet (read-only, for display). */
export async function getQueuedClients(): Promise<QueuedClient[]> {
  const db = await getDb()
  return db.getAll('offlineClients')
}

export interface FlushOfflineClientsResult {
  flushed: number
  failed: number
  /** offline-... placeholder -> real client uuid, for the sales flush. */
  clientIdMap: Record<string, string>
}

/**
 * Inserts queued offline clients and returns the offline_id -> uuid mapping.
 * MUST run before flushing offline sales: sales referencing an offline
 * client stay queued until their client has a real id.
 */
export async function flushOfflineClients(): Promise<FlushOfflineClientsResult> {
  const db = await getDb()
  const clients = await db.getAll('offlineClients')

  const result: FlushOfflineClientsResult = { flushed: 0, failed: 0, clientIdMap: {} }

  for (const client of clients) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        kiosque_id: client.kiosque_id,
        nom: client.nom,
        telephone: client.telephone,
        email: client.email,
        localite: client.localite,
        type_client: client.type_client,
        // Defensive: pre-fix queued clients may carry null (NOT NULL column).
        nombre_personnes: client.nombre_personnes ?? 1,
        contenant_prefere: client.contenant_prefere,
        preference_contact: client.preference_contact,
        accepte_offres: client.accepte_offres,
      })
      .select('id')
      .single()

    let realId = data?.id as string | undefined

    // UNIQUE (kiosque_id, telephone): the client already exists — created by an
    // earlier flush whose response was lost, or on another device. Reuse its
    // id instead of leaving it (and its sales) stuck in the queue forever.
    if (error && (error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('kiosque_id', client.kiosque_id)
        .eq('telephone', client.telephone)
        .maybeSingle()
      realId = (existing as { id: string } | null)?.id
    }

    if (!realId) {
      result.failed += 1
      console.error('Offline client sync failed:', error)
      continue
    }

    result.clientIdMap[client.offline_id] = realId
    // Re-point the queued sales BEFORE dropping the client entry: the
    // offline_id -> uuid mapping only lives for this flush, so a sale that
    // fails to sync now would otherwise never find its client again.
    await repointQueuedSales(client.offline_id, realId)
    await db.delete('offlineClients', client.offline_id)
    result.flushed += 1
  }

  return result
}

/** Rewrites client_id on every queued sale recorded against an offline client. */
async function repointQueuedSales(offlineId: string, realId: string): Promise<void> {
  const db = await getDb()
  const sales = await db.getAll('sales')
  for (const sale of sales) {
    if (sale.client_id === offlineId) {
      await db.put('sales', { ...sale, client_id: realId })
    }
  }
}
