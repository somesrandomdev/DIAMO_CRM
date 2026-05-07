## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2026-04-16 - Fixed CSV Injection Vulnerability in Export
**Vulnerability:** User-controlled data (e.g., client names, offer names) was directly exported to CSV files without escaping or structural protection. This allowed CSV/Formula injection (e.g. a name starting with '=cmd|...') and structural corruption if fields contained quotes or commas.
**Learning:** Even internal data that is seemingly simple might be user-generated or contain characters that are special in the CSV format. Unescaped data in CSVs represents a significant risk if users open them in spreadsheet applications.
**Prevention:** Always sanitize data being exported to CSV. Use a utility (like `sanitizeForCSV`) to prepend an apostrophe for formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`), and consistently wrap fields in double quotes while escaping internal double quotes.
