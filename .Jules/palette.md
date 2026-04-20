## 2025-04-17 - A11y for mobile menu icon buttons
**Learning:** Icon-only navigation buttons in mobile drawers frequently lack proper aria-attributes to associate the trigger with the drawer content, making them difficult for screen-reader users to understand the state and purpose of the action.
**Action:** When implementing mobile menus or sidebars, always pair `aria-expanded` and `aria-controls` on the trigger buttons and properly label them using `aria-label`. Ensure the target element has the corresponding `id`.
## 2024-04-16 - Add ARIA labels and focus states to cart remove buttons
**Learning:** Icon-only interactive elements in dynamic lists (like cart items) frequently lack proper accessible names and focus indicators, making it hard for screen reader users to identify the action and for keyboard users to navigate.
**Action:** Consistently add `aria-label`, `title`, and `focus-visible` ring utilities to icon-only buttons (`<button>✕</button>`) across the application to ensure they are accessible and intuitive for all users.
## 2026-04-20 - Combining visual feedback with screen reader accessibility during async form submissions
**Learning:** Relying solely on visual loading indicators (like a spinner or changing button text to 'Chargement...') excludes screen reader users from understanding that a form submission is in progress. Furthermore, dynamic error messages appearing after submission may go unnoticed if not explicitly marked.
**Action:** When creating async forms, combine visual loading indicators (spinners) with `aria-busy={true}` on the submit button. Ensure that containers for error or status messages use `role="alert"` so that any feedback is automatically announced to assistive technologies.
