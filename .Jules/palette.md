## 2024-05-24 - Accessibility for Icon-only buttons
**Learning:** Icon-only action buttons in tables (Edit, Delete) in the AdminDashboardEnhanced page lack `aria-label` or `title` attributes, which creates an accessibility issue for screen readers and removes a helpful tooltip for general users.
**Action:** Always add descriptive `aria-label` and `title` attributes to icon-only buttons (e.g., `aria-label="Modifier l'utilisateur"`, `title="Modifier"`) when they don't have visible text labels.
