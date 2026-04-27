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
  });
});

describe('sanitizeForCSV', () => {
  it('should quote normal strings', () => {
    expect(sanitizeForCSV("Normal string")).toBe('"Normal string"');
  });

  it('should prepend apostrophe to strings starting with formula triggers', () => {
    expect(sanitizeForCSV("=cmd|' /C calc'!A0")).toBe('"' + "'=cmd|' /C calc'!A0" + '"');
    expect(sanitizeForCSV("+A1+B1")).toBe('"' + "'+A1+B1" + '"');
    expect(sanitizeForCSV("-A1+B1")).toBe('"' + "'-A1+B1" + '"');
    expect(sanitizeForCSV("@SUM(A1:A10)")).toBe('"' + "'@SUM(A1:A10)" + '"');
    expect(sanitizeForCSV("\tInjected")).toBe('"' + "'\tInjected" + '"');
    expect(sanitizeForCSV("\rInjected")).toBe('"' + "'\rInjected" + '"');
  });

  it('should handle null and undefined', () => {
    expect(sanitizeForCSV(null)).toBe('""');
    expect(sanitizeForCSV(undefined)).toBe('""');
  });

  it('should escape internal quotes', () => {
    expect(sanitizeForCSV('Quote"here')).toBe('"Quote""here"');
  });

  it('should handle non-string inputs by converting them to strings', () => {
    expect(sanitizeForCSV(123)).toBe('"123"');
    expect(sanitizeForCSV(true)).toBe('"true"');
  });
});
