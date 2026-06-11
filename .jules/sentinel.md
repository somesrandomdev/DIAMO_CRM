
## 2024-05-18 - DOM-based XSS via transient canvas elements
**Vulnerability:** DOM-based XSS was possible in `src/lib/ticketGenerator.ts` because user-provided data (`kiosque.nom`, `client.nom`, `offre.nom`, etc.) was interpolated directly into a template string and assigned to `container.innerHTML` before being appended to `document.body` for PDF rendering via `html2canvas`.
**Learning:** Even transient DOM elements that are only briefly attached to the document for rendering purposes (like canvas generation or PDF exports) are susceptible to executing malicious scripts if user input is not escaped before being assigned via `innerHTML`.
**Prevention:** Always sanitize or escape user-controlled data using `escapeHtml()` from `src/utils/validation.ts` or `DOMPurify.sanitize()` before assigning it to `innerHTML`, regardless of how briefly the element exists in the DOM.
