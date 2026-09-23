import jsPDF from 'jspdf'
import { LOGO_BASE64 } from './logoBase64'
import { formatFrenchNumber } from './ticketFormat'

/* Diam'o brand palette (RGB 0-255 for jsPDF) */
const BRAND = {
  deepBlue: [18, 54, 77] as const, // #12364D
  waterBlue: [0, 158, 251] as const, // #009EFB
  borderGray: [220, 225, 229] as const, // #DCE1E5
  textGray: [125, 148, 166] as const, // muted blue-gray
  white: [255, 255, 255] as const,
}

const cfa = (value: number) => `${formatFrenchNumber(value)} CFA`

export interface ReportPdfData {
  kiosqueNom: string
  kiosqueAdresse?: string | null
  periodLabel: string
  ca: number
  ventes: number
  target: number
  progress: number
  topClient: string
  bestOffer: string
  issuedAt?: Date
}

/**
 * Branded A4 performance report, drawn with the jsPDF vector API — no
 * html2canvas, no DOM. Mirrors the ticket's branding: logo, deep-blue
 * headings, water-blue accents, French number spacing.
 */
export async function generateReportPdf(data: ReportPdfData): Promise<string> {
  const issuedAt = data.issuedAt ?? new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const issuedLabel = `${pad(issuedAt.getDate())}/${pad(issuedAt.getMonth() + 1)}/${issuedAt.getFullYear()}`

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 18 // page margin
  const contentW = W - M * 2

  /* ── Header ─────────────────────────────────────────────────────────── */
  const logoWidth = 36
  const logoHeight = (logoWidth * 131) / 329
  pdf.setFillColor(...BRAND.white)
  pdf.rect(M - 1, 10 - 1, logoWidth + 2, logoHeight + 2, 'F')
  pdf.addImage(LOGO_BASE64, 'PNG', M, 10, logoWidth, logoHeight)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text('Rapport de performance', W - M, 18, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...BRAND.waterBlue)
  pdf.text(data.kiosqueNom, W - M, 24.5, { align: 'right' })
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.textGray)
  pdf.text(`Période : ${data.periodLabel}  ·  Émis le ${issuedLabel}`, W - M, 30, { align: 'right' })

  pdf.setDrawColor(...BRAND.waterBlue)
  pdf.setLineWidth(0.8)
  pdf.line(M, 38, W - M, 38)

  /* ── KPI boxes ──────────────────────────────────────────────────────── */
  const boxW = (contentW - 12) / 3
  const boxH = 26
  const boxY = 48
  const kpis: Array<{ label: string; value: string }> = [
    { label: "CHIFFRE D'AFFAIRES", value: cfa(data.ca) },
    { label: 'VENTES', value: formatFrenchNumber(data.ventes) },
    {
      label: 'PANIER MOYEN',
      value: cfa(data.ventes > 0 ? data.ca / data.ventes : 0),
    },
  ]
  kpis.forEach((kpi, index) => {
    const x = M + index * (boxW + 6)
    pdf.setDrawColor(...BRAND.borderGray)
    pdf.setLineWidth(0.4)
    pdf.roundedRect(x, boxY, boxW, boxH, 2.5, 2.5, 'S')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...BRAND.textGray)
    pdf.text(kpi.label, x + 4, boxY + 7)

    pdf.setFontSize(13)
    pdf.setTextColor(...BRAND.deepBlue)
    pdf.text(kpi.value, x + 4, boxY + 16)
  })

  /* ── Objectif ───────────────────────────────────────────────────────── */
  let y = boxY + boxH + 14
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text('Objectif', M, y)
  y += 4
  pdf.setDrawColor(...BRAND.waterBlue)
  pdf.setLineWidth(0.4)
  pdf.line(M, y, M + 30, y)
  y += 8

  if (data.target > 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...BRAND.deepBlue)
    pdf.text('Réalisé :', M, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(cfa(data.ca), M + 22, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Cible :', M + 62, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(cfa(data.target), M + 78, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...BRAND.waterBlue)
    pdf.text(`${data.progress.toFixed(1).replace('.', ',')} %`, W - M, y, { align: 'right' })

    // Progress bar: light track, water-blue fill.
    const barY = y + 4
    const barW = contentW
    pdf.setFillColor(227, 243, 254) // #E3F3FE
    pdf.roundedRect(M, barY, barW, 6, 3, 3, 'F')
    const fillW = Math.max(0, Math.min(100, data.progress)) / 100 * barW
    if (fillW > 0.5) {
      pdf.setFillColor(...BRAND.waterBlue)
      pdf.roundedRect(M, barY, fillW, 6, 3, 3, 'F')
    }
  } else {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(10)
    pdf.setTextColor(...BRAND.textGray)
    pdf.text('Aucun objectif défini pour cette période.', M, y)
  }

  /* ── Détails ────────────────────────────────────────────────────────── */
  y += data.target > 0 ? 22 : 12
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(...BRAND.deepBlue)
  pdf.text('Détails', M, y)
  y += 4
  pdf.setDrawColor(...BRAND.waterBlue)
  pdf.setLineWidth(0.4)
  pdf.line(M, y, M + 30, y)
  y += 9

  const details: Array<[string, string]> = [
    ['Top client', data.topClient],
    ['Meilleure offre', data.bestOffer],
    ['Adresse', data.kiosqueAdresse || 'Non renseignée'],
  ]
  details.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...BRAND.textGray)
    pdf.text(label, M, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...BRAND.deepBlue)
    pdf.text(value, M + 45, y)
    y += 9
  })

  /* ── Footer ─────────────────────────────────────────────────────────── */
  const footerY = 280
  pdf.setDrawColor(...BRAND.borderGray)
  pdf.setLineWidth(0.3)
  pdf.line(M, footerY, W - M, footerY)
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.waterBlue)
  pdf.text('Merci pour votre confiance !', M, footerY + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...BRAND.textGray)
  pdf.text(`Généré par Diam'o CRM le ${issuedLabel}`, W - M, footerY + 6, { align: 'right' })

  return pdf.output('datauristring')
}
