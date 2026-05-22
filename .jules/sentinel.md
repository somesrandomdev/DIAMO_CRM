## 2025-03-05 - Add DOMPurify to Ticket Generator innerHTML
**Vulnerability:** XSS via unescaped user input (client.nom, kiosque.nom, etc.) assigned directly to innerHTML in src/lib/ticketGenerator.ts.
**Learning:** User inputs from Supabase must always be sanitized before being used in innerHTML, even for transient PDF generation elements, to prevent DOM-based XSS when html2canvas executes the rendered content.
**Prevention:** Always use DOMPurify.sanitize() when constructing innerHTML strings containing variable data.
