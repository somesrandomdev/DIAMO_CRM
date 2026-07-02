## 2024-07-02 - [Fix XSS Bypass in sanitizeHTML]
**Vulnerability:** `sanitizeHTML` only checked `if (typeof html !== 'string') return ''`, which meant non-string objects (like arrays) were silently dropped instead of sanitized. The entity map was also broken (`&` mapped to `&`, etc.).
**Learning:** Returning early on type mismatch can leave a system vulnerable if a subsequent processor (or coercion) re-introduces the payload. Always coerce input to string before sanitizing, or properly reject it. The broken entity map meant XSS vectors (like `<script>`) were completely ignored.
**Prevention:** Change input types to `unknown`, perform strict checks against null/undefined, explicitly cast input to a string, and apply the correct HTML entity replacements to ensure full encoding.
