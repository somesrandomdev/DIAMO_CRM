## 2024-05-24 - Fix XSS Vulnerability in sanitizeHTML
**Vulnerability:** The sanitizeHTML function failed to properly encode &, <, >, and ", allowing XSS attacks. It also accepted only strings, allowing potential bypasses via objects/arrays.
**Learning:** HTML entity maps must correctly map to their encoded counterparts, and unknown inputs must be coerced to string properly before sanitization. & must be replaced first.
**Prevention:** Use correct entity maps or chained replaces starting with &, and always accept unknown type, explicitly coercing to string to prevent object bypasses.
