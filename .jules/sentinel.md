## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.
## 2024-04-20 - Prevent CSV Injection in CSV Export
**Vulnerability:** User-controlled data (client name and offer name) were directly included in the CSV export without sanitization, leading to a CSV Injection (Formula Injection) vulnerability if a user inputs a name starting with formula trigger characters like `=`, `+`, `-`, or `@`.
**Learning:** Always sanitize user-controlled input before including it in CSV exports.
**Prevention:** Use a function like `sanitizeForCSV` to prepend an apostrophe `'` to any string that starts with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) before adding it to the CSV content.
