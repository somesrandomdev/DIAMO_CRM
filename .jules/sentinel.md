## 2026-04-15 - Fixed CSV Injection vulnerability in HistoriquePage.tsx
**Vulnerability:** Unsanitized user-controlled data (client name, offer name) was being exported directly to CSV, enabling potential formula injection attacks (CSV Injection) if malicious payloads starting with =, +, -, @ were opened in spreadsheet applications.
**Learning:** Exporting raw strings directly to CSV formats without wrapping and prefix escaping is a vector for code execution in spreadsheet applications.
**Prevention:** Always use a dedicated sanitizeForCSV utility that prepends an apostrophe to formula trigger characters and safely escapes/wraps fields in double quotes before constructing CSV payloads.

## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.
