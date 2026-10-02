import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { SaleReceipt } from '../useSubmitSale'

/**
 * Post-sale confirmation screen: summary, native share sheet with a
 * download fallback, and close.
 */

const mockShowToast = jest.fn()
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: mockShowToast }) }))

import { SaleConfirmation } from '../SaleConfirmation'

const receipt: SaleReceipt = {
  total: 1100,
  clientNom: 'Fatou Sow',
  items: [
    { nom: 'Bidon 10L', qty: 2, sousTotal: 600 },
    { nom: 'Bidon 20L', qty: 1, sousTotal: 500 },
  ],
  queued: false,
  alreadyRecorded: false,
}
const ticket = { saleId: 'sale-1', fileName: 'ticket-sale-1.pdf', blob: new Blob(['%PDF'], { type: 'application/pdf' }) }

// jsdom has no Web Share API: each test installs (or not) its own.
const nav = navigator as unknown as { share?: unknown; canShare?: unknown }
let clickedDownloads: string[] = []

beforeEach(() => {
  jest.clearAllMocks()
  delete nav.share
  delete nav.canShare
  clickedDownloads = []
  ;(URL as unknown as { createObjectURL: () => string }).createObjectURL = jest.fn(() => 'blob:ticket')
  ;(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = jest.fn()
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clickedDownloads.push(this.download)
  })
})

afterEach(() => jest.restoreAllMocks())

function renderScreen(props: Partial<Parameters<typeof SaleConfirmation>[0]> = {}) {
  const onClose = jest.fn()
  render(<SaleConfirmation receipt={receipt} ticket={ticket} onClose={onClose} {...props} />)
  return { onClose }
}

describe('SaleConfirmation', () => {
  it('fermé tant qu’aucune vente n’est terminée', () => {
    render(<SaleConfirmation receipt={null} ticket={null} onClose={jest.fn()} />)
    expect(screen.queryByText('Vente enregistrée')).not.toBeInTheDocument()
  })

  it('affiche le résumé : titre, client, offres, total', () => {
    renderScreen()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Vente enregistrée')).toBeInTheDocument()
    expect(screen.getByText('Client : Fatou Sow')).toBeInTheDocument()
    const offres = within(screen.getByRole('list', { name: 'Offres vendues' })).getAllByRole('listitem')
    expect(offres).toHaveLength(2)
    expect(offres[0]).toHaveTextContent('Bidon 10L')
    expect(offres[0]).toHaveTextContent('× 2')
    expect(screen.getByText(/1\s100/)).toBeInTheDocument()
  })

  it('Partager : ouvre la share sheet native avec le PDF, sans téléchargement', async () => {
    const share = jest.fn(async () => undefined)
    nav.canShare = jest.fn(() => true)
    nav.share = share
    renderScreen()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Partager le ticket/ }))
    })

    expect(share).toHaveBeenCalledTimes(1)
    const files = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files
    expect(files[0].name).toBe('ticket-sale-1.pdf')
    expect(files[0].type).toBe('application/pdf')
    expect(clickedDownloads).toEqual([])
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('pas de share sheet : téléchargement du PDF + toast « Ticket téléchargé »', async () => {
    renderScreen()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Partager le ticket/ }))
    })
    expect(clickedDownloads).toEqual(['ticket-sale-1.pdf'])
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ticket téléchargé' }))
  })

  it('partage en échec : repli sur le téléchargement', async () => {
    nav.canShare = jest.fn(() => true)
    nav.share = jest.fn(async () => {
      throw Object.assign(new Error('not allowed'), { name: 'NotAllowedError' })
    })
    renderScreen()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Partager le ticket/ }))
    })
    expect(clickedDownloads).toEqual(['ticket-sale-1.pdf'])
  })

  it('partage annulé par l’utilisateur : ni téléchargement ni toast', async () => {
    nav.canShare = jest.fn(() => true)
    nav.share = jest.fn(async () => {
      throw Object.assign(new Error('cancel'), { name: 'AbortError' })
    })
    renderScreen()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Partager le ticket/ }))
    })
    expect(clickedDownloads).toEqual([])
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('sans ticket (vente en file hors-ligne) : pas de bouton Partager, message clair', () => {
    renderScreen({ receipt: { ...receipt, queued: true }, ticket: null })
    expect(screen.queryByRole('button', { name: /Partager le ticket/ })).not.toBeInTheDocument()
    expect(screen.getByText('Le ticket sera disponible après la synchronisation.')).toBeInTheDocument()
  })

  it('Fermer appelle onClose', () => {
    const { onClose } = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
