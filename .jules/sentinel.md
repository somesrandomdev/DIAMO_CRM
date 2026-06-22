## 2025-02-28 - Transient DOM Elements XSS Risk
**Vulnerability:** DOM-based XSS via user input (`client.nom`, `offre.nom`, etc.) concatenated directly into `innerHTML` of transient DOM elements during PDF generation.
**Learning:** Even transient elements created programmatically (`document.createElement`) and appended briefly to the DOM (for `html2canvas`) execute scripts and are fully vulnerable to XSS if their `innerHTML` is populated with unsanitized user data.
**Prevention:** Always escape user input using `escapeHtml()` or `DOMPurify.sanitize()` before injecting it into any HTML template string assigned to `innerHTML`, regardless of how briefly the element exists in the DOM.
