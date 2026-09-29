import { supabase } from '@/lib/supabase'

/**
 * Client wrapper over the log_audit(p_action, p_entity_type, p_entity_id,
 * p_details) SECURITY DEFINER function. Failures are logged but never block
 * the user action that produced them.
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.rpc('log_audit', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_details: details ?? null,
  })
  if (error) {
    console.error(`[audit] ${action} non journalisée:`, error.code, error.message)
  }
}
