## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2026-04-16 - Fixed User Enumeration Vulnerability in Login
**Vulnerability:** The login form previously displayed specific error messages like "Aucun compte trouvé avec cet email" (User not found) and "Mot de passe incorrect" (Wrong password). This allowed attackers to enumerate valid email addresses registered in the system.
**Learning:** Returning specific authentication errors directly exposes the system to user enumeration attacks.
**Prevention:** Consolidate error messages for invalid credentials, missing users, and wrong passwords into a single, generic message like "Identifiants incorrects" across all authentication points.
