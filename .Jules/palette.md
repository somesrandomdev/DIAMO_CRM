## 2026-06-03 - AdminDashboardEnhanced Icon Accessibility
**Learning:** Icon-only action buttons (Edit, Delete, Add, etc.) in AdminDashboardEnhanced lack `aria-label` attributes and `title` tooltips. Screen reader users and those seeking visual tooltips have no context on what the buttons do.
**Action:** Add descriptive `aria-label` and `title` to all icon-only buttons in AdminDashboardEnhanced.tsx
