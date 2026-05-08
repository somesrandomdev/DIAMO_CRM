import { sanitizeForCSV } from '../validation';

describe('sanitizeForCSV', () => {
  it('should escape double quotes and wrap in double quotes', () => {
    expect(sanitizeForCSV('Normal text')).toBe('"Normal text"');
    expect(sanitizeForCSV('Text with "quotes"')).toBe('"Text with ""quotes"""');
  });

  it('should handle null or undefined', () => {
    expect(sanitizeForCSV(null)).toBe('""');
    expect(sanitizeForCSV(undefined)).toBe('""');
  });

  it('should convert numbers to strings and wrap in quotes', () => {
    expect(sanitizeForCSV(123)).toBe('"123"');
    expect(sanitizeForCSV(0)).toBe('"0"');
  });

  it('should prepend apostrophe to formula triggers', () => {
    expect(sanitizeForCSV('=1+2')).toBe('"' + "'=1+2" + '"');
    expect(sanitizeForCSV('+1-2')).toBe('"' + "'+1-2" + '"');
    expect(sanitizeForCSV('-1+2')).toBe('"' + "'-1+2" + '"');
    expect(sanitizeForCSV('@SUM(1,2)')).toBe('"' + "'@SUM(1,2)" + '"');
    expect(sanitizeForCSV('\tHello')).toBe('"' + "'\tHello" + '"');
    expect(sanitizeForCSV('\rHello')).toBe('"' + "'\rHello" + '"');
  });
});
