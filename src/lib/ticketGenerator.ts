import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { escapeHtml } from '@/utils/validation'

export async function generateTicket(data: {
  client: { nom: string; telephone?: string }
  offres?: Array<{ nom: string; volume_ml?: number; prix: number; quantite: number; sous_total: number }>
  offre?: { nom: string; volume_ml?: number; prix: number }
  quantite?: number
  montant_total: number
  kiosque: { nom?: string; adresse?: string }
}) {
  const { client, offres, offre, quantite, montant_total, kiosque } = data

  // 1. Build a tiny DOM for the ticket
  const container = document.createElement('div')
  container.style.width = '300px'
  container.style.padding = '16px'
  container.style.fontFamily = 'Arial, sans-serif'
  container.style.fontSize = '12px'
  let offresHtml = ''
  if (offres && offres.length > 0) {
    offresHtml = offres.map(offre => `
      <p><strong>Offre :</strong> ${escapeHtml(String(offre.nom))}</p>
      <p><strong>Volume :</strong> ${escapeHtml(String(offre.volume_ml || ''))} ml</p>
      <p><strong>Qté :</strong> ${offre.quantite}</p>
      <p><strong>Prix unitaire :</strong> ${offre.prix} CFA</p>
      <p><strong>Sous-total :</strong> ${offre.sous_total} CFA</p>
      <hr style="margin:4px 0" />
    `).join('')
  } else if (offre) {
    offresHtml = `
      <p><strong>Offre :</strong> ${escapeHtml(String(offre.nom))}</p>
      <p><strong>Volume :</strong> ${escapeHtml(String(offre.volume_ml || ''))} ml</p>
      <p><strong>Qté :</strong> ${quantite || 1}</p>
      <hr style="margin:8px 0" />
    `
  }

  container.innerHTML = `
    <div style="text-align:center">
      <h2>${escapeHtml(String(kiosque.nom || 'Diam\'o'))}</h2>
      <p>${escapeHtml(String(kiosque.adresse || ''))}</p>
      <hr style="margin:8px 0" />
      <p><strong>Client :</strong> ${escapeHtml(String(client.nom))}</p>
      <p><strong>Tél :</strong> ${escapeHtml(String(client.telephone || ''))}</p>
      <hr style="margin:8px 0" />
      ${offresHtml}
      <p style="font-size:14px"><strong>Total : ${montant_total} CFA</strong></p>
      <p style="font-size:10px; color:#555">Merci pour votre confiance !</p>
    </div>
  `

  // 2. Render to canvas → PDF
  document.body.appendChild(container)
  const canvas = await html2canvas(container, { scale: 2 })
  document.body.removeChild(container)

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [canvas.height / 4, canvas.width / 4] })
  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 4, canvas.height / 4)

  // 3. Return data URI
  return pdf.output('datauristring')
}