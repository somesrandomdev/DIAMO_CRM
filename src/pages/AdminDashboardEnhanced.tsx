import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { FaPlus, FaUsers, FaTint, FaMoneyBillWave, FaStore, FaChartBar, FaTrophy, FaEdit, FaTrash } from 'react-icons/fa'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { toCFA } from '../utils/price'

interface Kiosk {
  id: string
  nom: string
  adresse?: string
  latitude?: number
  longitude?: number
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
    id: string
    name: string
    value: number
  }>
}

type TabType = 'global' | 'kiosks' | 'offers' | 'pricing' | 'users' | 'objectives'

export default function AdminDashboardEnhanced() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('global')

  // Determine active tab based on current route
  useEffect(() => {
    const path = location.pathname
    if (path === '/vue-globale') setActiveTab('global')
    else if (path === '/kiosques') setActiveTab('kiosks')
    else if (path === '/offres') setActiveTab('offers')
    else if (path === '/tarifs') setActiveTab('pricing')
    else if (path === '/objectifs') setActiveTab('objectives')
    else if (path === '/utilisateurs') setActiveTab('users')
    else if (path === '/donnees-globales') setActiveTab('global')
    else setActiveTab('global')
  }, [location.pathname])
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
  const [showKioskModal, setShowKioskModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [kioskForm, setKioskForm] = useState({ nom: '', adresse: '' })
  const [offerForm, setOfferForm] = useState({ nom: '', volume_ml: '', description: '' })
  const [userForm, setUserForm] = useState({ username: '', role: 'fontainier', kiosque_id: '' })

  // Pricing matrix state
  const [pricingMatrix, setPricingMatrix] = useState<Record<string, Record<string, number>>>({})
  const [bulkPricing, setBulkPricing] = useState({ offerId: '', kioskId: '', price: '', selectedKiosks: [] as string[] })

  // Objectives state
  const [objectives, setObjectives] = useState<Record<string, { monthly: number; daily: number }>>({})
  const [objectivesForm, setObjectivesForm] = useState({ kioskId: '', monthly: '', daily: '' })

  // Filtering state for global data
   const [globalFilters, setGlobalFilters] = useState({
     kioskId: '',
     timePeriod: 'month' as 'day' | 'week' | 'month'
   })
   const [filteredGlobalStats, setFilteredGlobalStats] = useState<GlobalStats>(globalStats)


  const { signOut } = useAuthStore()

  const tabs = [
    { id: 'global' as TabType, label: 'Vue Globale CEO', icon: <FaChartBar className="w-5 h-5" /> },
    { id: 'kiosks' as TabType, label: 'Kiosques', icon: <FaStore className="w-5 h-5" /> },
    { id: 'offers' as TabType, label: 'Offres', icon: <FaTint className="w-5 h-5" /> },
    { id: 'pricing' as TabType, label: 'Tarification', icon: <FaMoneyBillWave className="w-5 h-5" /> },
    { id: 'objectives' as TabType, label: 'Objectifs', icon: <FaTrophy className="w-5 h-5" /> },
    { id: 'users' as TabType, label: 'Utilisateurs', icon: <FaUsers className="w-5 h-5" /> }
  ]

  useEffect(() => {
    loadInitialData()
  }, [])

  // Update filtered stats when global stats or filters change
  useEffect(() => {
    if (globalStats && globalStats.revenueByKiosk) {
      applyGlobalFilters()
    }
  }, [globalStats, globalFilters])


  useEffect(() => {
    if (activeTab === 'global') {
      loadGlobalStats()
    } else if (activeTab === 'kiosks') {
      loadKiosks()
    } else if (activeTab === 'offers') {
      loadOffers()
    } else if (activeTab === 'pricing') {
      loadPricingMatrix()
    } else if (activeTab === 'objectives') {
      loadObjectives()
    } else if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab, globalFilters.timePeriod, globalFilters.kioskId])

  const loadInitialData = async () => {
    try {
      // Load kiosks first as they're needed for user creation
      await loadKiosks()
      await loadOffers()
      await loadPricingMatrix()
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }


  const loadPricingMatrix = async () => {
    try {
      const { data, error } = await supabase
        .from('offres_kiosque')
        .select('kiosque_id, offre_id, prix')

      if (error) {
        console.error('Error loading pricing matrix:', error)
        return
      }

      // Transform data into matrix format
      const matrix: Record<string, Record<string, number>> = {}
      data?.forEach(item => {
        if (!matrix[item.kiosque_id]) {
          matrix[item.kiosque_id] = {}
        }
        matrix[item.kiosque_id][item.offre_id] = item.prix
      })

      setPricingMatrix(matrix)
    } catch (error) {
      console.error('Error in loadPricingMatrix:', error)
    }
  }

  const loadKiosks = async () => {
    try {
      const { data, error } = await supabase.from('kiosques').select('id, nom, adresse')
      if (error) {
        console.error('Error loading kiosks:', error)
        const { data: fallbackData } = await supabase.from('kiosques').select('id, nom')
        if (fallbackData) setKiosks(fallbackData.map(k => ({ ...k, adresse: undefined })))
      } else if (data) {
        setKiosks(data)
      }
    } catch (error) {
      console.error('Error in loadKiosks:', error)
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
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*')
      if (profilesError) {
        console.error('Error loading users:', profilesError)
        return
      }

      if (profilesData) {
        let kioskMap: Record<string, { id: string; nom: string }> = {}
        const kioskIds = Array.from(new Set(profilesData.map(p => p.kiosque_id).filter(Boolean))) as string[]

        if (kioskIds.length > 0) {
          try {
            const { data: kiosksData, error: kiosksError } = await supabase
              .from('kiosques')
              .select('id, nom')
              .in('id', kioskIds)

            if (kiosksError) {
              console.error('Error loading kiosks in batch:', kiosksError)
            } else if (kiosksData) {
              kioskMap = Object.fromEntries(kiosksData.map(k => [k.id, k]))
            }
          } catch (kioskError) {
            console.error('Error executing batch kiosk fetch:', kioskError)
          }
        }

        const profilesWithKiosks = profilesData.map((profile) => {
          if (profile.kiosque_id && kioskMap[profile.kiosque_id]) {
            return { ...profile, kiosques: kioskMap[profile.kiosque_id] }
          }
          return profile
        })

        setProfiles(profilesWithKiosks)
      }
    } catch (error) {
      console.error('Error in loadUsers:', error)
    }
  }


  const loadObjectives = async () => {
    try {
      // For now, we'll use localStorage to store objectives
      // In a real app, this would be stored in the database
      const storedObjectives = localStorage.getItem('kiosk_objectives')
      if (storedObjectives) {
        setObjectives(JSON.parse(storedObjectives))
      }
    } catch (error) {
      console.error('Error loading objectives:', error)
    }
  }

  const loadGlobalStats = async () => {
    try {
      const { count: totalKiosks, error: kiosksError } = await supabase.from('kiosques').select('*', { count: 'exact', head: true })
      if (kiosksError) {
        console.error('Error getting kiosks count:', kiosksError)
      }

      // Calculate date range based on time period filter
      const now = new Date()
      let startDate: Date

      switch (globalFilters.timePeriod) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay())
          startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      // Prevent unnecessary API calls if filters haven't changed significantly
      if (globalFilters.timePeriod === 'month' && startDate.getMonth() === now.getMonth()) {
        // For current month, we might want to limit the query to avoid too much data
        // For now, we'll proceed but this could be optimized
      }

      // Get filtered sales data
      let salesQuery = supabase.from('ventes').select('montant_total, kiosque_id, created_at')

      // Apply date filter if not showing all time
      if (globalFilters.timePeriod !== 'month' || startDate.getMonth() !== now.getMonth()) {
        salesQuery = salesQuery.gte('created_at', startDate.toISOString())
      }

      const { data: allSales, error: salesError } = await salesQuery
      if (salesError) {
        console.error('Error getting sales data:', salesError)
      }

      // Get filtered clients data
      const clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true })

      // Apply date filter for clients if needed (clients don't have created_at, so we'll use a different approach)
      // For now, we'll get all clients since we don't have a reliable way to filter by creation date

      const { count: totalClients, error: clientsError } = await clientsQuery
      if (clientsError) {
        console.error('Error getting clients count:', clientsError)
      }

      const totalRevenue = allSales?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
      const totalVolume = allSales?.length || 0

      const revenueByKioskMap: Record<string, number> = {}
      allSales?.forEach(sale => {
        revenueByKioskMap[sale.kiosque_id] = (revenueByKioskMap[sale.kiosque_id] || 0) + sale.montant_total
      })

      const kioskIds = Object.keys(revenueByKioskMap)
      let kioskNames: Record<string, string> = {}

      if (kioskIds.length > 0) {
        try {
          const { data: kiosks, error: kiosksError } = await supabase.from('kiosques').select('id, nom').in('id', kioskIds)
          if (kiosksError) {
            console.error('Error getting kiosks for names:', kiosksError)
          } else if (kiosks) {
            kioskNames = kiosks.reduce((acc: Record<string, string>, k) => {
              acc[k.id] = k.nom || 'Kiosque inconnu'
              return acc
            }, {})
          }
        } catch (error) {
          console.error('Error in kiosks lookup:', error)
        }
      }

      const revenueByKiosk = Object.entries(revenueByKioskMap).map(([kioskId, revenue]) => {
        return {
          id: kioskId,
          name: kioskNames[kioskId] || `Kiosque ${kioskId}`,
          value: revenue
        }
      })
      let kioskNamesMap: Record<string, string> = {}

      if (kioskIds.length > 0) {
        try {
          const { data: kiosks, error: kiosksError } = await supabase
            .from('kiosques')
            .select('id, nom')
            .in('id', kioskIds)

          if (kiosksError) {
            console.error('Error getting kiosks:', kiosksError)
          } else if (kiosks) {
            kioskNamesMap = kiosks.reduce((acc, kiosk) => {
              acc[kiosk.id] = kiosk.nom
              return acc
            }, {} as Record<string, string>)
          }
        } catch (error) {
          console.error('Error in bulk kiosk lookup:', error)
        }
      }

      const revenueByKiosk = Object.entries(revenueByKioskMap).map(([kioskId, revenue]) => ({
        id: kioskId,
        name: kioskNamesMap[kioskId] || `Kiosque ${kioskId}`,
        value: revenue
      }))

      const topKiosks = revenueByKiosk
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map(kiosk => ({
          name: kiosk.name,
          revenue: kiosk.value,
          volume: 0
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
    setEditingItem(null)
    setKioskForm({ nom: '', adresse: '' })
    setShowKioskModal(true)
  }

  const handleEditKiosk = (kiosk: Kiosk) => {
    setEditingItem(kiosk)
    setKioskForm({ nom: kiosk.nom, adresse: kiosk.adresse || '' })
    setShowKioskModal(true)
  }

  const handleSaveKiosk = async () => {
    if (!kioskForm.nom.trim()) {
      alert('Le nom du kiosque est requis')
      return
    }

    setLoading(true)
    try {
      if (editingItem) {
        // Update existing kiosk
        const { error } = await supabase
          .from('kiosques')
          .update({
            nom: kioskForm.nom,
            adresse: kioskForm.adresse || null
          })
          .eq('id', editingItem.id)

        if (error) throw error

        setKiosks(kiosks.map(k =>
          k.id === editingItem.id
            ? { ...k, nom: kioskForm.nom, adresse: kioskForm.adresse }
            : k
        ))
        alert('Kiosque modifié avec succès!')
      } else {
        // Create new kiosk
        const { data, error } = await supabase
          .from('kiosques')
          .insert({
            nom: kioskForm.nom,
            adresse: kioskForm.adresse || null
          })
          .select()
          .single()

        if (error) throw error

        setKiosks([...kiosks, data])
        alert('Kiosque créé avec succès!')
      }

      setShowKioskModal(false)
      setEditingItem(null)
    } catch (error: any) {
      console.error('Error saving kiosk:', error)
      alert('Erreur lors de la sauvegarde: ' + error.message)
    } finally {
      setLoading(false)
    }
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
    setEditingItem(null)
    setOfferForm({ nom: '', volume_ml: '', description: '' })
    setShowOfferModal(true)
  }

  const handleEditOffer = (offer: Offer) => {
    setEditingItem(offer)
    setOfferForm({
      nom: offer.nom,
      volume_ml: offer.volume_ml?.toString() || '',
      description: offer.description || ''
    })
    setShowOfferModal(true)
  }

  const handleSaveOffer = async () => {
    if (!offerForm.nom.trim()) {
      alert('Le nom de l\'offre est requis')
      return
    }

    setLoading(true)
    try {
      if (editingItem) {
        // Update existing offer
        const { error } = await supabase
          .from('offres')
          .update({
            nom: offerForm.nom,
            volume_ml: offerForm.volume_ml ? parseInt(offerForm.volume_ml) : null,
            description: offerForm.description || null
          })
          .eq('id', editingItem.id)

        if (error) throw error

        setOffers(offers.map(o =>
          o.id === editingItem.id
            ? {
                ...o,
                nom: offerForm.nom,
                volume_ml: offerForm.volume_ml ? parseInt(offerForm.volume_ml) : undefined,
                description: offerForm.description
              }
            : o
        ))
        alert('Offre modifiée avec succès!')
      } else {
        // Create new offer
        const { data, error } = await supabase
          .from('offres')
          .insert({
            nom: offerForm.nom,
            volume_ml: offerForm.volume_ml ? parseInt(offerForm.volume_ml) : null,
            description: offerForm.description || null
          })
          .select()
          .single()

        if (error) throw error

        setOffers([...offers, data])
        alert('Offre créée avec succès!')
      }

      setShowOfferModal(false)
      setEditingItem(null)
    } catch (error: any) {
      console.error('Error saving offer:', error)
      alert('Erreur lors de la sauvegarde: ' + error.message)
    } finally {
      setLoading(false)
    }
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
    setEditingItem(null)
    setUserForm({ username: '', role: 'fontainier', kiosque_id: '' })
    setShowUserModal(true)
  }

  const handleEditUser = (user: Profile) => {
    setEditingItem(user)
    setUserForm({
      username: user.username,
      role: user.role,
      kiosque_id: user.kiosque_id || ''
    })
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    if (!userForm.username.trim()) {
      alert('Le nom d\'utilisateur est requis')
      return
    }

    setLoading(true)
    try {
      if (editingItem) {
        // Update existing user
        const { error } = await supabase
          .from('profiles')
          .update({
            username: userForm.username,
            role: userForm.role,
            kiosque_id: userForm.kiosque_id || null
          })
          .eq('id', editingItem.id)

        if (error) throw error

        setProfiles(profiles.map(p =>
          p.id === editingItem.id
            ? {
                ...p,
                username: userForm.username,
                role: userForm.role,
                kiosque_id: userForm.kiosque_id || null
              }
            : p
        ))
        alert('Utilisateur modifié avec succès!')
      } else {
        // Create new user - Note: This would typically involve creating an auth user first
        // For now, we'll just create the profile (assuming auth user exists)
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            username: userForm.username,
            role: userForm.role,
            kiosque_id: userForm.kiosque_id || null
          })
          .select()
          .single()

        if (error) throw error

        setProfiles([...profiles, data])
        alert('Utilisateur créé avec succès!')
      }

      setShowUserModal(false)
      setEditingItem(null)
    } catch (error: any) {
      console.error('Error saving user:', error)
      alert('Erreur lors de la sauvegarde: ' + error.message)
    } finally {
      setLoading(false)
    }
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

  // Objectives Management Functions
  const handleSaveObjectives = async () => {
    if (!objectivesForm.kioskId || !objectivesForm.monthly || !objectivesForm.daily) {
      alert('Veuillez remplir tous les champs')
      return
    }

    setLoading(true)
    try {
      const monthly = parseFloat(objectivesForm.monthly)
      const daily = parseFloat(objectivesForm.daily)

      if (monthly <= 0 || daily <= 0) {
        alert('Les objectifs doivent être positifs')
        return
      }

      const newObjectives = {
        ...objectives,
        [objectivesForm.kioskId]: { monthly, daily }
      }

      setObjectives(newObjectives)
      localStorage.setItem('kiosk_objectives', JSON.stringify(newObjectives))

      setObjectivesForm({ kioskId: '', monthly: '', daily: '' })
      alert('Objectifs sauvegardés avec succès!')
    } catch (error: any) {
      console.error('Error saving objectives:', error)
      alert('Erreur lors de la sauvegarde: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteObjectives = async (kioskId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer les objectifs de ce kiosque?')) return

    setLoading(true)
    try {
      const newObjectives = { ...objectives }
      delete newObjectives[kioskId]

      setObjectives(newObjectives)
      localStorage.setItem('kiosk_objectives', JSON.stringify(newObjectives))

      alert('Objectifs supprimés avec succès!')
    } catch (error: any) {
      console.error('Error deleting objectives:', error)
      alert('Erreur lors de la suppression: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Global Data Filtering Functions
  const applyGlobalFilters = () => {
    if (!globalStats || !globalStats.revenueByKiosk) {
      setFilteredGlobalStats(globalStats)
      return
    }

    const filtered = { ...globalStats }

    // Filter by kiosk
    if (globalFilters.kioskId) {
      filtered.revenueByKiosk = globalStats.revenueByKiosk.filter(kiosk => {
        // Use the kiosk ID directly from the revenue data
        return kiosk.id === globalFilters.kioskId
      })
      filtered.totalRevenue = filtered.revenueByKiosk.reduce((sum, kiosk) => sum + kiosk.value, 0)
      filtered.totalVolume = 0 // We'll need to calculate this based on filtered sales
      filtered.totalClients = 0 // We'll need to calculate this based on filtered clients
    }

    // Update top kiosks based on filtered data
    filtered.topKiosks = filtered.revenueByKiosk
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(kiosk => ({
        name: kiosk.name,
        revenue: kiosk.value,
        volume: 0
      }))

    setFilteredGlobalStats(filtered)
  }

  const resetGlobalFilters = () => {
    setGlobalFilters({
      kioskId: '',
      timePeriod: 'month'
    })
    setFilteredGlobalStats(globalStats)
  }

  // Pricing Matrix Operations
  const handlePriceChange = (kioskId: string, offerId: string, price: string) => {
    const numericPrice = price === '' ? 0 : parseFloat(price) || 0
    setPricingMatrix(prev => ({
      ...prev,
      [kioskId]: {
        ...prev[kioskId],
        [offerId]: numericPrice
      }
    }))
  }

  const handleSavePricingMatrix = async () => {
    setLoading(true)
    try {
      // Prepare all pricing updates
      const updates = []

      for (const kioskId of Object.keys(pricingMatrix)) {
        for (const offerId of Object.keys(pricingMatrix[kioskId])) {
          const price = pricingMatrix[kioskId][offerId]
          if (price > 0) {
            updates.push({
              kiosque_id: kioskId,
              offre_id: offerId,
              prix: price,
              est_actif: true
            })
          }
        }
      }

      if (updates.length === 0) {
        alert('Aucun prix à sauvegarder')
        return
      }

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('offres_kiosque')
        .upsert(updates, {
          onConflict: 'kiosque_id,offre_id',
          ignoreDuplicates: false
        })

      if (error) throw error

      alert(`Prix sauvegardés avec succès! (${updates.length} mises à jour)`)
    } catch (error: any) {
      console.error('Error saving pricing matrix:', error)
      alert('Erreur lors de la sauvegarde: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkPricing = async () => {
    if (!bulkPricing.price || (!bulkPricing.offerId && !bulkPricing.kioskId && bulkPricing.selectedKiosks.length === 0)) {
      alert('Veuillez sélectionner une offre ou un kiosque et saisir un prix')
      return
    }

    setLoading(true)
    try {
      const updates = []
      const price = parseFloat(bulkPricing.price)

      if (bulkPricing.offerId && !bulkPricing.kioskId && bulkPricing.selectedKiosks.length === 0) {
        // Apply to all kiosks for selected offer
        for (const kiosk of kiosks) {
          updates.push({
            kiosque_id: kiosk.id,
            offre_id: bulkPricing.offerId,
            prix: price,
            est_actif: true
          })
        }
      } else if (bulkPricing.kioskId && !bulkPricing.offerId && bulkPricing.selectedKiosks.length === 0) {
        // Apply to all offers for selected kiosk
        for (const offer of offers) {
          updates.push({
            kiosque_id: bulkPricing.kioskId,
            offre_id: offer.id,
            prix: price,
            est_actif: true
          })
        }
      } else if (bulkPricing.selectedKiosks.length > 0 && bulkPricing.offerId) {
        // Apply to selected kiosks for selected offer
        for (const kioskId of bulkPricing.selectedKiosks) {
          updates.push({
            kiosque_id: kioskId,
            offre_id: bulkPricing.offerId,
            prix: price,
            est_actif: true
          })
        }
      }

      if (updates.length === 0) {
        alert('Aucune mise à jour à effectuer')
        return
      }

      const { error } = await supabase
        .from('offres_kiosque')
        .upsert(updates, {
          onConflict: 'kiosque_id,offre_id',
          ignoreDuplicates: false
        })

      if (error) throw error

      // Reload pricing matrix
      await loadPricingMatrix()

      alert(`Prix appliqués avec succès! (${updates.length} mises à jour)`)
      setBulkPricing({ offerId: '', kioskId: '', price: '', selectedKiosks: [] })
    } catch (error: any) {
      console.error('Error applying bulk pricing:', error)
      alert('Erreur lors de l\'application: ' + error.message)
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
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Filtres</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Période
                  </label>
                  <select
                    value={globalFilters.timePeriod}
                    onChange={(e) => setGlobalFilters({ ...globalFilters, timePeriod: e.target.value as 'day' | 'week' | 'month' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="day">Aujourd'hui</option>
                    <option value="week">Cette semaine</option>
                    <option value="month">Ce mois</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kiosque
                  </label>
                  <select
                    value={globalFilters.kioskId}
                    onChange={(e) => setGlobalFilters({ ...globalFilters, kioskId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tous les kiosques</option>
                    {kiosks.map(kiosk => (
                      <option key={kiosk.id} value={kiosk.id}>{kiosk.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={resetGlobalFilters}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            </div>

            {/* Global KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="kpi-card bg-gradient-success">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label text-green-700">CA Total</p>
                    <p className="text-xs text-green-600 mb-1 font-medium">
                      {globalFilters.timePeriod === 'day' ? "Aujourd'hui" :
                       globalFilters.timePeriod === 'week' ? "Cette semaine" : "Ce mois"}
                    </p>
                    <p className="kpi-value text-green-800">{toCFA(filteredGlobalStats.totalRevenue)}</p>
                  </div>
                  <FaMoneyBillWave className="text-4xl text-green-600 icon-enhanced" />
                </div>
              </div>
              <div className="kpi-card bg-gradient-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label text-blue-700">Volume Total</p>
                    <p className="text-xs text-blue-600 mb-1 font-medium">
                      {globalFilters.timePeriod === 'day' ? "Aujourd'hui" :
                       globalFilters.timePeriod === 'week' ? "Cette semaine" : "Ce mois"}
                    </p>
                    <p className="kpi-value text-blue-800">{filteredGlobalStats.totalVolume}</p>
                  </div>
                  <FaChartBar className="text-4xl text-blue-600 icon-enhanced" />
                </div>
              </div>
              <div className="kpi-card bg-gradient-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label text-purple-700">Clients Actifs</p>
                    <p className="text-xs text-purple-600 mb-1 font-medium">
                      {globalFilters.timePeriod === 'day' ? "Aujourd'hui" :
                       globalFilters.timePeriod === 'week' ? "Cette semaine" : "Ce mois"}
                    </p>
                    <p className="kpi-value text-purple-800">{filteredGlobalStats.totalClients}</p>
                  </div>
                  <FaUsers className="text-4xl text-purple-600 icon-enhanced" />
                </div>
              </div>
              <div className="kpi-card bg-gradient-warning">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="kpi-label text-orange-700">Kiosques</p>
                    <p className="text-xs text-orange-600 mb-1 font-medium">
                      {globalFilters.kioskId ? `Kiosque: ${kiosks.find(k => k.id === globalFilters.kioskId)?.nom}` : "Tous les kiosques"}
                    </p>
                    <p className="kpi-value text-orange-800">
                      {globalFilters.kioskId ? 1 : kiosks.length}
                    </p>
                  </div>
                  <FaStore className="text-4xl text-orange-600 icon-enhanced" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Kiosk */}
              <div className="chart-container">
                <h3 className="text-xl font-semibold mb-4 text-primary">CA par Kiosque</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredGlobalStats.revenueByKiosk}>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={toCFA} />
                    <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
                    <Bar dataKey="value" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Distribution Pie Chart */}
              <div className="chart-container">
                <h3 className="text-xl font-semibold mb-4 text-primary">Répartition du CA</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={filteredGlobalStats.revenueByKiosk}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {filteredGlobalStats.revenueByKiosk.map((entry, index) => (
                        <Cell key={`cell-${entry.id}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Kiosks */}
            <div className="chart-container">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-primary">
                <FaTrophy className="text-yellow-500 icon-enhanced" />
                Top Kiosques par Performance
              </h3>
              <div className="space-y-3">
                {filteredGlobalStats.topKiosks.map((kiosk, index) => (
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
                          className="text-blue-600 hover:text-blue-900 mr-4 disabled:text-blue-400"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKiosk(kiosk.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 disabled:text-red-400"
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
                          className="text-blue-600 hover:text-blue-900 mr-4 disabled:text-blue-400"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 disabled:text-red-400"
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
              <button
                onClick={handleSavePricingMatrix}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
              >
                {loading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Matrice de prix (kiosques × offres)</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Définissez les prix pour chaque offre dans chaque kiosque
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kiosque / Offre
                      </th>
                      {offers.map(offer => (
                        <th key={offer.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {offer.nom}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {kiosks.map(kiosk => (
                      <tr key={kiosk.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{kiosk.nom}</div>
                          {kiosk.adresse && (
                            <div className="text-sm text-gray-500">{kiosk.adresse}</div>
                          )}
                        </td>
                        {offers.map(offer => (
                          <td key={offer.id} className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              value={pricingMatrix[kiosk.id]?.[offer.id] || ''}
                              onChange={(e) => handlePriceChange(kiosk.id, offer.id, e.target.value)}
                              placeholder="Prix"
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="0.01"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <p>• Prix en CFA</p>
                    <p>• Laissez vide pour utiliser le prix par défaut</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                      Annuler
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Appliquer les prix
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Actions groupées</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Appliquer à tous les kiosques
                    </label>
                    <select
                      value={bulkPricing.offerId}
                      onChange={(e) => setBulkPricing({ ...bulkPricing, offerId: e.target.value, kioskId: '', selectedKiosks: [] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner une offre</option>
                      {offers.map(offer => (
                        <option key={offer.id} value={offer.id}>{offer.nom}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={bulkPricing.price}
                      onChange={(e) => setBulkPricing({ ...bulkPricing, price: e.target.value })}
                      placeholder="Prix CFA"
                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Appliquer à un kiosque
                    </label>
                    <select
                      value={bulkPricing.kioskId}
                      onChange={(e) => setBulkPricing({ ...bulkPricing, kioskId: e.target.value, offerId: '', selectedKiosks: [] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un kiosque</option>
                      {kiosks.map(kiosk => (
                        <option key={kiosk.id} value={kiosk.id}>{kiosk.nom}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={bulkPricing.price}
                      onChange={(e) => setBulkPricing({ ...bulkPricing, price: e.target.value })}
                      placeholder="Prix CFA"
                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleBulkPricing}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400"
                    >
                      {loading ? 'Application...' : 'Appliquer'}
                    </button>
                  </div>
                </div>

                {/* Multiple Kiosks Selection */}
                <div className="border-t pt-6">
                  <h4 className="text-md font-semibold mb-3">Appliquer à plusieurs kiosques</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sélectionner les kiosques
                      </label>
                      <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                        {kiosks.map(kiosk => (
                          <label key={kiosk.id} className="flex items-center space-x-2 mb-2">
                            <input
                              type="checkbox"
                              checked={bulkPricing.selectedKiosks.includes(kiosk.id)}
                              onChange={(e) => {
                                const newSelected = e.target.checked
                                  ? [...bulkPricing.selectedKiosks, kiosk.id]
                                  : bulkPricing.selectedKiosks.filter(id => id !== kiosk.id)
                                setBulkPricing({ ...bulkPricing, selectedKiosks: newSelected, kioskId: '', offerId: '' })
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{kiosk.nom}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Offre et prix
                      </label>
                      <select
                        value={bulkPricing.offerId}
                        onChange={(e) => setBulkPricing({ ...bulkPricing, offerId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      >
                        <option value="">Sélectionner une offre</option>
                        {offers.map(offer => (
                          <option key={offer.id} value={offer.id}>{offer.nom}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={bulkPricing.price}
                        onChange={(e) => setBulkPricing({ ...bulkPricing, price: e.target.value })}
                        placeholder="Prix CFA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={() => {
                          if (bulkPricing.selectedKiosks.length > 0 && bulkPricing.offerId && bulkPricing.price) {
                            handleBulkPricing()
                          } else {
                            alert('Veuillez sélectionner des kiosques, une offre et un prix')
                          }
                        }}
                        disabled={loading || bulkPricing.selectedKiosks.length === 0 || !bulkPricing.offerId || !bulkPricing.price}
                        className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                      >
                        {loading ? 'Application...' : `Appliquer à ${bulkPricing.selectedKiosks.length} kiosque(s)`}
                      </button>
                    </div>
                  </div>
                </div>
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
                          className="text-blue-600 hover:text-blue-900 mr-4 disabled:text-blue-400"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(profile.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 disabled:text-red-400"
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

      case 'objectives':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des Objectifs</h2>
              <button
                onClick={() => setObjectivesForm({ kioskId: '', monthly: '', daily: '' })}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Définir Objectif
              </button>
            </div>

            {/* Objectives Form */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Définir les objectifs par kiosque</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kiosque *
                  </label>
                  <select
                    value={objectivesForm.kioskId}
                    onChange={(e) => setObjectivesForm({ ...objectivesForm, kioskId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un kiosque</option>
                    {kiosks.map(kiosk => (
                      <option key={kiosk.id} value={kiosk.id}>{kiosk.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Objectif Mensuel (CFA) *
                  </label>
                  <input
                    type="number"
                    value={objectivesForm.monthly}
                    onChange={(e) => setObjectivesForm({ ...objectivesForm, monthly: e.target.value })}
                    placeholder="Ex: 500000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Objectif Journalier (CFA) *
                  </label>
                  <input
                    type="number"
                    value={objectivesForm.daily}
                    onChange={(e) => setObjectivesForm({ ...objectivesForm, daily: e.target.value })}
                    placeholder="Ex: 25000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSaveObjectives}
                  disabled={loading || !objectivesForm.kioskId || !objectivesForm.monthly || !objectivesForm.daily}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {loading ? 'Sauvegarde...' : 'Sauvegarder Objectif'}
                </button>
              </div>
            </div>

            {/* Current Objectives */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Objectifs Actuels par Kiosque</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Objectifs mensuels et journaliers définis pour chaque kiosque
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kiosque</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Objectif Mensuel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Objectif Journalier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {kiosks.map(kiosk => {
                      const kioskObjectives = objectives[kiosk.id]
                      return (
                        <tr key={kiosk.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{kiosk.nom}</div>
                            {kiosk.adresse && (
                              <div className="text-sm text-gray-500">{kiosk.adresse}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {kioskObjectives ? (
                              <span className="text-green-600 font-semibold">
                                {toCFA(kioskObjectives.monthly)}
                              </span>
                            ) : (
                              <span className="text-gray-400">Non défini</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {kioskObjectives ? (
                              <span className="text-blue-600 font-semibold">
                                {toCFA(kioskObjectives.daily)}
                              </span>
                            ) : (
                              <span className="text-gray-400">Non défini</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {kioskObjectives && (
                              <button
                                onClick={() => handleDeleteObjectives(kiosk.id)}
                                disabled={loading}
                                className="text-red-600 hover:text-red-900 disabled:text-red-400"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
              {tabs.map(tab => {
                const getTabPath = (tabId: TabType) => {
                  switch (tabId) {
                    case 'global': return '/vue-globale'
                    case 'kiosks': return '/kiosques'
                    case 'offers': return '/offres'
                    case 'pricing': return '/tarifs'
                    case 'objectives': return '/objectifs'
                    case 'users': return '/utilisateurs'
                    default: return '/vue-globale'
                  }
                }

                return (
                  <button
                    key={tab.id}
                    onClick={() => navigate(getTabPath(tab.id))}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Kiosk Modal */}
      {showKioskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingItem ? 'Modifier le kiosque' : 'Nouveau kiosque'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du kiosque *
                </label>
                <input
                  type="text"
                  value={kioskForm.nom}
                  onChange={(e) => setKioskForm({ ...kioskForm, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom du kiosque"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={kioskForm.adresse}
                  onChange={(e) => setKioskForm({ ...kioskForm, adresse: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adresse du kiosque"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowKioskModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveKiosk}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {loading ? 'Sauvegarde...' : (editingItem ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingItem ? 'Modifier l\'offre' : 'Nouvelle offre'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'offre *
                </label>
                <input
                  type="text"
                  value={offerForm.nom}
                  onChange={(e) => setOfferForm({ ...offerForm, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'offre"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Volume (ml)
                </label>
                <input
                  type="number"
                  value={offerForm.volume_ml}
                  onChange={(e) => setOfferForm({ ...offerForm, volume_ml: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Volume en ml"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={offerForm.description}
                  onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description de l'offre"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowOfferModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveOffer}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {loading ? 'Sauvegarde...' : (editingItem ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingItem ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom d'utilisateur *
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom d'utilisateur"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle *
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fontainier">Fontainier</option>
                  <option value="commercial">Commercial</option>
                  <option value="administrateur">Administrateur</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kiosque
                </label>
                <select
                  value={userForm.kiosque_id}
                  onChange={(e) => setUserForm({ ...userForm, kiosque_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun kiosque</option>
                  {kiosks.map(kiosk => (
                    <option key={kiosk.id} value={kiosk.id}>
                      {kiosk.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveUser}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {loading ? 'Sauvegarde...' : (editingItem ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}