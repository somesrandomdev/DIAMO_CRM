## 2024-06-13 - DOM-based XSS via html2canvas innerHTML injection
**Vulnerability:** User-controlled data (client name, kiosk name/address, offer names) were directly interpolated into a transient DOM element's `innerHTML` in `src/lib/ticketGenerator.ts` before being rendered to a PDF via `html2canvas`.
**Learning:** Even elements that are temporarily attached to the DOM for rendering purposes (like PDF generation canvases) are subject to DOM-based XSS. A malicious payload in user input could execute JavaScript when the element is appended to `document.body`.
**Prevention:** Always use `escapeHtml` (now available in `src/utils/validation.ts`) or `DOMPurify.sanitize()` to encode all dynamic data when constructing HTML strings for `innerHTML`, even for transient or off-screen elements.
