import jsPDF from 'jspdf'
import { LOGO_BASE64 } from './logoBase64'
import { formatFrenchNumber, formatVolume } from './ticketFormat'

/* Diam'O brand palette (RGB 0-255 for jsPDF) */
const BRAND = {
  deepBlue: [18, 54, 77] as const, // #12364D
  waterBlue: [0, 158, 251] as const, // #009EFB
  borderGray: [220, 225, 229] as const, // #DCE1E5
  footerGray: [136, 136, 136] as const, // #888888
  white: [255, 255, 255] as const,
}

const PAGE_WIDTH = 80 // thermal receipt standard
const MARGIN = 6
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const cfa = (value: number) => `${formatFrenchNumber(value)} CFA`

/** Truncate long offer names to fit ~25 chars with an ellipsis. */
function truncate(text: string, max = 25): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

interface TicketItem {
  nom: string
  volume_ml?: number
  prix: number
  quantite: number
  sous_total: number
}

export interface TicketData {
  saleId?: string
  client: { nom: string; telephone?: string }
  offres?: TicketItem[]
  offre?: { nom: string; volume_ml?: number; prix: number }
  quantite?: number
  montant_total: number
  kiosque: { nom?: string; adresse?: string }
  issuedAt?: Date
}

/**
 * Draws the branded receipt straight into the PDF with the jsPDF vector API —
 * no html2canvas, no DOM, nothing user-controlled ever becomes HTML, so it is
 * XSS-safe by construction. 80mm-wide thermal receipt with dynamic height.
 */
export async function generateTicket(data: TicketData) {
  const { client, offres, offre, quantite, montant_total, kiosque } = data

  // Normalize legacy single-offre calls into the items list.
  const items: TicketItem[] =
    offres && offres.length > 0
      ? offres
      : offre
        ? [{ nom: offre.nom, volume_ml: offre.volume_ml, prix: offre.prix, quantite: quantite ?? 1, sous_total: offre.prix * (quantite ?? 1) }]
        : []

  const issuedAt = data.issuedAt ?? new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateLabel = `${pad(issuedAt.getDate())}/${pad(issuedAt.getMonth() + 1)}/${issuedAt.getFullYear()} ${pad(issuedAt.getHours())}:${pad(issuedAt.getMinutes())}`
  const ticketNumber = data.saleId
    ? data.saleId.slice(-8).toUpperCase()
    : dateLabel.replace(/[/: ]/g, '')

  // Logo is 329x131 px; 40mm wide keeps the aspect at ~15.9mm tall.
  const logoWidth = 40
  const logoHeight = (logoWidth * 131) / 329

  /* -- Pass 1: measure the page height ------------------------------------ */
  const headerHeight = 6 + logoHeight + 5 + 4.5 + 4.5 + 3
  const metaHeight = 4 + 4 + 4 + (client.telephone ? 4 : 0) + 3
  const tableHeaderHeight = 5.5
  const rowHeights = items.map(() => 4.8)
  const totalBlockHeight = 3 + 6.5 + 3
  const footerHeight = 5 + 3.5 + 3.5
  const pageHeight = Math.ceil(
    headerHeight + metaHeight + tableHeaderHeight + rowHeights.reduce((a, b) => a + b, 0) + totalBlockHeight + footerHeight + 4
  )

  /* -- Pass 2: draw -------------------------------------------------------- */
  const pdf = new jsPDF({
    orientation: pageHeight >= PAGE_WIDTH ? 'p' : 'l',
    unit: 'mm',
    format: [PAGE_WIDTH, pageHeight],
  })

  let y = 6

  // HEADER — logo (white backing in case of PNG transparency), wordmark,
  // tagline, kiosk name, brand separator.
  pdf.setFillColor(...BRAND.white)
  pdf.rect(MARGIN - 1, y - 1, logoWidth + 2, logoHeight + 2, 'F')
  pdf.addImage(LOGO_BASE64, 'PNG', (PAGE_WIDTH - logoWidth) / 2, y, logoWidth, logoHeight)
  y += logoHeight + 5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text("Diam'O", PAGE_WIDTH / 2, y, { align: 'center' })
  y += 4.5

  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.waterBlue)
  pdf.text('Le goût de l’excellence', PAGE_WIDTH / 2, y, { align: 'center' })
  y += 4.5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text(kiosque.nom || "Diam'O", PAGE_WIDTH / 2, y, { align: 'center' })
  y += 3

  pdf.setDrawColor(...BRAND.waterBlue)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

  // META BLOCK
  y += 4
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text(`Date : ${dateLabel}`, MARGIN, y)
  y += 4
  pdf.text(`Ticket N° ${ticketNumber}`, MARGIN, y)
  y += 4
  pdf.text(`Client : ${truncate(client.nom, 30)}`, MARGIN, y)
  if (client.telephone) {
    y += 4
    pdf.text(`Tél : ${client.telephone}`, MARGIN, y)
  }
  y += 3
  pdf.setDrawColor(...BRAND.borderGray)
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

  // ITEMS TABLE — header band with white text on deep blue.
  y += tableHeaderHeight
  pdf.setFillColor(...BRAND.deepBlue)
  pdf.rect(MARGIN, y - tableHeaderHeight + 1, CONTENT_WIDTH, tableHeaderHeight, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...BRAND.white)

  // Columns: Désignation left | Vol. center | Qté center | P.U. right | Total right
  // Anchors tuned so the widest realistic values ("1 000 CFA" P.U., "12 500 CFA"
  // total, "500 ml" volume, 2-digit qty) never overlap at 8pt helvetica.
  const colName = MARGIN + 1
  const colVol = MARGIN + 27.5
  const colQty = MARGIN + 34.5
  const colPU = MARGIN + 52
  const colTotal = MARGIN + CONTENT_WIDTH - 1
  const headerY = y - tableHeaderHeight + 3.7
  pdf.text('Désignation', colName, headerY)
  pdf.text('Vol.', colVol, headerY, { align: 'center' })
  pdf.text('Qté', colQty, headerY, { align: 'center' })
  pdf.text('P.U.', colPU, headerY, { align: 'right' })
  pdf.text('Total', colTotal, headerY, { align: 'right' })

  // Item rows
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(...BRAND.deepBlue)
  rowHeights.forEach((rowHeight, index) => {
    const item = items[index]
    const rowY = y + 3.2

    pdf.text(truncate(item.nom), colName, rowY)
    if (item.volume_ml) pdf.text(formatVolume(item.volume_ml), colVol, rowY, { align: 'center' })
    pdf.text(String(item.quantite), colQty, rowY, { align: 'center' })
    pdf.text(cfa(item.prix), colPU, rowY, { align: 'right' })
    pdf.text(cfa(item.sous_total), colTotal, rowY, { align: 'right' })

    y += rowHeight
    if (index < items.length - 1) {
      pdf.setDrawColor(...BRAND.borderGray)
      pdf.setLineWidth(0.15)
      pdf.line(MARGIN, y - 0.8, PAGE_WIDTH - MARGIN, y - 0.8)
    }
  })
  y += 1

  // TOTAL BLOCK — thick deep-blue rules, brand-blue amount.
  pdf.setDrawColor(...BRAND.deepBlue)
  pdf.setLineWidth(0.6)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 5.5
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text('TOTAL', MARGIN, y)
  pdf.setFontSize(14)
  pdf.setTextColor(...BRAND.waterBlue)
  pdf.text(cfa(montant_total), colTotal, y, { align: 'right' })
  y += 3
  pdf.setDrawColor(...BRAND.deepBlue)
  pdf.setLineWidth(0.6)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

  // FOOTER
  y += 5
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text('Merci pour votre confiance !', PAGE_WIDTH / 2, y, { align: 'center' })
  y += 3.5
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(...BRAND.footerGray)
  pdf.text('À bientôt chez Diam\'O', PAGE_WIDTH / 2, y, { align: 'center' })
  y += 3.5
  pdf.text(`Émis le ${dateLabel}`, PAGE_WIDTH / 2, y, { align: 'center' })

  return pdf.output('datauristring')
}
