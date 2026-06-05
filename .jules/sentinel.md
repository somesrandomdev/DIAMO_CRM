## 2024-05-24 - DOM-based XSS in PDF Generation
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering in `ticketGenerator.ts` were appending unsanitized user data directly to `innerHTML`.
**Learning:** Even invisible or transient DOM elements used for rendering processes (like `html2canvas`) execute HTML and are vulnerable to DOM-based XSS. Standard input sanitization might miss entity encoding requirements.
**Prevention:** Always apply strict HTML entity encoding (e.g., using an `escapeHtml` helper) before interpolating any user-controlled data into HTML templates that will be parsed by the browser DOM.
