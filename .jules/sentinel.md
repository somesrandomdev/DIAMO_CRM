## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2025-05-24 - Fixed CSV/Formula Injection vulnerability in HistoriquePage.tsx
**Vulnerability:** User-controlled data (e.g., client names, offer names) in the sales history was exported directly to CSV without sanitization, exposing a CSV/Formula Injection vulnerability where malicious input could execute commands on the victim's machine when opened in a spreadsheet application.
**Learning:** Any user-controlled input exported to CSV files can be interpreted as a formula in applications like Microsoft Excel or Google Sheets. Basic string replacement (like `sanitizeString`) does not mitigate this, as formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) must be escaped.
**Prevention:** Always use a dedicated CSV sanitization function (like `sanitizeForCSV`) to prepend an apostrophe `'` to fields starting with formula characters, and properly encapsulate all fields within double quotes (while escaping internal double quotes) prior to CSV export.
