import { normalizeTypeCode, resolveTypeCode, typeBadgeClass, type KiosqueType } from '../kiosqueTypes'

const TYPES: KiosqueType[] = [
  { code: 'KEP', label: 'Kiosque en propre' },
  { code: 'KEF', label: 'Kiosque en franchise' },
]

describe('resolveTypeCode', () => {
  it('type vide → NULL, pas une erreur', () => {
    expect(resolveTypeCode('', TYPES)).toEqual({ code: null, unknown: false })
    expect(resolveTypeCode('   ', TYPES)).toEqual({ code: null, unknown: false })
  })

  it('code exact reconnu', () => {
    expect(resolveTypeCode('KEP', TYPES)).toEqual({ code: 'KEP', unknown: false })
    expect(resolveTypeCode('KEF', TYPES)).toEqual({ code: 'KEF', unknown: false })
  })

  it('code inconnu → essai par label insensible à la casse', () => {
    expect(resolveTypeCode('Kiosque en propre', TYPES)).toEqual({ code: 'KEP', unknown: false })
    expect(resolveTypeCode('kiosque en franchise', TYPES)).toEqual({ code: 'KEF', unknown: false })
  })

  it('toujours inconnu → unknown: true (ligne rouge à l’import)', () => {
    expect(resolveTypeCode('KIOSQUE MOBILE', TYPES)).toEqual({ code: null, unknown: true })
  })
})

describe('normalizeTypeCode', () => {
  it('trimme et passe en majuscules', () => {
    expect(normalizeTypeCode('  kep ')).toBe('KEP')
  })
})

describe('typeBadgeClass', () => {
  it('KEP bleu, KEF vert, autres gris, sans type orange', () => {
    expect(typeBadgeClass('KEP')).toContain('bg-blue-light')
    expect(typeBadgeClass('KEF')).toContain('bg-teal-light')
    expect(typeBadgeClass('XYZ')).toContain('bg-muted')
    expect(typeBadgeClass(null)).toContain('bg-amber-light')
  })
})
