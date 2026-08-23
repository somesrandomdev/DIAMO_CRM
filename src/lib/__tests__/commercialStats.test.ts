import {
  clientPurchaseMap,
  computeCommercialKpis,
  monthKey,
  revenuePerKiosk,
  startOfMonth,
  type CommercialSale,
} from '../commercialStats'

const kiosques = [
  { id: 'k1', nom: 'Kiosque A' },
  { id: 'k2', nom: 'Kiosque B' },
]

const sale = (overrides: Partial<CommercialSale>): CommercialSale => ({
  id: overrides.id ?? 's1',
  kiosque_id: overrides.kiosque_id ?? 'k1',
  client_id: overrides.client_id ?? 'c1',
  montant_total: overrides.montant_total ?? 100,
  created_at: overrides.created_at ?? '2026-08-10T10:00:00.000Z',
  ...overrides,
})

describe('computeCommercialKpis', () => {
  it('aggregates revenue, sales, clients and kiosk counts across kiosques', () => {
    const sales = [
      sale({ kiosque_id: 'k1', montant_total: 1500 }),
      sale({ kiosque_id: 'k1', montant_total: 500 }),
      sale({ kiosque_id: 'k2', montant_total: 2000 }),
    ]
    const clients = [
      { id: 'c1', kiosque_id: 'k1', nom: 'Awa' },
      { id: 'c2', kiosque_id: 'k1', nom: 'Moussa' },
      { id: 'c3', kiosque_id: 'k2', nom: 'Fatou' },
    ]

    const kpis = computeCommercialKpis(kiosques, sales, clients)

    expect(kpis).toEqual({
      revenueMonth: 4000,
      salesCount: 3,
      clientsCount: 3,
      kiosquesCount: 2,
    })
  })

  it('treats null montant_total as zero', () => {
    const kpis = computeCommercialKpis(kiosques, [sale({ montant_total: null })], [])
    expect(kpis.revenueMonth).toBe(0)
    expect(kpis.salesCount).toBe(1)
  })

  it('returns zeros for an empty supervision', () => {
    expect(computeCommercialKpis([], [], [])).toEqual({
      revenueMonth: 0,
      salesCount: 0,
      clientsCount: 0,
      kiosquesCount: 0,
    })
  })
})

describe('revenuePerKiosk', () => {
  it('groups revenue per kiosk, sorted highest first', () => {
    const sales = [
      sale({ kiosque_id: 'k1', montant_total: 100 }),
      sale({ kiosque_id: 'k2', montant_total: 900 }),
      sale({ kiosque_id: 'k1', montant_total: 200 }),
    ]

    const rows = revenuePerKiosk(kiosques, sales)

    expect(rows).toEqual([
      { kiosqueId: 'k2', nom: 'Kiosque B', revenue: 900, salesCount: 1 },
      { kiosqueId: 'k1', nom: 'Kiosque A', revenue: 300, salesCount: 2 },
    ])
  })

  it('keeps kiosques with no sales in the list at zero', () => {
    const rows = revenuePerKiosk(kiosques, [sale({ kiosque_id: 'k1' })])
    expect(rows.find((row) => row.kiosqueId === 'k2')).toMatchObject({ revenue: 0, salesCount: 0 })
  })

  it('ignores sales for kiosques outside the supervision list', () => {
    const rows = revenuePerKiosk(kiosques, [sale({ kiosque_id: 'kX', montant_total: 5000 })])
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.revenue === 0)).toBe(true)
  })
})

describe('clientPurchaseMap', () => {
  it('rolls up last purchase, total spent and count per client', () => {
    const map = clientPurchaseMap([
      sale({ client_id: 'c1', montant_total: 300, created_at: '2026-08-02T08:00:00.000Z' }),
      sale({ client_id: 'c1', montant_total: 700, created_at: '2026-08-15T18:00:00.000Z' }),
      sale({ client_id: 'c2', montant_total: 250, created_at: '2026-08-12T12:00:00.000Z' }),
    ])

    expect(map.get('c1')).toEqual({
      lastPurchase: '2026-08-15T18:00:00.000Z',
      totalSpent: 1000,
      purchaseCount: 2,
    })
    expect(map.get('c2')?.totalSpent).toBe(250)
  })

  it('skips sales without a client', () => {
    const map = clientPurchaseMap([sale({ client_id: null })])
    expect(map.size).toBe(0)
  })
})

describe('date helpers', () => {
  it('formats monthKey as the objectifs.mois format', () => {
    expect(monthKey(new Date(2026, 7, 23))).toBe('2026-08-01')
    expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  it('starts the month at day one, midnight local', () => {
    const start = startOfMonth(new Date(2026, 7, 23, 15, 30))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(7)
    expect(start.getDate()).toBe(1)
    expect(start.getHours()).toBe(0)
  })
})
