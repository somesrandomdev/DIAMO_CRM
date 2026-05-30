
## 2024-05-30 - Replace Blocking Alerts with Accessible Toasts in AddClientUltra
**Learning:** Native browser `alert()` dialogs block the main UI thread and provide a poor, inaccessible experience for users receiving validation or error feedback. The existing `<button disabled={...}>` pattern in `AddClientUltra.tsx` hid why a submission could not proceed.
**Action:** Replaced `alert()` calls with the non-intrusive `useToast()` system and enabled the submit button, allowing the form to gracefully display the warning toast explaining exactly which required fields are missing.
