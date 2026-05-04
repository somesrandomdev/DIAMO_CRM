## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.

## 2025-05-18 - Prevented User Enumeration in Authentication
**Vulnerability:** The application was exposing specific login errors like 'User not found' and 'Wrong password' to the user interface, which could be exploited by attackers to verify valid email addresses in the system.
**Learning:** Returning specific authentication error messages reveals too much information about account existence. Error handling logic must be careful not to leak state.
**Prevention:** Always consolidate authentication failures (e.g., wrong password, user not found) into a generic message like 'Identifiants incorrects' to prevent user enumeration attacks.
