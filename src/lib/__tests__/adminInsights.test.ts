import { DOW_LABELS, parseInsights } from '../adminInsights'

describe('parseInsights', () => {
  it('parse une réponse complète (numerics strings → numbers)', () => {
    const raw = {
      top_offres: [
        { offre_id: 'o1', nom: 'Offre Ganale', ca: '12500', qty: '41', nb: '17' },
      ],
      heatmap: [{ dow: 1, hour: 18, ca: '4500', nb: '12' }],
      client_health: {
        nouveaux: '3', vip: '5', actifs: '9', a_risque: '2', dormants: '183',
      },
      retention: { repeat_rate: '41', avg_days_between: '3.4' },
      growth: [{ week_start: '2026-09-01', cumulative_clients: '186' }],
    }

    const insights = parseInsights(raw)

    expect(insights.top_offres[0]).toEqual({
      offre_id: 'o1', nom: 'Offre Ganale', ca: 12500, qty: 41, nb: 17,
    })
    expect(insights.heatmap[0]).toEqual({ dow: 1, hour: 18, ca: 4500, nb: 12 })
    expect(insights.client_health).toEqual({
      nouveaux: 3, vip: 5, actifs: 9, a_risque: 2, dormants: 183,
    })
    expect(insights.retention).toEqual({ repeat_rate: 41, avg_days_between: 3.4 })
    expect(insights.growth[0].cumulative_clients).toBe(186)
  })

  it('normalise une réponse vide (json_agg NULL → tableaux vides, zéros)', () => {
    const insights = parseInsights({})
    expect(insights.top_offres).toEqual([])
    expect(insights.heatmap).toEqual([])
    expect(insights.growth).toEqual([])
    expect(insights.client_health).toEqual({
      nouveaux: 0, vip: 0, actifs: 0, a_risque: 0, dormants: 0,
    })
    expect(insights.retention).toEqual({ repeat_rate: 0, avg_days_between: 0 })
  })

  it('tolère null/undefined', () => {
    expect(parseInsights(null).top_offres).toEqual([])
    expect(parseInsights(undefined).client_health.vip).toBe(0)
  })
})

describe('DOW_LABELS', () => {
  it('index 0 = dimanche (convention PG extract(dow))', () => {
    expect(DOW_LABELS[0]).toBe('Dim')
    expect(DOW_LABELS[1]).toBe('Lun')
    expect(DOW_LABELS).toHaveLength(7)
  })
})
