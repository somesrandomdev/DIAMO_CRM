// src/pages/ClientListUltra.tsx
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { BackButton, LogoutButton } from '../components/NavControls'
import { toCFA } from '../utils/price'

type Client = {
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
  situation_familiale?: string
  notes?: string
}

type Vente = {
  id: string
  created_at: string
  montant_total: number
  quantite?: number
  lien_ticket?: string
  offre: { nom: string; volume_ml?: number } | null
}

export default function ClientListUltra({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const [clients, setClients] = useState<Client[]>([])
  const [selected, setSelected] = useState<Client | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])

  useEffect(() => {
    if (!profile) return

    if (!profile?.kiosque_id) {
      if (profile?.role === 'administrateur') {
        console.log('Admin user accessing client list - showing all clients')
        // For admin, show all clients
        supabase
          .from('clients')
          .select('*')
          .then(({ data }) => setClients(data || []))
      } else if (profile?.role === 'fontainier') {
        console.log('Fontainier without kiosk_id, redirecting to dashboard')
        onBack()
        return
      } else {
        console.log('No kiosk_id available and not admin or fontainier, redirecting to dashboard')
        onBack()
        return
      }
    } else {
      // Regular user with kiosk_id
      supabase
        .from('clients')
        .select('*')
        .eq('kiosque_id', profile.kiosque_id)
        .then(({ data }) => setClients(data || []))
    }
  }, [profile, onBack])

  async function loadVentes(clientId: string) {
    const { data } = await supabase
      .from('ventes')
      .select('id, created_at, montant_total, quantite, lien_ticket, offre:offres!inner(nom, volume_ml)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    // Transform the data to handle both array and object responses
    const transformedVentes = (data || []).map(v => ({
      ...v,
      offre: Array.isArray(v.offre) ? v.offre[0] || null : v.offre
    })) as Vente[]

    setVentes(transformedVentes)
  }

  function handleSelect(client: Client) {
    setSelected(client)
    loadVentes(client.id)
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex justify-between mb-4">
        <BackButton onBack={onBack} />
        <LogoutButton />
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>👥 Mes clients</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cliquez sur "Détails" pour voir l'historique des achats</p>
      </div>

      <div className="space-y-3">
        {clients.map((c) => (
          <div
            key={c.id}
            className="p-4 rounded-lg shadow-sm hover:shadow-md transition-all flex justify-between items-center"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{c.nom}</span>
              {c.telephone && <span className="ml-2" style={{ color: 'var(--color-text-secondary)' }}>• {c.telephone}</span>}
            </div>
            <button
              onClick={() => handleSelect(c)}
              className="px-4 py-2 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              Détails
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(28, 126, 214, 0.5)' }}>
          <div className="p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>👤 {selected.nom}</h3>

            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>📞 Téléphone:</span>
                  <span style={{ color: 'var(--color-text)' }}>{selected.telephone || 'Non renseigné'}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>🏠 Adresse:</span>
                  <span style={{ color: 'var(--color-text)' }}>{selected.adresse || 'Non renseignée'}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>👨‍👩‍👧‍👦 Situation:</span>
                  <span style={{ color: 'var(--color-text)' }}>{selected.situation_familiale || 'Non renseignée'}</span>
                </div>
                {selected.notes && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                    <span className="font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>📝 Notes:</span>
                    <span style={{ color: 'var(--color-text)' }}>{selected.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-6">
              {[
                ['Localite', selected.localite || 'Non renseignee'],
                ['Email', selected.email || 'Non renseigne'],
                ['Type', selected.type_client || 'Particulier'],
                ['Personnes', String(selected.nombre_personnes || 1)],
                ['Contenant', selected.contenant_prefere || 'Bouteille 10L'],
                ['Contact', selected.preference_contact || 'Telephone'],
                ['Offres', selected.accepte_offres ? 'Accepte' : 'Non accepte'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center gap-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}:</span>
                  <span className="text-right" style={{ color: label === 'Offres' && selected.accepte_offres ? 'var(--color-success)' : 'var(--color-text)' }}>{value}</span>
                </div>
              ))}
            </div>

            <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>🛒 Historique des achats</h4>
            {ventes.length > 0 ? (
              <div className="space-y-3">
                {ventes.slice(0, 5).map((v) => (
                  <div key={v.id} className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>📅 {v.created_at.slice(0, 10)}</span>
                      <span className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>{toCFA(v.montant_total)}</span>
                    </div>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>📦 {v.offre?.nom || 'Offre inconnue'}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Qte {v.quantite || 1}
                      {v.offre?.volume_ml ? ` - ${v.offre.volume_ml / 1000}L` : ''}
                      {v.lien_ticket ? ' - Ticket disponible' : ''}
                    </p>
                  </div>
                ))}
                {ventes.length > 5 && <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>... et {ventes.length - 5} autres achats</p>}
              </div>
            ) : (
              <p className="text-center py-4 italic" style={{ color: 'var(--color-text-secondary)' }}>Aucun achat enregistré pour ce client</p>
            )}

            <button
              onClick={() => { setSelected(null); setVentes([]) }}
              className="mt-6 w-full py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
              style={{
                backgroundColor: 'var(--color-secondary)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-secondary)'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
