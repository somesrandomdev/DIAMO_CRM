## 2026-06-30 - DOM-based XSS in PDF Generator
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering using html2canvas are appended to the document body with unsanitized user inputs in their innerHTML.
**Learning:** Generating PDFs client-side often relies on creating hidden DOM nodes. If these nodes use innerHTML with unsanitized data, they introduce DOM-based XSS vulnerabilities even if the nodes are only temporary.
**Prevention:** Always use sanitizeHTML() or DOMPurify.sanitize() before assigning user data to innerHTML, even for transient elements.
