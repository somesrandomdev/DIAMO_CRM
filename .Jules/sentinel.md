## 2026-04-18 - [Sentinel] XSS Vulnerability in innerHTML
**Vulnerability:** Use of innerHTML without full sanitization in ticket generation.
**Learning:** The built-in escapeHTML function doesn't cover all cases and DOMPurify is needed to prevent XSS.
**Prevention:** Always use DOMPurify when assigning strings to innerHTML.
