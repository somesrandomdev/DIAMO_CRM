import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * "X en attente" badge on the sale screen: hidden at 0, opens the list of
 * sales kept on the phone (date, amount, client) with a manual sync.
 */

const mockGetQueuedSales = jest.fn()
const mockGetQueuedClients = jest.fn()
jest.mock('@/utils/offlineSalesQueue', () => ({ getQueuedSales: () => mockGetQueuedSales() }))
jest.mock('@/utils/offlineClientQueue', () => ({ getQueuedClients: () => mockGetQueuedClients() }))

import { PendingSalesBadge } from '../PendingSalesBadge'

const queued = [
  {
    id: 'q1',
    kiosque_id: 'k1',
    client_id: 'c1',
    idempotency_key: 'key-1',
    created_at: '2026-10-02T09:15:00.000Z',
    queued_at: '2026-10-02T09:15:01.000Z',
    items: [
      { offre_id: 'o1', quantite: 2, montant_total: 600 },
      { offre_id: 'o2', quantite: 1, montant_total: 500 },
    ],
  },
  {
    id: 'q2',
    kiosque_id: 'k1',
    client_id: 'offline-abc',
    idempotency_key: 'key-2',
    created_at: '2026-10-02T10:00:00.000Z',
    queued_at: '2026-10-02T10:00:01.000Z',
    items: [{ offre_id: 'o3', quantite: 3, montant_total: 300 }],
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetQueuedSales.mockResolvedValue(queued)
  mockGetQueuedClients.mockResolvedValue([{ offline_id: 'offline-abc', nom: 'Nouveau client hors ligne' }])
})

function renderBadge(props: Partial<Parameters<typeof PendingSalesBadge>[0]> = {}) {
  const onSync = jest.fn()
  const utils = render(
    <PendingSalesBadge
      pendingCount={2}
      isOnline
      isSyncing={false}
      onSync={onSync}
      clients={[{ id: 'c1', nom: 'Fatou Sow', kiosque_id: 'k1' }]}
      {...props}
    />
  )
  return { ...utils, onSync }
}

describe('PendingSalesBadge', () => {
  it('file vide : badge masqué', () => {
    renderBadge({ pendingCount: 0 })
    expect(screen.queryByText(/en attente/)).not.toBeInTheDocument()
  })

  it('file non vide : badge « 2 en attente »', () => {
    renderBadge()
    expect(screen.getByRole('button', { name: '2 en attente' })).toBeInTheDocument()
  })

  it('clic : liste des ventes en attente avec client, date et montant', async () => {
    renderBadge()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2 en attente' }))
    })

    const rows = within(screen.getByRole('list', { name: 'Liste des ventes en attente' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Fatou Sow')
    expect(rows[0]).toHaveTextContent(/1\s100/) // 600 + 500
    expect(rows[0]).toHaveTextContent(new Date(queued[0].created_at).toLocaleString('fr-FR'))
    // client créé hors ligne : nom lu dans la file des clients
    expect(rows[1]).toHaveTextContent('Nouveau client hors ligne')
    expect(rows[1]).toHaveTextContent('300')
  })

  it('en ligne : « Synchroniser maintenant » déclenche la synchro', async () => {
    const { onSync } = renderBadge()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2 en attente' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Synchroniser maintenant/ }))
    })
    expect(onSync).toHaveBeenCalledTimes(1)
  })

  it('hors ligne : pas de bouton de synchro, message clair', async () => {
    renderBadge({ isOnline: false })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2 en attente' }))
    })
    expect(screen.queryByRole('button', { name: /Synchroniser/ })).not.toBeInTheDocument()
    expect(screen.getByText(/la synchronisation reprendra au retour du réseau/)).toBeInTheDocument()
  })

  it('file vidée par la synchro : badge et liste disparaissent', async () => {
    const { rerender, onSync } = renderBadge()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2 en attente' }))
    })
    await act(async () => {
      rerender(<PendingSalesBadge pendingCount={0} isOnline isSyncing={false} onSync={onSync} clients={[]} />)
    })
    expect(screen.queryByText(/en attente/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
