import { activeKiosqueIds } from '../alertScope'

const now = new Date('2026-10-02T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()
const fontainier = (kiosque_id: string | null, deleted_at: string | null = null) => ({ kiosque_id, role: 'fontainier', deleted_at })

describe('activeKiosqueIds — périmètre des alertes admin', () => {
  const kiosques = ['k-staffed', 'k-selling', 'k-both', 'k-dormant', 'k-old-sale', 'k-ex-staff', 'k-commercial']

  const active = activeKiosqueIds(
    kiosques,
    [
      fontainier('k-staffed'),
      fontainier('k-both'),
      fontainier('k-ex-staff', daysAgo(3)), // fontainier supprimé
      { kiosque_id: 'k-commercial', role: 'commercial', deleted_at: null }, // pas un fontainier
      fontainier(null), // fontainier sans kiosque
    ],
    [
      { kiosque_id: 'k-selling', created_at: daysAgo(29) },
      { kiosque_id: 'k-both', created_at: daysAgo(1) },
      { kiosque_id: 'k-old-sale', created_at: daysAgo(31) }, // hors fenêtre
      { kiosque_id: null, created_at: daysAgo(1) }, // vente sans kiosque
    ],
    now
  )

  it.each(['k-staffed', 'k-selling', 'k-both'])('%s est actif', (id) => {
    expect(active.has(id)).toBe(true)
  })

  it.each(['k-dormant', 'k-old-sale', 'k-ex-staff', 'k-commercial'])('%s est inactif', (id) => {
    expect(active.has(id)).toBe(false)
  })

  it('limite de fenêtre : vente il y a exactement 30 jours = actif', () => {
    expect(activeKiosqueIds(['k'], [], [{ kiosque_id: 'k', created_at: daysAgo(30) }], now).has('k')).toBe(true)
  })

  it('ne renvoie jamais un kiosque hors référentiel', () => {
    expect([...activeKiosqueIds([], [fontainier('k-ghost')], [{ kiosque_id: 'k-ghost', created_at: daysAgo(1) }], now)]).toEqual([])
  })

  it('aucune donnée : aucun kiosque actif', () => {
    expect(activeKiosqueIds(kiosques, [], [], now).size).toBe(0)
  })
})
