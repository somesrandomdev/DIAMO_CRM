## 2024-05-14 - Admin Dashboard Accessible Action Buttons
**Learning:** Icon-only action buttons (Edit/Delete) in data tables across the admin dashboard were lacking `aria-label` and `title` attributes, rendering them inaccessible to screen readers and lacking native hover tooltips for sighted users.
**Action:** Always ensure that any icon-only button, especially those performing critical CRUD operations, is paired with descriptive, localized `aria-label` and `title` attributes (e.g., `aria-label="Modifier le kiosque"`).
