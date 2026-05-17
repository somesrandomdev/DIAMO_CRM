## 2025-04-17 - A11y for mobile menu icon buttons
**Learning:** Icon-only navigation buttons in mobile drawers frequently lack proper aria-attributes to associate the trigger with the drawer content, making them difficult for screen-reader users to understand the state and purpose of the action.
**Action:** When implementing mobile menus or sidebars, always pair `aria-expanded` and `aria-controls` on the trigger buttons and properly label them using `aria-label`. Ensure the target element has the corresponding `id`.
## 2024-04-16 - Add ARIA labels and focus states to cart remove buttons
**Learning:** Icon-only interactive elements in dynamic lists (like cart items) frequently lack proper accessible names and focus indicators, making it hard for screen reader users to identify the action and for keyboard users to navigate.
**Action:** Consistently add `aria-label`, `title`, and `focus-visible` ring utilities to icon-only buttons (`<button>✕</button>`) across the application to ensure they are accessible and intuitive for all users.

## 2024-05-17 - Missing ARIA labels on utility inputs
**Learning:** Inputs used for inline actions (like quantity updates or quick search) often lack visual labels to save space, making them inaccessible.
**Action:** Always provide descriptive `aria-label`s for utility inputs (e.g., `aria-label="Rechercher un client"`, `aria-label="Modifier la quantité pour [nom de l'offre]"`) when visible `<label>` elements are not feasible in the design.
