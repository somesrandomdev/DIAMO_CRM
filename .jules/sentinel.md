
## 2024-05-24 - Transient DOM XSS in Canvas Rendering
**Vulnerability:** DOM-based Cross-Site Scripting (XSS) in `src/lib/ticketGenerator.ts` where unescaped user inputs (`client.nom`, `kiosque.nom`, etc.) were directly injected into a transient DOM element's `innerHTML` before rendering it to a canvas.
**Learning:** Even if a DOM element is transient (created just for rendering a canvas/PDF and quickly removed), assigning user-controlled data to its `innerHTML` without proper sanitization/escaping allows arbitrary script execution within the context of the application.
**Prevention:** Always use HTML entity encoding (e.g., a custom `escapeHtml` utility) or a sanitizer like DOMPurify before interpolating user-controlled string inputs into any element's `innerHTML`, regardless of whether the element is permanently attached to the document or just temporarily appended for a rendering pipeline.
