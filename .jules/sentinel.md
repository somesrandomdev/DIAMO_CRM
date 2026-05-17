## 2025-02-27 - Fix User Enumeration Vulnerability
**Vulnerability:** The login flow was exposing specific error messages like "User not found" and "Wrong password", which allowed attackers to figure out if an email existed on the platform.
**Learning:** Returning overly detailed error messages on authentication endpoints compromises security by confirming valid user identifiers.
**Prevention:** Always consolidate authentication errors (e.g. invalid login, wrong password, user not found) into a single generic message (e.g., 'Identifiants incorrects') across both the UI and global error handlers to prevent user enumeration.
