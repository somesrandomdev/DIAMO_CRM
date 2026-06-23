## 2024-06-23 - DOM-based XSS in Canvas Rendering via Transient Elements
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering (`document.createElement`) were assigned user-controlled data directly via `innerHTML` without sanitization.
**Learning:** Even though elements might only exist temporarily in the DOM before being converted to a canvas or PDF (e.g., using `html2canvas`), any execution of `innerHTML` with unsanitized data poses a critical DOM-based XSS vulnerability.
**Prevention:** Always sanitize or encode data (e.g., using `escapeHtml()`) before injecting it into `innerHTML`, regardless of whether the element is attached to the document or meant to be short-lived. Alternatively, construct DOM nodes securely using `textContent` and `appendChild`.
