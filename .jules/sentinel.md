## 2025-06-15 - DOM-based XSS in Ticket Generator
**Vulnerability:** Transient DOM elements created for canvas rendering in `src/lib/ticketGenerator.ts` use `innerHTML` directly with user input (`client.nom`, `kiosque.nom`, etc).
**Learning:** `html2canvas` requires appending elements to the DOM. Using string interpolation with `innerHTML` opens up a critical DOM-based XSS vector when dealing with arbitrary user-controlled values (like a client's name or kiosk address).
**Prevention:** Always use `escapeHtml` (or `DOMPurify.sanitize`) before assigning user data to `innerHTML` when creating DOM elements, even transient ones.
