## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.
## 2026-04-16 - Prevented CSV Injection in HistoriquePage export
**Vulnerability:** User-controlled client and offer names could be manipulated to start with =, +, -, or @, leading to CSV injection (formula injection) when the CSV export from HistoriquePage is opened in applications like Excel or Google Sheets.
**Learning:** Data intended for CSV export must be sanitized to escape formula triggers, even if it has already passed standard application-level validation.
**Prevention:** Always use a specific sanitization routine (e.g., prepending an apostrophe `'` to formula triggers) when formatting user input for CSV export.
