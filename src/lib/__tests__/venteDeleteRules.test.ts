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

describe('canDeleteVente (miroir RPC : suppression réservée commerciaux + admin)', () => {
  it('fontainier : jamais autorisé, même < 24 h', () => {
    const recent = new Date(Date.now() - 3600_000).toISOString() // 1 h
    const old = new Date(Date.now() - 25 * 3600_000).toISOString()
    expect(canDeleteVente(recent, 'fontainier')).toBe(false)
    expect(canDeleteVente(old, 'fontainier')).toBe(false)
    // Même dans le périmètre, le rôle fontainier est refusé.
    expect(canDeleteVente(recent, 'fontainier', true)).toBe(false)
  })

  it('commercial : < 24 h sur kiosque supervisé → autorisé', () => {
    const recent = new Date(Date.now() - 3600_000).toISOString() // 1 h
    expect(canDeleteVente(recent, 'commercial', true)).toBe(true)
  })

  it('commercial : > 24 h → refusée (réservée admin)', () => {
    const old = new Date(Date.now() - 25 * 3600_000).toISOString()
    expect(canDeleteVente(old, 'commercial', true)).toBe(false)
  })

  it('commercial : < 24 h mais kiosque non supervisé → refusée', () => {
    const recent = new Date(Date.now() - 3600_000).toISOString() // 1 h
    expect(canDeleteVente(recent, 'commercial', false)).toBe(false)
  })

  it('admin : aucune limite de fenêtre', () => {
    const veryOld = new Date(Date.now() - 90 * 24 * 3600_000).toISOString()
    expect(canDeleteVente(veryOld, 'administrateur')).toBe(true)
  })
})
