import { act, renderHook } from '@testing-library/react'

/**
 * Ticket lifecycle after a recorded sale: generated + uploaded + linked, kept
 * in memory for the confirmation screen, NEVER auto-downloaded, and never
 * blocking the end of the sale (always resolves true).
 */

const mockShowToast = jest.fn()
const mockGenerate = jest.fn()
const mockUpload = jest.fn()
const mockCreateSignedUrl = jest.fn()
const mockUpdateEq = jest.fn<Promise<{ error: null }>, unknown[]>(async () => ({ error: null }))

jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: mockShowToast }) }))
jest.mock('@/lib/ticketGenerator', () => ({ generateTicket: (...args: unknown[]) => mockGenerate(...args) }))
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: mockUpload, createSignedUrl: mockCreateSignedUrl }) },
    from: () => ({ update: (values: unknown) => ({ eq: (...args: unknown[]) => mockUpdateEq(values, ...args) }) }),
  },
}))

import { useTicketUpload } from '../useTicketUpload'

const input = {
  saleId: 'sale-1',
  kiosqueId: 'kiosque-1',
  kiosqueNom: 'Kiosque Médina',
  client: { nom: 'Fatou Sow' },
  offres: [{ nom: 'Bidon 10L', prix: 300, quantite: 2, sous_total: 600 }],
  montantTotal: 600,
}

let anchorClicks = 0

beforeEach(() => {
  jest.clearAllMocks()
  anchorClicks = 0
  mockGenerate.mockResolvedValue('data:application/pdf;base64,JVBERi0=')
  mockUpload.mockResolvedValue({ data: {}, error: null })
  ;(global as { fetch?: unknown }).fetch = jest.fn(async () => ({ blob: async () => new Blob(['%PDF']) }))
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    anchorClicks += 1
  })
})

afterEach(() => jest.restoreAllMocks())

describe('useTicketUpload', () => {
  it('succès : upload + lien_ticket, ticket gardé pour le partage, AUCUN téléchargement auto', async () => {
    const { result } = renderHook(() => useTicketUpload())
    let ok = false
    await act(async () => {
      ok = await result.current.uploadTicket(input)
    })

    expect(ok).toBe(true)
    expect(mockUpload).toHaveBeenCalledWith('kiosque-1/ticket-sale-1.pdf', expect.any(Blob), expect.anything())
    expect(mockUpdateEq).toHaveBeenCalledWith({ lien_ticket: 'kiosque-1/ticket-sale-1.pdf' }, 'id', 'sale-1')
    expect(result.current.ticket).toEqual(expect.objectContaining({ saleId: 'sale-1', fileName: 'ticket-sale-1.pdf' }))
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    expect(anchorClicks).toBe(0)
  })

  it('upload en échec : la vente se termine quand même (true), le PDF local reste partageable', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { code: '403', message: 'denied' } })
    const { result } = renderHook(() => useTicketUpload())
    let ok = false
    await act(async () => {
      ok = await result.current.uploadTicket(input)
    })

    expect(ok).toBe(true)
    expect(result.current.ticket).not.toBeNull()
    expect(mockUpdateEq).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ticket non sauvegardé en ligne' }))
  })

  it('génération en échec : la vente se termine quand même (true), pas de ticket', async () => {
    mockGenerate.mockRejectedValue(new Error('jspdf crash'))
    const { result } = renderHook(() => useTicketUpload())
    let ok = false
    await act(async () => {
      ok = await result.current.uploadTicket(input)
    })

    expect(ok).toBe(true)
    expect(result.current.ticket).toBeNull()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ticket non disponible' }))
  })

  it('clearTicket oublie le ticket (fermeture de la confirmation)', async () => {
    const { result } = renderHook(() => useTicketUpload())
    await act(async () => {
      await result.current.uploadTicket(input)
    })
    act(() => result.current.clearTicket())
    expect(result.current.ticket).toBeNull()
  })
})
