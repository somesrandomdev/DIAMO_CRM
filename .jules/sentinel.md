## 2024-05-18 - DOM XSS in Canvas Rendering Elements

**Vulnerability:** A DOM XSS vulnerability existed in `src/lib/ticketGenerator.ts` where user-controlled data (`client.nom`, `kiosque.nom`, etc.) was inserted directly into a transient DOM element's `innerHTML` without sanitization, prior to rendering it with `html2canvas`. Furthermore, the `sanitizeHTML` function in `src/utils/security.ts` was improperly encoding `&` alongside other characters in a single `.replace()` call using a map, which could lead to double-encoding issues or missed entities.

**Learning:** Transient DOM elements created for canvas or PDF generation and appended to `document.body` are still executed by the browser and thus susceptible to DOM-based XSS attacks. The internal HTML sanitizer must be rigorous and securely handle `null` / `undefined` types safely, and must encode `&` to `&amp;` before other characters when chaining `.replace()` calls to avoid double-encoding (e.g. converting `<` to `&lt;` and then `&` to `&amp;lt;`).

**Prevention:** Always use `sanitizeHTML()` or `DOMPurify.sanitize()` when injecting any user-controlled string into `innerHTML`, even for transient, non-visible elements meant purely for canvas rendering. Furthermore, when writing custom sanitization functions, ensure robust type checking and sequential replacement starting with `&`.
