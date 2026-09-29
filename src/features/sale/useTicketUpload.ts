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

/**
 * Ticket lifecycle for a recorded sale: generate the PDF, upload it to the
 * private_tickets bucket, store the bucket-relative key on the ventes row,
 * and auto-download via a 60s signed URL. Returns false when any step fails
 * AFTER the sale itself was recorded — the sale stays valid, only the
 * ticket is unavailable, exactly as before the refactor.
 */
export function useTicketUpload() {
  const { showToast } = useToast()
  const [isUploading, setIsUploading] = useState(false)

  const uploadTicket = useCallback(
    async (input: TicketUploadInput): Promise<boolean> => {
      setIsUploading(true)

      try {
        let ticket: string
        try {
          ticket = await generateTicket({
            saleId: input.saleId,
            client: input.client,
            offres: input.offres,
            montant_total: input.montantTotal,
            kiosque: { nom: input.kiosqueNom },
          })
        } catch (generationError) {
          // A ticket-generation crash must NOT surface as a sale error: the
          // ventes rows are already recorded at this point. Log the real
          // reason and degrade gracefully like an upload failure does.
          console.error('[ticket] génération échouée:', generationError)
          showToast({
            type: 'error',
            title: 'Vente enregistrée, ticket non disponible',
            message: "La vente est bien enregistrée. Le ticket n'a pas pu être généré.",
          })
          return false
        }

        const pdfBlob = await (await fetch(ticket)).blob()
        const fileName = ticketPath(input.kiosqueId, input.saleId)

        const { error: uploadError } = await supabase.storage
          .from('private_tickets')
          .upload(fileName, pdfBlob, { upsert: false, contentType: 'application/pdf' })

        if (uploadError) {
          const err = uploadError as { code?: string; message?: string }
          console.error('[ticket] échec upload:', err.code, err.message)
          logError('ticket', 'échec upload', { code: err.code, message: err.message, kiosqueId: input.kiosqueId })
          showToast({
            type: 'error',
            title: 'Vente enregistrée, ticket non disponible',
            message: "La vente est bien enregistrée. Le ticket n'a pas pu être créé.",
          })
          return false
        }

        // Store the storage key (bucket-relative) so signed URLs can be
        // regenerated later; the previous value included the bucket name, which
        // is not a valid key for createSignedUrl().
        await supabase.from('ventes').update({ lien_ticket: fileName }).eq('id', input.saleId)

        const { data: signedData } = await supabase.storage
          .from('private_tickets')
          .createSignedUrl(fileName, 60, { download: true })

        if (!signedData?.signedUrl) {
          console.error('[ticket] signed URL indisponible pour', fileName)
          logError('ticket', 'URL signée refusée', { fileName })
          showToast({
            type: 'error',
            title: 'Lien ticket indisponible',
            message: 'La vente est enregistrée, mais le téléchargement a échoué.',
          })
          return false
        }

        const link = document.createElement('a')
        link.href = signedData.signedUrl
        // A nested key would make the browser save a file literally named
        // "<uuid>/ticket-...pdf"; use only the last segment for the filename.
        link.download = `ticket-${input.saleId}.pdf`
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        return true
      } finally {
        setIsUploading(false)
      }
    },
    [showToast]
  )

  return { uploadTicket, isUploading }
}
