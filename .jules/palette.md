## 2025-02-20 - Missing ARIA Labels on Icon Buttons
**Learning:** The application uses many icon-only buttons (like Edit/Delete with FaEdit and FaTrash) without accessible names, making them difficult to use for screen reader users.
**Action:** Add `aria-label` and `title` attributes to icon-only action buttons across the application components like AdminDashboardEnhanced.
