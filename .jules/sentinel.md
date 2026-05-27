## 2024-05-18 - Fix DOM-based XSS in ticket generation
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering in `src/lib/ticketGenerator.ts` were interpolating unsanitized user-controlled variables (`client.nom`, `kiosque.nom`, etc.) directly into `innerHTML`.
**Learning:** Even internal or transient elements appending to the document body for rendering (like `html2canvas` inputs) are fully susceptible to DOM-based XSS, and variables injected must be treated just like any other user-facing output.
**Prevention:** Always use `escapeHtml()` from `src/utils/validation.ts` or `DOMPurify.sanitize()` before assigning any user data to `innerHTML`, even for transient or non-displayed DOM elements.
