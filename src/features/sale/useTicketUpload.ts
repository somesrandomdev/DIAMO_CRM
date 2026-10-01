import { useCallback, useState } from 'react'
import { useToast } from '@/components/Toast'
import { generateTicket } from '@/lib/ticketGenerator'
import { ticketPath } from '@/lib/ticketFormat'
import { logError } from '@/lib/telemetry'
import { supabase } from '@/lib/supabase'

export { formatFrenchNumber, formatVolume, ticketPath } from '@/lib/ticketFormat'

export interface TicketUploadInput {
  saleId: string
  kiosqueId: string
  kiosqueNom: string
  client: { nom: string; telephone?: string }
  offres: Array<{
    nom: string
    volume_ml?: number
    prix: number
    quantite: number
    sous_total: number
  }>
  montantTotal: number
}

/** A generated ticket kept in memory so the confirmation screen can share it. */
export interface GeneratedTicket {
  saleId: string
  fileName: string
  blob: Blob
}

/**
 * Ticket lifecycle for a recorded sale: generate the PDF, upload it to the
 * private_tickets bucket and store the bucket-relative key on the ventes row.
 * The PDF is NOT auto-downloaded any more: it is kept in `ticket` for the
 * confirmation screen (share sheet / download fallback).
 *
 * Always resolves true: it only runs once the sale is recorded, so a ticket
 * problem must never block the end of the sale (it used to return false and
 * leave the submit flow locked until a page reload). Failures are reported
 * by toast; the local PDF stays shareable even when the upload failed.
 */
export function useTicketUpload() {
  const { showToast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [ticket, setTicket] = useState<GeneratedTicket | null>(null)

  const uploadTicket = useCallback(
    async (input: TicketUploadInput): Promise<boolean> => {
      setIsUploading(true)
      setTicket(null)

      try {
        let dataUrl: string
        try {
          dataUrl = await generateTicket({
            saleId: input.saleId,
            client: input.client,
            offres: input.offres,
            montant_total: input.montantTotal,
            kiosque: { nom: input.kiosqueNom },
          })
        } catch (generationError) {
          // A ticket-generation crash must NOT surface as a sale error: the
          // ventes rows are already recorded at this point.
          console.error('[ticket] génération échouée:', generationError)
          logError('ticket', 'génération échouée', { saleId: input.saleId })
          showToast({
            type: 'warning',
            title: 'Ticket non disponible',
            message: "La vente est bien enregistrée, mais le ticket n'a pas pu être généré.",
          })
          return true
        }

        const pdfBlob = await (await fetch(dataUrl)).blob()
        const fileName = ticketPath(input.kiosqueId, input.saleId)
        // A nested storage key would name the shared file "<uuid>/ticket-…";
        // the user-facing name is the last segment only.
        setTicket({ saleId: input.saleId, fileName: `ticket-${input.saleId}.pdf`, blob: pdfBlob })

        const { error: uploadError } = await supabase.storage
          .from('private_tickets')
          .upload(fileName, pdfBlob, { upsert: false, contentType: 'application/pdf' })

        if (uploadError) {
          const err = uploadError as { code?: string; message?: string }
          console.error('[ticket] échec upload:', err.code, err.message)
          logError('ticket', 'échec upload', { code: err.code, message: err.message, kiosqueId: input.kiosqueId })
          showToast({
            type: 'warning',
            title: 'Ticket non sauvegardé en ligne',
            message: 'La vente est bien enregistrée. Partagez le ticket maintenant depuis cet écran.',
          })
          return true
        }

        // Store the storage key (bucket-relative) so signed URLs can be
        // regenerated later from the history screen.
        await supabase.from('ventes').update({ lien_ticket: fileName }).eq('id', input.saleId)
        return true
      } finally {
        setIsUploading(false)
      }
    },
    [showToast]
  )

  const clearTicket = useCallback(() => setTicket(null), [])

  return { uploadTicket, isUploading, ticket, clearTicket }
}
