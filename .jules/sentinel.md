## 2026-07-07 - DOM-Based XSS in PDF Generator
**Vulnerability:** Unsanitized user inputs (client name, kiosk name, etc.) were interpolated directly into the innerHTML of a transient DOM element used by html2canvas.
**Learning:** Transient elements used for internal operations like rendering or PDF generation are still subject to DOM-based XSS when appended to the document body.
**Prevention:** Always apply HTML entity encoding (e.g., using sanitizeHTML) to untrusted string inputs before inserting them into innerHTML, regardless of whether the element is temporarily or permanently added to the DOM.
