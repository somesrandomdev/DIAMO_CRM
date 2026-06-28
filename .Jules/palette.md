## 2024-05-24 - Added aria-labels to icon-only buttons
**Learning:** Found multiple icon-only action buttons (Edit, Delete, Add) missing aria-labels in AdminDashboardEnhanced.tsx and AdminDashboard.tsx which makes them inaccessible to screen readers.
**Action:** Always add descriptive `aria-label` and `title` attributes to icon-only buttons for screen readers and tooltips.
