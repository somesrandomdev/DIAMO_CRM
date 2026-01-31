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
  isLoading: boolean
  error: string | null
  loadClients: (kiosqueId: string) => Promise<{ success: boolean; error?: string }>
  loadOffres: (kiosqueId: string) => Promise<{ success: boolean; error?: string }>
  clearError: () => void
}

export const useVenteStore = create<VenteStore>((set) => ({
  clients: [],
  offres: [],
  isLoading: false,
  error: null,

  /**
   * Load clients for a specific kiosk
   */
  loadClients: async (kiosqueId: string) => {
    set({ isLoading: true, error: null })

    try {
      if (!kiosqueId) {
        set({ isLoading: false, error: 'ID de kiosque invalide' })
        return { success: false, error: 'ID de kiosque invalide' }
      }

      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, telephone, adresse, email, localite, type_client, nombre_personnes, contenant_prefere, preference_contact, accepte_offres, kiosque_id, created_at')
        .eq('kiosque_id', kiosqueId)
        .order('nom')

      if (error) {
        const errorMessage = handleSupabaseError(error)
        set({ isLoading: false, error: errorMessage })
        return { success: false, error: errorMessage }
      }

      set({ clients: data || [], isLoading: false })
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors du chargement des clients'
      set({ isLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  /**
   * Load active offers for a specific kiosk
   */
  loadOffres: async (kiosqueId: string) => {
    set({ isLoading: true, error: null })

    try {
      if (!kiosqueId) {
        set({ isLoading: false, error: 'ID de kiosque invalide' })
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
        set({ isLoading: false, error: errorMessage })
        return { success: false, error: errorMessage }
      }

      const rows: OfferRow[] = (data || []).map((row: any) => ({
        offre_id: row.offre_id,
        prix: row.prix,
        est_actif: row.est_actif,
        offre: row.offres,
      }))

      set({ offres: rows, isLoading: false })
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors du chargement des offres'
      set({ isLoading: false, error: errorMessage })
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
