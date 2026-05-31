## 2024-05-24 - DOM-based XSS in Ticket Generator
**Vulnerability:** DOM-based XSS through `innerHTML` assignment when rendering tickets.
**Learning:** `src/lib/ticketGenerator.ts` generates PDFs by creating a DOM element, manually constructing an HTML string with unescaped variables like `client.nom`, `kiosque.nom`, etc., and setting it directly using `container.innerHTML`. The `sanitizeString` method removes `<>` but fails to protect against proper XSS in unquoted attributes or single quotes, and in this application, `escapeHtml` was not present or used.
**Prevention:** Add a robust `escapeHtml` utility and apply it to all user inputs before incorporating them into HTML template literals assigned to `innerHTML`.
