## 2024-05-24 - Unsanitized error messages displayed via alert() in UI
**Vulnerability:** UI components directly display raw backend error messages (e.g. `alert('Erreur lors de la sauvegarde: ' + error.message)`) when interacting with Supabase or other actions.
**Learning:** This pattern exposes internal database details, stack traces, or precise backend error specifics directly to the user and violates the fail-closed UI pattern. The codebase provides a utility `handleSupabaseError` that is meant for sanitizing such errors, but it is not consistently used.
**Prevention:** Always use `handleSupabaseError` or generic messaging in alert()/toast() dialogs rather than directly appending `error.message`.
