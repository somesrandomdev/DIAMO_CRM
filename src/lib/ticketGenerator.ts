import jsPDF from 'jspdf'

type Row =
  | { t: 'title'; text: string }
  | { t: 'center'; text: string; small?: boolean }
  | { t: 'kv'; label: string; value: string }
  | { t: 'hr' }
  | { t: 'total'; text: string }

const ROW_HEIGHT: Record<Row['t'], number> = {
  title: 6,
  center: 4.5,
  kv: 4.5,
  hr: 2.5,
  total: 5.5,
}

/**
 * Draws the receipt as text straight into the PDF — nothing user-controlled
 * ever touches the DOM or innerHTML, so it is XSS-safe by construction.
 */
export async function generateTicket(data: {
  client: { nom: string; telephone?: string }
  offres?: Array<{
    nom: string
    volume_ml?: number
    prix: number
    quantite: number
    sous_total: number
  }>
  offre?: { nom: string; volume_ml?: number; prix: number }
  quantite?: number
  montant_total: number
  kiosque: { nom?: string; adresse?: string }
}) {
  const { client, offres, offre, quantite, montant_total, kiosque } = data

  const rows: Row[] = [{ t: 'title', text: kiosque.nom || "Diam'o" }]
  if (kiosque.adresse) rows.push({ t: 'center', text: kiosque.adresse })
  rows.push({ t: 'hr' })

  rows.push({ t: 'kv', label: 'Client', value: client.nom })
  if (client.telephone) rows.push({ t: 'kv', label: 'Tél', value: client.telephone })
  rows.push({ t: 'hr' })

  if (offres && offres.length > 0) {
    for (const item of offres) {
      rows.push({ t: 'kv', label: 'Offre', value: item.nom })
      if (item.volume_ml) rows.push({ t: 'kv', label: 'Volume', value: `${item.volume_ml} ml` })
      rows.push({ t: 'kv', label: 'Qté', value: String(item.quantite) })
      rows.push({ t: 'kv', label: 'Prix unitaire', value: `${item.prix} CFA` })
      rows.push({ t: 'kv', label: 'Sous-total', value: `${item.sous_total} CFA` })
      rows.push({ t: 'hr' })
    }
  } else if (offre) {
    rows.push({ t: 'kv', label: 'Offre', value: offre.nom })
    if (offre.volume_ml) rows.push({ t: 'kv', label: 'Volume', value: `${offre.volume_ml} ml` })
    rows.push({ t: 'kv', label: 'Qté', value: String(quantite ?? 1) })
    rows.push({ t: 'hr' })
  }

  rows.push({ t: 'total', text: `Total : ${montant_total} CFA` })
  rows.push({ t: 'center', text: 'Merci pour votre confiance !', small: true })

  const width = 80
  const margin = 6
  const height = 8 + rows.reduce((h, r) => h + ROW_HEIGHT[r.t], 0) + 2

  // jsPDF normalizes portrait/landscape by swapping dimensions, so pick the
  // orientation that already matches to keep the page exactly [width, height].
  const pdf = new jsPDF({
    orientation: height >= width ? 'p' : 'l',
    unit: 'mm',
    format: [width, height],
  })

  let y = 8
  for (const row of rows) {
    switch (row.t) {
      case 'title':
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(0)
        pdf.text(row.text, width / 2, y, { align: 'center' })
        break
      case 'center':
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(row.small ? 8 : 9)
        pdf.setTextColor(row.small ? 85 : 0)
        pdf.text(row.text, width / 2, y, { align: 'center' })
        break
      case 'kv': {
        const label = `${row.label} :`
        pdf.setFontSize(9)
        pdf.setTextColor(0)
        pdf.setFont('helvetica', 'bold')
        pdf.text(label, margin, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row.value, margin + pdf.getTextWidth(label) + 2, y)
        break
      }
      case 'hr':
        pdf.setDrawColor(170)
        pdf.setLineWidth(0.2)
        pdf.line(margin, y - 1.5, width - margin, y - 1.5)
        break
      case 'total':
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.setTextColor(0)
        pdf.text(row.text, margin, y)
        break
    }
    y += ROW_HEIGHT[row.t]
  }

  return pdf.output('datauristring')
}
