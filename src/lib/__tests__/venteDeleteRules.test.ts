import { canDeleteVente, validateDeleteVente } from '../venteDeleteRules'

describe('validateDeleteVente', () => {
  it('motif manquant → bloqué', () => {
    expect(validateDeleteVente('', 'peu importe')).toBe('Choisissez un motif de suppression.')
  })

  it('motif « Autre » sans commentaire → bloqué', () => {
    expect(validateDeleteVente('Autre', '')).toBe(
      'Un commentaire est obligatoire pour le motif « Autre ».'
    )
    expect(validateDeleteVente('Autre', '   ')).toBe(
      'Un commentaire est obligatoire pour le motif « Autre ».'
    )
  })

  it('motif « Autre » avec commentaire → valide', () => {
    expect(validateDeleteVente('Autre', 'Erreur du client sur la quantité')).toBeNull()
  })

  it('motif standard sans commentaire → valide', () => {
    expect(validateDeleteVente('Doublon', '')).toBeNull()
    expect(validateDeleteVente('Retour client', '')).toBeNull()
    expect(validateDeleteVente('Erreur de saisie', '')).toBeNull()
  })
})

describe('canDeleteVente', () => {
  it('fontainier : vente récente (< 24 h) → autorisée', () => {
    const recent = new Date(Date.now() - 3600_000).toISOString() // 1 h
    expect(canDeleteVente(recent, 'fontainier')).toBe(true)
  })

  it('fontainier : vente > 24 h → refusée (réservée admin)', () => {
    const old = new Date(Date.now() - 25 * 3600_000).toISOString()
    expect(canDeleteVente(old, 'fontainier')).toBe(false)
    expect(canDeleteVente(old, 'commercial')).toBe(false)
  })

  it('admin : aucune limite de fenêtre', () => {
    const veryOld = new Date(Date.now() - 90 * 24 * 3600_000).toISOString()
    expect(canDeleteVente(veryOld, 'administrateur')).toBe(true)
  })
})
