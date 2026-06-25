## 2024-03-20 - Fix aria-label issue
**Learning:** AddClientUltra inputs lacked IDs and valid labels linking inputs to their title. VenteUltraSimple had form inputs lacking aria-labels or matching titles where labels aren't practical.
**Action:** Use htmlFor and id combinations on form fields across the app, specifically modifying `src/pages/VenteUltraSimple.tsx` to add `aria-label` where a visible `<label>` is not suitable.
