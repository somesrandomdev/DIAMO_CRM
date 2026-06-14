import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { FaPlus, FaUsers, FaTint, FaMoneyBillWave, FaStore, FaChartBar, FaTrophy, FaEdit, FaTrash } from 'react-icons/fa'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { toCFA } from '../utils/price'

type TabType = 'global' | 'kiosks' | 'offers' | 'pricing' | 'users'

interface Kiosk {
  id: string
  nom: string
  adresse?: string
}

interface Offer {
  id: string
  nom: string
  volume_ml?: number
  description?: string
}

interface Profile {
  id: string
  username: string
  role: string
  kiosque_id: string | null
  kiosques?: { id: string; nom: string }
}

interface GlobalStats {
  totalRevenue: number
  totalVolume: number
  totalClients: number
  totalKiosks: number
  topKiosks: Array<{
    name: string
    revenue: number
    volume: number
  }>
  revenueByKiosk: Array<{
    name: string
    value: number
  }>
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('global')
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalRevenue: 0,
    totalVolume: 0,
    totalClients: 0,
    totalKiosks: 0,
    topKiosks: [],
    revenueByKiosk: []
  })
  const [loading, setLoading] = useState(false)
  const { signOut } = useAuthStore()

  const tabs = [
    { id: 'global' as TabType, label: 'Vue Globale CEO', icon: <FaChartBar className="w-5 h-5" /> },
    { id: 'kiosks' as TabType, label: 'Kiosques', icon: <FaStore className="w-5 h-5" /> },
    { id: 'offers' as TabType, label: 'Offres', icon: <FaTint className="w-5 h-5" /> },
    { id: 'pricing' as TabType, label: 'Tarification', icon: <FaMoneyBillWave className="w-5 h-5" /> },
    { id: 'users' as TabType, label: 'Utilisateurs', icon: <FaUsers className="w-5 h-5" /> }
  ]

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (activeTab === 'global') {
      loadGlobalStats()
    } else if (activeTab === 'kiosks') {
      loadKiosks()
    } else if (activeTab === 'offers') {
      loadOffers()
    } else if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab])

  const loadInitialData = async () => {
    try {
      // Load basic data needed for all tabs
      await loadKiosks()
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const loadKiosks = async () => {
    try {
      const { data, error } = await supabase.from('kiosques').select('id, nom, adresse')
      if (error) {
        console.error('Error loading kiosks:', error)
        // Fallback to basic fields only
        const { data: fallbackData } = await supabase.from('kiosques').select('id, nom')
        if (fallbackData) setKiosks(fallbackData.map(k => ({ ...k, adresse: undefined })))
      } else if (data) {
        setKiosks(data)
      }
    } catch (error) {
      console.error('Error in loadKiosks:', error)
      // Try with minimal fields
      const { data: minimalData } = await supabase.from('kiosques').select('id, nom')
      if (minimalData) setKiosks(minimalData.map(k => ({ ...k, adresse: undefined })))
    }
  }

  const loadOffers = async () => {
    try {
      const { data, error } = await supabase.from('offres').select('*')
      if (error) {
        console.error('Error loading offers:', error)
      } else if (data) {
        setOffers(data)
      }
    } catch (error) {
      console.error('Error in loadOffers:', error)
    }
  }

  const loadUsers = async () => {
    try {
      // First load basic profile data
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*')
      if (profilesError) {
        console.error('Error loading users:', profilesError)
        return
      }

      if (profilesData) {
        // Load kiosk information for each profile that has a kiosque_id
        const profilesWithKiosks = await Promise.all(
          profilesData.map(async (profile) => {
            if (profile.kiosque_id) {
              try {
                const { data: kioskData } = await supabase
                  .from('kiosques')
                  .select('id, nom')
                  .eq('id', profile.kiosque_id)
                  .single()

                if (kioskData) {
                  return { ...profile, kiosques: kioskData }
                }
              } catch (kioskError) {
                console.error(`Error loading kiosk for profile ${profile.id}:`, kioskError)
              }
            }
            return profile
          })
        )

        setProfiles(profilesWithKiosks)
      }
    } catch (error) {
      console.error('Error in loadUsers:', error)
    }
  }

  const loadGlobalStats = async () => {
    try {
      // Get all kiosks count
      const { count: totalKiosks, error: kiosksError } = await supabase.from('kiosques').select('*', { count: 'exact', head: true })
      if (kiosksError) {
        console.error('Error getting kiosks count:', kiosksError)
      }

      // Get total revenue and volume from all sales
      const { data: allSales, error: salesError } = await supabase.from('ventes').select('montant_total, kiosque_id')
      if (salesError) {
        console.error('Error getting sales data:', salesError)
      }

      // Get total clients
      const { count: totalClients, error: clientsError } = await supabase.from('clients').select('*', { count: 'exact', head: true })
      if (clientsError) {
        console.error('Error getting clients count:', clientsError)
      }

      // Calculate totals
      const totalRevenue = allSales?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
      const totalVolume = allSales?.length || 0

      // Calculate revenue by kiosk
      const revenueByKioskMap: Record<string, number> = {}
      allSales?.forEach(sale => {
        revenueByKioskMap[sale.kiosque_id] = (revenueByKioskMap[sale.kiosque_id] || 0) + sale.montant_total
      })

      // Get kiosk names and create revenue data
      const revenueByKiosk = await Promise.all(
        Object.entries(revenueByKioskMap).map(async ([kioskId, revenue]) => {
          try {
            const { data: kiosk, error: kioskError } = await supabase.from('kiosques').select('nom').eq('id', kioskId).single()
            if (kioskError) {
              console.error(`Error getting kiosk ${kioskId}:`, kioskError)
              return {
                name: `Kiosque ${kioskId}`,
                value: revenue
              }
            }
            return {
              name: kiosk?.nom || 'Kiosque inconnu',
              value: revenue
            }
          } catch (error) {
            console.error(`Error in kiosk lookup for ${kioskId}:`, error)
            return {
              name: `Kiosque ${kioskId}`,
              value: revenue
            }
          }
        })
      )

      // Get top 5 kiosks by revenue
      const topKiosks = revenueByKiosk
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map(kiosk => ({
          name: kiosk.name,
          revenue: kiosk.value,
          volume: 0 // We'll calculate this if needed
        }))

      setGlobalStats({
        totalRevenue,
        totalVolume,
        totalClients: totalClients || 0,
        totalKiosks: totalKiosks || 0,
        topKiosks,
        revenueByKiosk
      })
    } catch (error) {
      console.error('Error loading global stats:', error)
      // Set default values in case of complete failure
      setGlobalStats({
        totalRevenue: 0,
        totalVolume: 0,
        totalClients: 0,
        totalKiosks: 0,
        topKiosks: [],
        revenueByKiosk: []
      })
    }
  }

  // CRUD Operations
  const handleCreateKiosk = () => {
    // Modal functionality removed
  }

  const handleEditKiosk = (_kiosk: Kiosk) => {
    // Modal functionality removed
  }

  const handleDeleteKiosk = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce kiosque?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('kiosques')
        .delete()
        .eq('id', id)

      if (error) throw error

      setKiosks(kiosks.filter(k => k.id !== id))
      alert('Kiosque supprimé avec succès!')
    } catch (error: any) {
      console.error('Error deleting kiosk:', error)
      alert('Erreur lors de la suppression: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOffer = () => {
    // Modal functionality removed
  }

  const handleEditOffer = (_offer: Offer) => {
    // Modal functionality removed
  }

  const handleDeleteOffer = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette offre?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('offres')
        .delete()
        .eq('id', id)

      if (error) throw error

      setOffers(offers.filter(o => o.id !== id))
      alert('Offre supprimée avec succès!')
    } catch (error: any) {
      console.error('Error deleting offer:', error)
      alert('Erreur lors de la suppression: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = () => {
    // Modal functionality removed
  }

  const handleEditUser = (_user: Profile) => {
    // Modal functionality removed
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)

      if (error) throw error

      setProfiles(profiles.filter(p => p.id !== id))
      alert('Utilisateur supprimé avec succès!')
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert('Erreur lors de la suppression: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  const renderTabContent = () => {
    switch (activeTab) {
      case 'global':
        return (
          <div className="space-y-6">
            {/* Global KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">CA Total</p>
                    <p className="text-2xl font-bold text-green-600">{toCFA(globalStats.totalRevenue)}</p>
                  </div>
                  <FaMoneyBillWave className="text-3xl text-green-600" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Volume Total</p>
                    <p className="text-2xl font-bold text-blue-600">{globalStats.totalVolume}</p>
                  </div>
                  <FaChartBar className="text-3xl text-blue-600" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Clients Actifs</p>
                    <p className="text-2xl font-bold text-purple-600">{globalStats.totalClients}</p>
                  </div>
                  <FaUsers className="text-3xl text-purple-600" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Nombre de Kiosques</p>
                    <p className="text-2xl font-bold text-orange-600">{globalStats.totalKiosks}</p>
                  </div>
                  <FaStore className="text-3xl text-orange-600" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Kiosk */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-xl font-semibold mb-4">CA par Kiosque</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={globalStats.revenueByKiosk}>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={toCFA} />
                    <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
                    <Bar dataKey="value" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Distribution Pie Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-xl font-semibold mb-4">Répartition du CA</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={globalStats.revenueByKiosk}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {globalStats.revenueByKiosk.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Kiosks */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FaTrophy className="text-yellow-500" />
                Top 5 Kiosques par Performance
              </h3>
              <div className="space-y-3">
                {globalStats.topKiosks.map((kiosk, index) => (
                  <div key={kiosk.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-yellow-500">#{index + 1}</span>
                      <span className="font-medium">{kiosk.name}</span>
                    </div>
                    <span className="font-bold text-green-600">{toCFA(kiosk.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'kiosks':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des Kiosques</h2>
              <button
                onClick={handleCreateKiosk}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Nouveau Kiosque
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {kiosks.map(kiosk => (
                    <tr key={kiosk.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{kiosk.nom}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{kiosk.adresse || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditKiosk(kiosk)}
                          disabled={loading}
                          aria-label="Modifier" title="Modifier" className="text-blue-600 hover:text-blue-900 mr-4 disabled:text-blue-400"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKiosk(kiosk.id)}
                          disabled={loading}
                          aria-label="Supprimer" title="Supprimer" className="text-red-600 hover:text-red-900 disabled:text-red-400"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'offers':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des Offres</h2>
              <button
                onClick={handleCreateOffer}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Nouvelle Offre
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {offers.map(offer => (
                    <tr key={offer.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{offer.nom}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{offer.volume_ml}ml</td>
                      <td className="px-6 py-4 text-gray-500">{offer.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditOffer(offer)}
                          disabled={loading}
                          aria-label="Modifier" title="Modifier" className="text-blue-600 hover:text-blue-900 mr-4 disabled:text-blue-400"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          disabled={loading}
                          aria-label="Supprimer" title="Supprimer" className="text-red-600 hover:text-red-900 disabled:text-red-400"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'pricing':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Tarification par Kiosque</h2>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                Sauvegarder les modifications
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-600 mb-4">Matrice de prix (kiosques × offres) - Fonctionnalité à développer</p>
              <div className="text-center py-8 text-gray-500">
                Interface de tarification en développement
              </div>
            </div>
          </div>
        )

      case 'users':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des Utilisateurs</h2>
              <button
                onClick={handleCreateUser}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Nouvel Utilisateur
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kiosque</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profiles.map(profile => (
                    <tr key={profile.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{profile.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          profile.role === 'administrateur' ? 'bg-purple-100 text-purple-800' :
                          profile.role === 'commercial' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {profile.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {profile.kiosques?.nom || 'Aucun'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditUser(profile)}
                          disabled={loading}
                          aria-label="Modifier" title="Modifier" className="text-blue-600 hover:text-blue-900 mr-4 disabled:text-blue-400"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(profile.id)}
                          disabled={loading}
                          aria-label="Supprimer" title="Supprimer" className="text-red-600 hover:text-red-900 disabled:text-red-400"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Administration</h1>
          <button
            onClick={() => signOut()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
          >
            Déconnexion
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}