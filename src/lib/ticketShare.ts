/**
 * Hands a sale ticket to the phone's native share sheet (WhatsApp, SMS,
 * e-mail…). Falls back to a plain download when the browser can't share
 * files (desktop, old Android webviews) or the share itself fails.
 */
export type TicketShareOutcome = 'shared' | 'cancelled' | 'downloaded'

export async function shareOrDownloadTicket(ticket: { blob: Blob; fileName: string }): Promise<TicketShareOutcome> {
  const file = new File([ticket.blob], ticket.fileName, { type: 'application/pdf' })

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Ticket Diam'o" })
      return 'shared'
    } catch (error) {
      // The user closed the share sheet: nothing to do, no fallback.
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'cancelled'
      console.warn('[ticket] partage impossible, téléchargement à la place:', error)
    }
  }

  downloadBlob(ticket.blob, ticket.fileName)
  return 'downloaded'
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoked later: some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
