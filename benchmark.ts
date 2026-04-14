import { supabase } from './src/lib/supabase'

// Mock the global behavior
async function mockFetchData() {
  const allSales = Array.from({ length: 500 }).map((_, i) => ({
    kiosque_id: \`kiosk-\${i % 20}\`,
    montant_total: Math.random() * 1000
  }))

  const revenueByKioskMap: Record<string, number> = {}
  allSales.forEach(sale => {
    revenueByKioskMap[sale.kiosque_id] = (revenueByKioskMap[sale.kiosque_id] || 0) + sale.montant_total
  })

  return revenueByKioskMap
}

async function runBenchmark1() {
  // Mocking supabase to simulate latency
  const originalFrom = supabase.from
  supabase.from = (table: string) => {
    return {
      select: () => ({
        eq: () => ({
          single: async () => {
            // Simulate 50ms latency for DB query
            await new Promise(resolve => setTimeout(resolve, 50))
            return { data: { nom: 'Test Kiosk' }, error: null }
          }
        }),
        in: (col: string, vals: any[]) => {
           return {
              data: vals.map(v => ({ id: v, nom: 'Test Kiosk' })),
              error: null
           }
        }
      })
    }
  }

  const revenueByKioskMap = await mockFetchData()

  const start = Date.now()
  const revenueByKiosk = await Promise.all(
    Object.entries(revenueByKioskMap).map(async ([kioskId, revenue]) => {
      try {
        const { data: kiosk, error: kioskError } = await supabase.from('kiosques').select('nom').eq('id', kioskId).single()
        return {
          id: kioskId,
          name: kiosk?.nom || 'Kiosque inconnu',
          value: revenue
        }
      } catch (error) {
        return { id: kioskId, name: \`Kiosque \${kioskId}\`, value: revenue }
      }
    })
  )
  const end = Date.now()
  console.log(\`Original (N+1 queries simulated via Promise.all): \${end - start}ms\`)
}

runBenchmark1()
