## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2024-05-18 - Prevented CSV/Formula Injection
**Vulnerability:** User-controlled data (client name and offer name) was directly interpolated into a CSV string without sanitization, leading to potential CSV/Formula Injection vulnerabilities when the file is opened in applications like Excel.
**Learning:** If user data starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is exported to CSV, spreadsheet software may evaluate it as a formula, potentially executing malicious code.
**Prevention:** Always sanitize user-controlled input before including it in CSV exports. Utilize a `sanitizeForCSV` function to prepend an apostrophe (`'`) to strings starting with formula trigger characters.
