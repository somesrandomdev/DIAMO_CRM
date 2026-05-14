## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.
## 2024-05-18 - Prevent CSV Injection in Historique Ventes
**Vulnerability:** CSV Injection (Formula Injection) vulnerability in `exportToCSV` function in `src/pages/HistoriquePage.tsx`.
**Learning:** Raw user input (like `sale.client?.nom`) was concatenated directly into the CSV payload without escaping formula trigger characters. This could allow an attacker to execute arbitrary formulas in the victim's spreadsheet software.
**Prevention:** Implement and apply a `sanitizeForCSV` function that prepends a single quote `'` to fields starting with formula triggers (`=`, `+`, `-`, `@`, etc.) and correctly wraps the field in double quotes while escaping internal double quotes.
