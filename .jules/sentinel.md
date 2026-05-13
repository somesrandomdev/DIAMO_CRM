## 2025-03-08 - Consolidation of Authentication Error Messages
**Vulnerability:** User enumeration vulnerability during authentication.
**Learning:** Returning specific error messages like "User not found" or "Wrong password" allows an attacker to verify if an email address exists in the system.
**Prevention:** Consolidate error messages into a generic "Identifiants incorrects" (or similar) to prevent user enumeration.
