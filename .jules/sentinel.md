## 2024-05-24 - DOM-based XSS via HTML Canvas Generators
**Vulnerability:** Transient DOM elements created for canvas/PDF rendering (like `html2canvas`) were directly interpolating user input into `.innerHTML`, leading to a DOM-based XSS vulnerability.
**Learning:** Even if an element is appended to `document.body` temporarily (or hidden) merely to snapshot its layout and structure for rendering, it is still part of the active DOM and executes inserted `<script>` tags or inline event handlers immediately.
**Prevention:** Always apply HTML entity encoding (using `escapeHtml`) or use `DOMPurify.sanitize()` before injecting any user-controlled data into `.innerHTML`, regardless of how long the element remains in the DOM or its visual visibility.
