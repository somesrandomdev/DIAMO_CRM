// src/stores/venteStore.ts
import { create } from 'zustand'
import { supabase, handleSupabaseError } from '../lib/supabase'

/**
 * Type definitions for vente store
 */
export interface Client {
  id: string
  nom: string
  telephone?: string
  adresse?: string
  email?: string
  localite?: string
  type_client?: string
  nombre_personnes?: number
  contenant_prefere?: string
  preference_contact?: string
  accepte_offres?: boolean
  kiosque_id: string
  created_at?: string
}

export interface Offer {
  id: string
  nom: string
  volume_ml?: number
  description?: string
}

export interface OfferRow {
  offre_id: string
  prix: number
  est_actif: boolean
  offre: Offer
}

export interface Vente {
  id: string
  kiosque_id: string
  client_id: string
  offre_id: string
  quantite: number
  montant_total: number
  lien_ticket?: string
  created_at?: string
}

interface VenteStore {
  clients: Client[]
  offres: OfferRow[]
  /**
   * Separate flags per resource. A single shared `isLoading` caused flicker:
   * loadClients and loadOffres run concurrently, and whichever finished first
   * flipped the flag to false while the other was still in flight.
   */
  clientsLoading: boolean
  offresLoading: boolean
  error: string | null
  loadClients: (kiosqueId: string) => Promise<{ success: boolean; error?: string }>
  loadOffres: (kiosqueId: string) => Promise<{ success: boolean; error?: string }>
  clearError: () => void
}

export const useVenteStore = create<VenteStore>((set) => ({
  clients: [],
  offres: [],
  clientsLoading: false,
  offresLoading: false,
  error: null,

  /**
   * Load clients for a specific kiosk
   */
  loadClients: async (kiosqueId: string) => {
    set({ clientsLoading: true, error: null })

    try {
      if (!kiosqueId) {
        set({ clientsLoading: false, error: 'ID de kiosque invalide' })
        return { success: false, error: 'ID de kiosque invalide' }
      }

      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, telephone, adresse, email, localite, type_client, nombre_personnes, contenant_prefere, preference_contact, accepte_offres, kiosque_id, created_at')
        .eq('kiosque_id', kiosqueId)
        .order('nom')

      if (error) {
        const errorMessage = handleSupabaseError(error)
        set({ clientsLoading: false, error: errorMessage })
        return { success: false, error: errorMessage }
      }

      set({ clients: data || [], clientsLoading: false })
      return { success: true }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur lors du chargement des clients'
      set({ clientsLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  /**
   * Load active offers for a specific kiosk
   */
  loadOffres: async (kiosqueId: string) => {
    set({ offresLoading: true, error: null })

    try {
      if (!kiosqueId) {
        set({ offresLoading: false, error: 'ID de kiosque invalide' })
        return { success: false, error: 'ID de kiosque invalide' }
      }

      const { data, error } = await supabase
        .from('offres_kiosque')
        .select(`
          offre_id,
          prix,
          est_actif,
          offres!inner(
            id,
            nom,
            volume_ml,
            description
          )
        `)
        .eq('kiosque_id', kiosqueId)
        .eq('est_actif', true)
        .order('offres(nom)')

      if (error) {
        const errorMessage = handleSupabaseError(error)
        set({ offresLoading: false, error: errorMessage })
        return { success: false, error: errorMessage }
      }

      // PostgREST types an embedded relation as an array even when the FK
      // guarantees a single row, so `offres` is narrowed back to one Offer here.
      type JoinedOffreRow = {
        offre_id: string
        prix: number
        est_actif: boolean
        offres: Offer | Offer[] | null
      }

      const rows: OfferRow[] = ((data ?? []) as unknown as JoinedOffreRow[])
        .map((row) => {
          const offre = Array.isArray(row.offres) ? row.offres[0] : row.offres
          if (!offre) return null
          return {
            offre_id: row.offre_id,
            prix: row.prix,
            est_actif: row.est_actif,
            offre,
          }
        })
        .filter((row): row is OfferRow => row !== null)

      set({ offres: rows, offresLoading: false })
      return { success: true }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur lors du chargement des offres'
      set({ offresLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  /**
   * Clear any error state
   */
  clearError: () => {
    set({ error: null })
  },
}))
