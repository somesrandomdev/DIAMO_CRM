## 2025-04-17 - A11y for mobile menu icon buttons
**Learning:** Icon-only navigation buttons in mobile drawers frequently lack proper aria-attributes to associate the trigger with the drawer content, making them difficult for screen-reader users to understand the state and purpose of the action.
**Action:** When implementing mobile menus or sidebars, always pair `aria-expanded` and `aria-controls` on the trigger buttons and properly label them using `aria-label`. Ensure the target element has the corresponding `id`.
## 2024-04-16 - Add ARIA labels and focus states to cart remove buttons
**Learning:** Icon-only interactive elements in dynamic lists (like cart items) frequently lack proper accessible names and focus indicators, making it hard for screen reader users to identify the action and for keyboard users to navigate.
**Action:** Consistently add `aria-label`, `title`, and `focus-visible` ring utilities to icon-only buttons (`<button>✕</button>`) across the application to ensure they are accessible and intuitive for all users.
## 2025-04-26 - Form Accessibility and Error Feedback
**Learning:** React form inputs without explicit `htmlFor` bindings and dynamic error messages without `role="alert"` or `aria-live` regions severely degrade the experience for screen reader users by silently failing to associate contexts or announce dynamic changes.
**Action:** Always link form labels to their inputs using explicit `htmlFor` and `id` attributes. Ensure all form validation messages or error containers have `role="alert"` and `aria-live="assertive"` to enforce immediate announcement. Additionally, indicate form submission loading states via `aria-busy={loading}`.
