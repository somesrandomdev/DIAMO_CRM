## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2026-04-16 - Prevented CSV Injection in sales history export
**Vulnerability:** User-controlled inputs (`sale.client?.nom` and `sale.offre?.nom`) were directly inserted into CSV export content without sanitization or proper escaping, making it possible for attackers to inject malicious formulas (CSV Injection) and corrupt the CSV format via line breaks and commas.
**Learning:** CSV exports built dynamically from strings without strict structural safeguards and sanitization are vulnerable to spreadsheet software rendering malicious inputs (starting with `=`, `+`, `-`, `@`, `\t`, `\r`) as executable logic.
**Prevention:** Always wrap CSV fields in double quotes and escape internal quotes to prevent field splitting. In addition, prepend an apostrophe to any string field that starts with formula trigger characters before building the CSV to neuter spreadsheet logic interpretation.
