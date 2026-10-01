/**
 * Telemetry buffer: batch flush au seuil (20), niveaux, re-queue silencieuse
 * sur échec réseau, garde-fou Never-throw. Le flush utilise fetch global
 * (keepalive possible) — on le mock ici.
 */

const mockGetSession = jest.fn()
const mockFetch = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}))

jest.mock('@/lib/build', () => ({ APP_BUILD: 'test-build' }))
jest.mock('@/lib/restConfig', () => ({
  REST_URL: 'https://fake.supabase.co',
  REST_API_KEY: 'fake-anon-key',
}))

import { _resetTelemetryForTests, flushTelemetry, logError, logInfo, logWarn } from '../telemetry'

function lastBatch(): Array<Record<string, unknown>> {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return JSON.parse(call[1].body)
}

beforeEach(() => {
  jest.clearAllMocks()
  _resetTelemetryForTests()
  // Le module appelle fetch nu — mock au niveau global (Node <18 n'en a pas).
  global.fetch = mockFetch as unknown as typeof global.fetch
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' }, access_token: 'token-1' } },
  })
  mockFetch.mockResolvedValue({ status: 201 }) // Node <18: pas de Response global ici
})

describe('telemetry', () => {
  it('flush manuel envoie le buffer sous le seuil; le 20ᵉ log déclenche l’auto-flush', async () => {
    for (let index = 0; index < 19; index += 1) {
      logInfo('test', `msg-${index}`)
    }
    // Flush manuel: envoie ce qui est en attente (19 < seuil, mais un flush
    // explicite est volontaire).
    await flushTelemetry()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(lastBatch()).toHaveLength(19)

    // 20 logs d'un coup → auto-flush immédiat au seuil
    _resetTelemetryForTests()
    mockFetch.mockClear()
    for (let index = 0; index < 20; index += 1) {
      logInfo('test', `auto-${index}`)
    }
    await Promise.resolve()
    await flushTelemetry()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const options = mockFetch.mock.calls[0][1]
    expect(options.keepalive).toBe(false)
    expect(options.headers.apikey).toBe('fake-anon-key')
    const batch = lastBatch()
    expect(batch).toHaveLength(20)
    expect(batch[0]).toMatchObject({
      level: 'info',
      source: 'test',
      build: 'test-build',
      user_id: 'user-1', // stampé au flush
    })
    expect(batch[0].route).toBeDefined()
    expect(batch[0].created_at).toBeDefined()
  })

  it('logError/logWarn produisent les bons niveaux + contexte', async () => {
    logError('src', 'boom', { code: '42501' })
    logWarn('src', 'careful')
    await flushTelemetry()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const batch = lastBatch()
    expect(batch[0].level).toBe('error')
    expect(batch[0].context).toMatchObject({ code: '42501' })
    expect(batch[0].context).toHaveProperty('userAgent')
    expect(batch[0].context).toHaveProperty('standalone')
    expect(batch[1].level).toBe('warn')
  })

  it('échec réseau = silencieux (ré-enqueue, aucun throw, retry envoie)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network down'))

    logInfo('test', 'survivant')
    // Ne doit PAS throw malgré l'échec réseau
    await expect(flushTelemetry()).resolves.toBeUndefined()

    // L'entrée a été ré-enqueue: le flush suivant l'envoie
    await flushTelemetry()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(lastBatch()[0].message).toBe('survivant')
  })

  it('aucune session → user_id null, aucun throw', async () => {
    mockGetSession.mockRejectedValue(new Error('no session'))
    logInfo('test', 'sans session')
    await expect(flushTelemetry()).resolves.toBeUndefined()
    expect(lastBatch()[0].user_id).toBeNull()
  })
})
