
## 2025-02-28 - DOM XSS in HTML-to-PDF rendering (html2canvas)
**Vulnerability:** Unsanitized user inputs (`client.nom`, `kiosque.nom`, etc.) were directly interpolated into a transient DOM element's `innerHTML` string before being rendered to PDF using `html2canvas`.
**Learning:** Transient DOM elements created for PDF or canvas rendering (even if only appended temporarily to `document.body`) are fully susceptible to DOM-based XSS if user-controlled data is injected via `innerHTML`. The library (`html2canvas`) evaluates the HTML, meaning any malicious script tags or event handlers injected could be executed in the context of the application.
**Prevention:** Always use `sanitizeHTML()` (or `DOMPurify.sanitize()`) to encode user-controlled data before interpolating it into HTML template strings, even for temporary, off-screen, or transient elements.
