import { formatPhone, looksLikePhone, normalizePhone } from '../phone'

describe('normalizePhone', () => {
  it('strips everything but digits', () => {
    expect(normalizePhone('77 123 45 67')).toBe('771234567')
    expect(normalizePhone('+221 77 123 45 67')).toBe('221771234567')
    expect(normalizePhone('(011) 222-33-44')).toBe('0112223344')
  })

  it('handles empty input', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })
})

describe('formatPhone', () => {
  it('formats 9-digit Senegal mobiles as 2-3-2-2', () => {
    expect(formatPhone('771234567')).toBe('77 123 45 67')
    expect(formatPhone('761234567')).toBe('76 123 45 67')
  })

  it('falls back to right-aligned pairs for other lengths', () => {
    expect(formatPhone('77123456')).toBe('77 12 34 56')
  })

  it('round-trips with normalizePhone', () => {
    expect(normalizePhone(formatPhone('771234567'))).toBe('771234567')
  })

  it('handles empty input', () => {
    expect(formatPhone('')).toBe('')
    expect(formatPhone(null)).toBe('')
  })
})

describe('looksLikePhone', () => {
  it('accepts digit-ish strings', () => {
    expect(looksLikePhone('77 123 45 67')).toBe(true)
    expect(looksLikePhone('+221771234567')).toBe(true)
  })

  it('rejects emails and usernames', () => {
    expect(looksLikePhone('user@example.com')).toBe(false)
    expect(looksLikePhone('aminata')).toBe(false)
  })
})
