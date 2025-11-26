// src/stores/venteStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

type Client = {
  id: string
  nom: string
  telephone?: string
  adresse?: string
}

type OfferRow = {
  offre_id: string
  prix: number
  est_actif: boolean
  offre: {
    id: string
    nom: string
    volume_ml?: number
    description?: string
  }
}

type VenteStore = {
  clients: Client[]
  offres: OfferRow[]
  loadClients: (kiosqueId: string) => Promise<void>
  loadOffres: (kiosqueId: string) => Promise<void>
}

export const useVenteStore = create<VenteStore>((set) => ({
  clients: [],
  offres: [],

  /* 1️⃣  clients for this kiosk */
  loadClients: async (kiosqueId) => {
    const { data } = await supabase
      .from('clients')
      .select('id, nom, telephone, adresse')
      .eq('kiosque_id', kiosqueId)
      .order('nom')
    set({ clients: data || [] })
  },

  /* 2️⃣  active prices + global offer data for this kiosk */
loadOffres: async (kiosqueId) => {
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

  if (error) console.error('Supabase fetch error', error)
  const rows = (data || []).map((row: any) => ({
    offre_id: row.offre_id,
    prix: row.prix,
    est_actif: row.est_actif,
    offre: row.offres,
  }))
  set({ offres: rows })
}
}))