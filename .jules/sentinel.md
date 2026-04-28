## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2024-05-18 - Fixed CSV Injection Vulnerability
**Vulnerability:** User-controlled data (client name, offer name) was directly exported to CSV without sanitization in `HistoriquePage.tsx`. This could allow CSV Injection (Formula Injection) if a user inputted a string starting with `=`, `+`, `-`, or `@`.
**Learning:** CSV files generated client-side from user data must sanitize inputs. If not, when opened in spreadsheet software like Excel, formulas can execute, potentially leading to arbitrary code execution or data exfiltration.
**Prevention:** Use a `sanitizeForCSV` function to prepend an apostrophe to any string starting with formula triggers, wrap all strings in double quotes, and escape internal quotes by doubling them (`""`). Always apply this to all user-provided data before joining them into CSV rows.
