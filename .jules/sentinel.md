## 2026-06-19 - Fix DOM-based XSS in Ticket Generator
**Vulnerability:** DOM-based XSS in `src/lib/ticketGenerator.ts` where unescaped user-controlled inputs (`offre.nom`, `client.nom`, `kiosque.nom`, etc.) were directly injected into `container.innerHTML` before passing to `html2canvas`.
**Learning:** Transient DOM elements created for canvas/PDF rendering, even if temporarily attached to `document.body` and quickly removed, are still vulnerable to DOM XSS if they evaluate unsanitized HTML containing malicious payloads.
**Prevention:** Always apply HTML entity encoding (using a utility like `escapeHtml`) or `DOMPurify.sanitize()` before injecting dynamic data into `innerHTML`, regardless of how short-lived the DOM element is.
