## 2024-06-12 - Fix XSS Vulnerability in sanitizeHTML

**Vulnerability:** The `sanitizeHTML` function in `src/utils/security.ts` mapped `<` and `>` to themselves, failing to prevent Cross-Site Scripting (XSS) via HTML tags. Double quotes and ampersands were also incorrectly mapped.
**Learning:** A custom implementation of HTML entity mapping was incorrect, rendering the security control ineffective. When implementing custom security functions, it is crucial to ensure that the replacement map actually escapes the characters.
**Prevention:** Rely on robust, well-tested libraries like `DOMPurify` for HTML sanitization when possible, or strictly verify that replacement maps correctly encode characters as HTML entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`).
