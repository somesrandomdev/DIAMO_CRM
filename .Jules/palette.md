## 2024-05-15 - Missing ARIA attributes on mobile menu toggle buttons
**Learning:** Found that the app uses icon-only toggle buttons in `src/components/Layout.tsx` for the mobile menu without proper ARIA attributes like `aria-label`, `aria-expanded`, and `aria-controls`.
**Action:** Enhance the mobile menu toggle buttons with proper ARIA attributes, including an `id` on the sidebar container for the `aria-controls` mapping.
