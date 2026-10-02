import { buildDailySeries, monthKey, monthPeriod, startOfMonth } from '../commercialStats'

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

describe('monthPeriod', () => {
  const now = new Date(2026, 9, 2, 12, 0) // 2 oct. 2026

  it('mois en cours : [1er du mois, 1er du mois suivant)', () => {
    const { from, to } = monthPeriod(0, 1, now)
    expect(new Date(from)).toEqual(new Date(2026, 9, 1))
    expect(new Date(to)).toEqual(new Date(2026, 10, 1))
  })

  it('mois dernier', () => {
    const { from, to } = monthPeriod(1, 1, now)
    expect(new Date(from)).toEqual(new Date(2026, 8, 1))
    expect(new Date(to)).toEqual(new Date(2026, 9, 1))
  })

  it('3 derniers mois (mois en cours inclus)', () => {
    const { from, to } = monthPeriod(0, 3, now)
    expect(new Date(from)).toEqual(new Date(2026, 7, 1))
    expect(new Date(to)).toEqual(new Date(2026, 10, 1))
  })

  it('passage d’année : janvier → mois dernier = décembre', () => {
    const { from, to } = monthPeriod(1, 1, new Date(2027, 0, 15))
    expect(new Date(from)).toEqual(new Date(2026, 11, 1))
    expect(new Date(to)).toEqual(new Date(2027, 0, 1))
  })
})

describe('buildDailySeries (tendance Supervision, points agrégés par jour)', () => {
  it('jours sans vente à 0, total conservé', () => {
    const series = buildDailySeries(
      [
        { created_at: '2026-10-01', montant_total: 1100 },
        { created_at: '2026-09-29', montant_total: 400 },
      ],
      5,
      new Date(2026, 9, 2, 12)
    )
    expect(series.map((point) => point.date)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(series.map((point) => point.ca)).toEqual([0, 400, 0, 1100, 0])
  })
})
