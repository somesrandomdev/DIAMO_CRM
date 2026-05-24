## 2026-05-24 - [DOM-based XSS in Ticket Generator]
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering in `src/lib/ticketGenerator.ts` directly assign user data (e.g., client names, offer names) to `innerHTML` without sufficient sanitization.
**Learning:** The native `sanitizeString` function may not be sufficient for full XSS protection when assigning to `innerHTML`. A proper `escapeHtml` function should be used to HTML encode user-controlled data before appending it to the DOM.
**Prevention:** Always apply HTML entity encoding (using an `escapeHtml` helper) or use `DOMPurify.sanitize()` when injecting user-controlled data into `innerHTML`. Do not rely solely on simple regex replacement functions for XSS prevention in HTML contexts.
