import { measurePerformance } from '../performance'

describe('measurePerformance', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock performance.now
    let time = 1000
    jest.spyOn(performance, 'now').mockImplementation(() => {
      time += 50 // Each call advances time by 50ms
      return time
    })

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Save NODE_ENV
    originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env.NODE_ENV = originalEnv
  })

  it('should measure execution time and return the result for a successful promise', async () => {
    const mockValue = 'success result'
    const mockFn = jest.fn().mockResolvedValue(mockValue)

    const result = await measurePerformance('Test Success', mockFn)

    expect(result).toBe(mockValue)
    expect(mockFn).toHaveBeenCalledTimes(1)

    // performance.now() is called before and after the function, difference is 50ms
    expect(console.log).toHaveBeenCalledWith('[Performance] Test Success: 50.00ms')
  })

  it('should measure execution time, log error, and rethrow for a rejected promise', async () => {
    const mockError = new Error('Test failure')
    const mockFn = jest.fn().mockRejectedValue(mockError)

    await expect(measurePerformance('Test Error', mockFn)).rejects.toThrow(mockError)

    expect(mockFn).toHaveBeenCalledTimes(1)

    // performance.now() is called before and after the function, difference is 50ms
    expect(console.error).toHaveBeenCalledWith('[Performance] Test Error failed after 50.00ms:', mockError)
  })

  it('should not log if NODE_ENV is not development', async () => {
    process.env.NODE_ENV = 'production'

    const mockValue = 'success result'
    const mockFn = jest.fn().mockResolvedValue(mockValue)

    const result = await measurePerformance('Test Production', mockFn)

    expect(result).toBe(mockValue)
    expect(console.log).not.toHaveBeenCalled()
  })
})
