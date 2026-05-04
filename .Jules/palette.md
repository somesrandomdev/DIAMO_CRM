## 2025-04-17 - A11y for mobile menu icon buttons
**Learning:** Icon-only navigation buttons in mobile drawers frequently lack proper aria-attributes to associate the trigger with the drawer content, making them difficult for screen-reader users to understand the state and purpose of the action.
**Action:** When implementing mobile menus or sidebars, always pair `aria-expanded` and `aria-controls` on the trigger buttons and properly label them using `aria-label`. Ensure the target element has the corresponding `id`.
## 2024-04-16 - Add ARIA labels and focus states to cart remove buttons
**Learning:** Icon-only interactive elements in dynamic lists (like cart items) frequently lack proper accessible names and focus indicators, making it hard for screen reader users to identify the action and for keyboard users to navigate.
**Action:** Consistently add `aria-label`, `title`, and `focus-visible` ring utilities to icon-only buttons (`<button>✕</button>`) across the application to ensure they are accessible and intuitive for all users.
## 2025-05-04 - Form Accessibility and State Announcements
**Learning:** Auth and form screens frequently use disabled states on submit buttons while processing requests and conditionally render error messages without giving clear cues to screen reader users. Simply rendering an error block doesn't mean it gets announced to users who rely on assistive technologies.
**Action:** Consistently ensure that form input labels are explicitly linked to their inputs using `htmlFor` and `id` attributes. Additionally, always add `role="alert"` and `aria-live="assertive"` to conditional error blocks, and add `aria-busy={loading}` to asynchronous submit buttons.
