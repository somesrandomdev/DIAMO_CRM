## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2024-05-24 - Fix CSV Injection in HistoriquePage.tsx
**Vulnerability:** User-controlled data (client name and offer name) was exported directly into a CSV without sanitization, allowing potential CSV/Formula Injection if the user input started with a formula trigger character like `=`.
**Learning:** Even internal dashboards can be vectors for attacks like CSV Injection if user-provided content is rendered directly into a CSV file downloaded by administrators or users.
**Prevention:** Always sanitize data destined for CSV export by prepending a benign character (like an apostrophe `'`) to fields starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`). We implemented and used `sanitizeForCSV` for this.
