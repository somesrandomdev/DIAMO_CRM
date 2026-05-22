## 2026-05-22 - Missing ARIA label on delete buttons
**Learning:** Found an icon-only delete button in `AdminObjectivesPage.tsx` that lacks an `aria-label`. Additionally, there's another icon-only button (close) in `SlideOverDrawer.tsx` that's missing an `aria-label`. These are critical accessibility issues for screen reader users.
**Action:** Adding `aria-label` to icon-only buttons to ensure they're accessible.
