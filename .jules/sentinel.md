## 2026-06-02 - DOM-based XSS via innerHTML
**Vulnerability:** DOM-based XSS vulnerability when interpolating user-controlled values (client name, kiosk name, offer name) into string templates and assigning them to container.innerHTML during PDF generation.
**Learning:** Direct assignment of user data to innerHTML without proper encoding creates XSS risk, even if the element is appended and quickly removed. The sanitizeString function isn't sufficient for full XSS protection in HTML contexts.
**Prevention:** Always use HTML entity encoding (e.g. escapeHtml) before assigning user data to innerHTML, or use DOMPurify.
