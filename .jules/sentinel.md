## 2025-05-18 - DOM-based XSS via html2canvas
**Vulnerability:** Transient elements created for PDF rendering via html2canvas inject unescaped user inputs directly into innerHTML, creating a DOM-based XSS risk.
**Learning:** Even transient off-screen elements that are immediately removed can execute script payloads if they are appended to the document body and use innerHTML for templating.
**Prevention:** Always use `escapeHtml()` or DOMPurify when assigning user-controlled data to innerHTML, regardless of whether the element is visible or permanent.
