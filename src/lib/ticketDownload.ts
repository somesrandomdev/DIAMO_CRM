import { supabase } from '@/lib/supabase'

/**
 * Re-opens a stored sale ticket: creates a 60s signed URL in a new tab.
 * Returns false when the URL can't be created (missing file, RLS, storage
 * error) so callers can surface the French error toast.
 */
export async function openTicketDownload(lienTicket: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from('private_tickets')
    .createSignedUrl(lienTicket, 60, { download: true })

  if (error || !data?.signedUrl) {
    console.error('Ticket signed URL failed:', error)
    return false
  }

  window.open(data.signedUrl, '_blank')
  return true
}
