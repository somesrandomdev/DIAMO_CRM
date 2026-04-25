import { validateURL, sanitizeForCSV } from '../validation';

describe('validateURL', () => {
  it('should return the URL if it is valid and has an allowed protocol (http, https)', () => {
    expect(validateURL('http://example.com')).toBe('http://example.com');
    expect(validateURL('https://example.com')).toBe('https://example.com');
  });

  it('should return null for invalid input types', () => {
    // @ts-ignore - testing invalid input
    expect(validateURL(null)).toBeNull();
    // @ts-ignore - testing invalid input
    expect(validateURL(123)).toBeNull();
    // @ts-ignore - testing invalid input
    expect(validateURL(undefined)).toBeNull();
    expect(validateURL('')).toBeNull();
  });

  it('should return null if the protocol is not in the allowed list', () => {
    expect(validateURL('ftp://example.com')).toBeNull();
    expect(validateURL('mailto:test@example.com')).toBeNull();
  });

  it('should support custom allowed protocols', () => {
    expect(validateURL('ftp://example.com', ['ftp', 'http'])).toBe('ftp://example.com');
    expect(validateURL('ws://localhost:8080', ['ws'])).toBe('ws://localhost:8080');
  });

  it('should return null if URL parsing throws an error (invalid URL string)', () => {
    // These inputs will throw an error when passed to new URL()
    expect(validateURL('not-a-valid-url')).toBeNull();
    expect(validateURL('http://')).toBeNull(); // Missing host
    expect(validateURL('://example.com')).toBeNull(); // Missing protocol
  });

  it('should sanitize the string before validating', () => {
    expect(validateURL(' https://example.com ')).toBe('https://example.com');
  })

  describe('sanitizeForCSV', () => {
    it('returns empty string for null or undefined', () => {
      expect(sanitizeForCSV(null)).toBe('')
      expect(sanitizeForCSV(undefined)).toBe('')
    })

    it('returns the same string if safe', () => {
      expect(sanitizeForCSV('Safe Value')).toBe('Safe Value')
      expect(sanitizeForCSV('12345')).toBe('12345')
    })

    it('prepends apostrophe to formula trigger characters', () => {
      expect(sanitizeForCSV('=1+2')).toBe("'=1+2")
      expect(sanitizeForCSV('+1-2')).toBe("'+1-2")
      expect(sanitizeForCSV('-1+2')).toBe("'-1+2")
      expect(sanitizeForCSV('@SUM(1,2)')).toBe("'@SUM(1,2)")
      expect(sanitizeForCSV('\tvalue')).toBe("'\tvalue")
      expect(sanitizeForCSV('\rvalue')).toBe("'\rvalue")
    })

    it('converts non-string inputs to string before sanitizing', () => {
      expect(sanitizeForCSV(123 as any)).toBe('123')
      expect(sanitizeForCSV({} as any)).toBe('[object Object]')
    })
  });
});
