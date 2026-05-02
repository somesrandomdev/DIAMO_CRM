## 2026-04-15 - Fixed XSS vulnerability in ticketGenerator.ts
**Vulnerability:** User-controlled data (via escapeHTML with some bypass edge cases depending on HTML structure and attributes) was directly interpolated into an HTML string and assigned to `container.innerHTML` without a robust sanitization library.
**Learning:** Even if data is escaped before being inserted into an HTML string using basic regex replacements, it might still be vulnerable to XSS due to contextual edge cases or omissions in the custom escape function. The `sanitizeString` function is insufficient.
**Prevention:** Always use a mature, battle-tested sanitization library like `DOMPurify` (using `DOMPurify.sanitize()`) when dynamically injecting HTML content, rather than relying on custom string escaping logic.
## 2024-05-24 - User Enumeration in Authentication
**Vulnerability:** Login page exposed whether an email address existed in the database by returning different error messages for "User not found" and "Wrong password".
**Learning:** Specific authentication error messages provide attackers with information to enumerate valid accounts, which can be used for targeted attacks like credential stuffing. This was present in both `src/pages/Login.tsx` and `src/lib/supabase.ts`.
**Prevention:** Consolidate authentication error messages into a generic response (e.g., "Identifiants incorrects" or "Invalid login credentials") for both invalid usernames and invalid passwords to prevent information leakage.
