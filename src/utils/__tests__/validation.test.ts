import { validateURL } from '../validation';

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
  const { sanitizeForCSV } = require('../validation');

  it('should escape CSV injection prefixes with an apostrophe', () => {
    expect(sanitizeForCSV('=1+2')).toBe('"\'=1+2"');
    expect(sanitizeForCSV('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(sanitizeForCSV('-10')).toBe('"\'-10"');
    expect(sanitizeForCSV('@cmd|')).toBe('"\'@cmd|"');
    expect(sanitizeForCSV('\tInjection')).toBe('"\'\tInjection"');
    expect(sanitizeForCSV('\rInjection')).toBe('"\'\rInjection"');
  });

  it('should wrap normal text in double quotes', () => {
    expect(sanitizeForCSV('Normal text')).toBe('"Normal text"');
  });

  it('should escape existing double quotes', () => {
    expect(sanitizeForCSV('Text with "quotes"')).toBe('"Text with ""quotes"""');
  });

  it('should return empty string wrapped in quotes for null or undefined', () => {
    expect(sanitizeForCSV(null)).toBe('""');
    expect(sanitizeForCSV(undefined)).toBe('""');
  });

  it('should stringify and quote numbers', () => {
    expect(sanitizeForCSV(123)).toBe('"123"');
  });
});
