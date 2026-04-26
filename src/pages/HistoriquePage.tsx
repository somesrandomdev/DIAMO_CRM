import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { BackButton, LogoutButton } from '../components/NavControls'
import { toCFA } from '../utils/price'
import { sanitizeForCSV } from '../utils/validation'
import { FaSearch, FaFilter, FaDownload } from 'react-icons/fa'

interface Sale {
  id: string
  created_at: string
  montant_total: number
  client: { nom: string } | null
  offre: { nom: string } | null
}

export default function HistoriquePage({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const [sales, setSales] = useState<Sale[]>([])
  const [filteredSales, setFilteredSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (profile?.kiosque_id) {
      loadSalesHistory()
    }
  }, [profile])

  useEffect(() => {
    filterSales()
  }, [sales, searchTerm, dateFilter])

  const loadSalesHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select('id, created_at, montant_total, client:clients(nom), offre:offres(nom)')
        .eq('kiosque_id', profile!.kiosque_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const transformedSales = (data || []).map(sale => ({
        ...sale,
        client: Array.isArray(sale.client) ? sale.client[0] || null : sale.client,
        offre: Array.isArray(sale.offre) ? sale.offre[0] || null : sale.offre
      }))

      setSales(transformedSales)
    } catch (error) {
      console.error('Error loading sales history:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSales = () => {
    let filtered = sales

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.client?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.offre?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(sale =>
        sale.created_at.startsWith(dateFilter)
      )
    }

    setFilteredSales(filtered)
    setCurrentPage(1)
  }

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Client', 'Offre', 'Montant', 'ID Vente'].map(sanitizeForCSV),
      ...filteredSales.map(sale => [
        new Date(sale.created_at).toLocaleDateString('fr-FR'),
        sale.client?.nom || 'N/A',
        sale.offre?.nom || 'N/A',
        sale.montant_total.toString(),
        sale.id
      ].map(sanitizeForCSV))
    ]

    const csvString = csvContent.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historique-ventes-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <BackButton onBack={onBack} />
        <LogoutButton />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Historique des Ventes</h1>
        <button
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
        >
          <FaDownload className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Client, offre, ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setDateFilter('')
              }}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2"
            >
              <FaFilter className="w-4 h-4" />
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="kpi-card bg-gradient-primary text-center">
          <p className="kpi-value text-blue-800">{filteredSales.length}</p>
          <p className="kpi-label text-blue-700">Ventes</p>
        </div>
        <div className="kpi-card bg-gradient-success text-center">
          <p className="kpi-value text-green-800">
            {toCFA(filteredSales.reduce((sum, sale) => sum + sale.montant_total, 0))}
          </p>
          <p className="kpi-label text-green-700">CA total</p>
        </div>
        <div className="kpi-card bg-gradient-primary text-center">
          <p className="kpi-value text-purple-800">
            {filteredSales.length > 0 ? toCFA(filteredSales.reduce((sum, sale) => sum + sale.montant_total, 0) / filteredSales.length) : '0'}
          </p>
          <p className="kpi-label text-purple-700">Panier moyen</p>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card card-elevated table-enhanced overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="loading-shimmer h-12 w-12 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Chargement de l'historique...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Heure
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Offre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Vente
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sale.client?.nom || 'Client anonyme'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sale.offre?.nom || 'Offre inconnue'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                        {toCFA(sale.montant_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {sale.id.slice(0, 8)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredSales.length)} sur {filteredSales.length} résultats
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}