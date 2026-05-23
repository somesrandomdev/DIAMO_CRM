## 2024-05-23 - Missing ARIA Labels on Icon-only Action Buttons
**Learning:** Icon-only action buttons (Edit, Delete) in administrative data tables often lack `aria-label` attributes and `title` tooltips, making them inaccessible to screen readers and difficult to understand without hovering.
**Action:** When adding or reviewing icon-only buttons in data grids or lists, consistently add descriptive `aria-label` and `title` attributes that clarify the action and the target item (e.g., "Modifier le kiosque").
