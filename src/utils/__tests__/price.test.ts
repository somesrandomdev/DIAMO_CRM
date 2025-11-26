import { toCFA } from '../price'

describe('Price Utility Functions', () => {
  describe('toCFA', () => {
    it('should format numbers as CFA currency', () => {
      expect(toCFA(100)).toBe('100 CFA')
      expect(toCFA(2500)).toBe('2500 CFA')
      expect(toCFA(0)).toBe('0 CFA')
    })

    it('should handle decimal numbers', () => {
      expect(toCFA(100.5)).toBe('100.5 CFA')
      expect(toCFA(99.99)).toBe('99.99 CFA')
    })

    it('should handle negative numbers', () => {
      expect(toCFA(-100)).toBe('-100 CFA')
      expect(toCFA(-50.5)).toBe('-50.5 CFA')
    })

    it('should handle very large numbers', () => {
      expect(toCFA(1000000)).toBe('1000000 CFA')
      expect(toCFA(999999.99)).toBe('999999.99 CFA')
    })
  })
})

// Example of testing with different scenarios
describe('Business Logic Tests', () => {
  it('should calculate average basket correctly', () => {
    const totalSales = 100000 // 100,000 CFA
    const numberOfSales = 50
    const averageBasket = totalSales / numberOfSales

    expect(averageBasket).toBe(2000)
    expect(toCFA(averageBasket)).toBe('2000 CFA')
  })

  it('should calculate growth rate', () => {
    const previousPeriod = 50000 // 50,000 CFA
    const currentPeriod = 75000  // 75,000 CFA

    const growthRate = ((currentPeriod - previousPeriod) / previousPeriod) * 100

    expect(growthRate).toBe(50)
  })

  it('should validate email format', () => {
    const validEmails = [
      'user@example.com',
      'test.email+tag@domain.co.uk',
      'user123@test-domain.com'
    ]

    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user..double@example.com'
    ]

    // More strict email regex that doesn't allow consecutive dots
    const emailRegex = /^(?!.*\.\.)[a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/

    validEmails.forEach(email => {
      expect(email).toMatch(emailRegex)
    })

    invalidEmails.forEach(email => {
      expect(email).not.toMatch(emailRegex)
    })
  })
})