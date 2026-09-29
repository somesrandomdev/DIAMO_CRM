import { normalizeKiosqueName, validateKiosqueRows } from '../kiosqueImport'

const row = (nom: string, adresse = '') => ({ nom, adresse })

describe('normalizeKiosqueName', () => {
  it('trimme, minuscule, retire les accents décomposables et compacte les espaces', () => {
    expect(normalizeKiosqueName('  Keur   Massar  En Propre ')).toBe('keur massar en propre')
    expect(normalizeKiosqueName('Sacrée Coeur')).toBe('sacree coeur')
  })
})

describe('validateKiosqueRows', () => {
  const base = ['Kiosque test', 'Keur Massar En Propre']

  it('marque les doublons (base et intra-fichier), ignore les noms vides', () => {
    const rows = [
      row('Keur Massar En Propre'), // doublon base
      row('keur massar    en propre'), // doublon intra-fichier (normalisé)
      row(''), // invalide
      row('Nouveau Kiosque'), // valide
    ]

    const result = validateKiosqueRows(rows, base)

    expect(result.duplicateFlags).toEqual([true, true, false, false])
    expect(result.invalidCount).toBe(1)
    expect(result.duplicateCount).toBe(2)
    expect(result.valid).toHaveLength(3) // nom présent (les doublons partent séparément)
  })

  it('un nom identique à un kiosque SUPPRIMÉ (hors baseNames) reste importable', () => {
    const result = validateKiosqueRows([row('Ancien Kiosque')], [])
    expect(result.duplicateFlags).toEqual([false])
    expect(result.valid).toHaveLength(1)
  })

  it('accents et casse ne trompent pas la détection', () => {
    const result = validateKiosqueRows([row('SACRÉE COEUR')], ['Sacrée Coeur'])
    expect(result.duplicateFlags).toEqual([true])
  })

  it('aucun doublon : tout est importable', () => {
    const result = validateKiosqueRows([row('A'), row('B')], [])
    expect(result.valid).toHaveLength(2)
    expect(result.duplicateCount).toBe(0)
  })
})
