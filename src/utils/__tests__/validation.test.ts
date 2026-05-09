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

  it('should wrap basic strings in quotes', () => {
    expect(sanitizeForCSV('hello')).toBe('"hello"');
  });

  it('should return empty quotes for null or undefined', () => {
    expect(sanitizeForCSV(null)).toBe('""');
    expect(sanitizeForCSV(undefined)).toBe('""');
  });

  it('should stringify numbers and wrap in quotes', () => {
    expect(sanitizeForCSV(123)).toBe('"123"');
    expect(sanitizeForCSV(0)).toBe('"0"');
  });

  it('should escape strings starting with trigger characters', () => {
    expect(sanitizeForCSV('=1+1')).toBe('"' + "'=1+1" + '"');
    expect(sanitizeForCSV('+A1')).toBe('"' + "'+A1" + '"');
    expect(sanitizeForCSV('-B2')).toBe('"' + "'-B2" + '"');
    expect(sanitizeForCSV('@SUM(A1:A10)')).toBe('"' + "'@SUM(A1:A10)" + '"');
    expect(sanitizeForCSV('\tHello')).toBe('"' + "'\tHello" + '"');
    expect(sanitizeForCSV('\rWorld')).toBe('"' + "'\rWorld" + '"');
  });

  it('should double internal quotes', () => {
    expect(sanitizeForCSV('hello "world"')).toBe('"hello ""world"""');
    expect(sanitizeForCSV('="malicious"')).toBe('"\'=""malicious"""');
  });
});
