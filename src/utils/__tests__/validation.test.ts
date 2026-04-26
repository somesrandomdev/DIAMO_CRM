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

import { sanitizeForCSV } from '../validation';

describe('sanitizeForCSV', () => {
  it('should return empty string enclosed in quotes for null or undefined', () => {
    expect(sanitizeForCSV(null)).toBe('""');
    expect(sanitizeForCSV(undefined)).toBe('""');
  });

  it('should escape double quotes and enclose string in quotes', () => {
    expect(sanitizeForCSV('test "value"')).toBe('"test ""value"""');
  });

  it('should prepend apostrophe if string starts with formula trigger', () => {
    expect(sanitizeForCSV('=1+1')).toBe('"' + "'=1+1" + '"');
    expect(sanitizeForCSV('+1')).toBe('"' + "'+1" + '"');
    expect(sanitizeForCSV('-1')).toBe('"' + "'-1" + '"');
    expect(sanitizeForCSV('@cmd')).toBe('"' + "'@cmd" + '"');
    expect(sanitizeForCSV('\tcmd')).toBe('"' + "'\tcmd" + '"');
    expect(sanitizeForCSV('\rcmd')).toBe('"' + "'\rcmd" + '"');
  });

  it('should wrap normal strings in quotes without prepending apostrophe', () => {
    expect(sanitizeForCSV('normal string')).toBe('"normal string"');
    expect(sanitizeForCSV('1+1')).toBe('"1+1"');
  });
});
