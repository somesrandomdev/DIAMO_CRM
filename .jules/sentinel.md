## 2024-06-21 - DOM-based XSS via HTML Canvas PDF Generation
**Vulnerability:** Transient DOM elements created for PDF/canvas generation (via \`html2canvas\`) were appended directly to \`document.body\` and populated using \`innerHTML\` without HTML entity encoding, creating a DOM-based Cross-Site Scripting (XSS) vulnerability.
**Learning:** Even hidden or temporarily appended DOM elements used exclusively for off-screen rendering pose an XSS risk if unsanitized user inputs are injected into them, because the browser parses and executes the injected HTML/scripts as soon as they are added to the DOM.
**Prevention:** Always apply HTML entity encoding (e.g., using \`escapeHtml\`) or a sanitizer like DOMPurify when constructing \`innerHTML\`, even for transient or off-screen elements.
