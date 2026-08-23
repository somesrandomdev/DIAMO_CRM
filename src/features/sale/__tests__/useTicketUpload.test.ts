/**
 * ticketPath is pure, but its module pulls in jspdf + the Supabase client
 * (which reads import.meta.env — invalid under ts-jest's CJS transform), so
 * the heavy imports are mocked and only the path logic is exercised.
 */
jest.mock('@/lib/ticketGenerator', () => ({ generateTicket: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ supabase: {}, handleSupabaseError: jest.fn() }))
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: jest.fn() }) }))

import { ticketPath } from '../useTicketUpload'

describe('ticketPath', () => {
  it('nests the PDF under the kiosque folder — the storage RLS policy requires the first path segment to be the uploader kiosque_id', () => {
    expect(ticketPath('kiosque-123', 'sale-456')).toBe('kiosque-123/ticket-sale-456.pdf')
  })

  it('always prefixes with the kiosque_id, never a root-level file', () => {
    const path = ticketPath('a-b_c.9', 'xyz')
    expect(path.startsWith('a-b_c.9/')).toBe(true)
    expect(path.endsWith('/ticket-xyz.pdf')).toBe(true)
    expect(path.split('/')).toHaveLength(2)
  })
})
