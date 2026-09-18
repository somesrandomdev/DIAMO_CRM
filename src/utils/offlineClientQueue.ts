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

export async function getQueuedClientsCount(): Promise<number> {
  const db = await getDb()
  return db.count('offlineClients')
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

    if (error || !data) {
      result.failed += 1
      console.error('Offline client sync failed:', error)
      continue
    }

    result.clientIdMap[client.offline_id] = data.id
    await db.delete('offlineClients', client.offline_id)
    result.flushed += 1
  }

  return result
}
