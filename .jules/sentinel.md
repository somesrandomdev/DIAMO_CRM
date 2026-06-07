## 2025-02-28 - DOM-based XSS in Ticket Generator
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering in `src/lib/ticketGenerator.ts` assigned user-controlled data directly to `innerHTML` without sanitization. This allowed DOM-based Cross-Site Scripting (XSS) if malicious payloads were passed in fields like client name or kiosk name.
**Learning:** Even elements that are temporarily appended to the document body for rendering purposes (like with html2canvas) are executed by the browser and thus susceptible to XSS.
**Prevention:** Always apply HTML entity encoding (using `escapeHtml`) or use `DOMPurify.sanitize()` before injecting any user-controlled data into `innerHTML`, even for transient DOM elements used for canvas/PDF rendering.
