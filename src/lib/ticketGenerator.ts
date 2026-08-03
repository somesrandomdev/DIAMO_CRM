import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Creates a DOM element with text content set via textContent (never innerHTML),
 * which prevents XSS regardless of what the text contains.
 */
function el(
  tag: string,
  opts: { text?: string; style?: string; bold?: boolean } = {}
): HTMLElement {
  const node = document.createElement(tag)
  if (opts.text !== undefined) node.textContent = opts.text
  if (opts.style) node.style.cssText = opts.style
  if (opts.bold && node instanceof HTMLElement) node.style.fontWeight = 'bold'
  return node
}

function hr(): HTMLHRElement {
  const node = document.createElement('hr')
  node.style.cssText = 'margin:8px 0; border:none; border-top:1px solid #ccc'
  return node
}

function labelLine(label: string, value: string): HTMLParagraphElement {
  const p = document.createElement('p')
  p.style.cssText = 'margin:2px 0'
  const strong = document.createElement('strong')
  strong.textContent = `${label} : `
  p.appendChild(strong)
  p.appendChild(document.createTextNode(value))
  return p
}

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

  const container = document.createElement('div')
  container.style.cssText =
    'width:300px; padding:16px; font-family:Arial,sans-serif; font-size:12px; background:#fff; color:#000'

  const wrap = document.createElement('div')
  wrap.style.textAlign = 'center'

  // Header
  wrap.appendChild(el('h2', { text: kiosque.nom || "Diam'o", style: 'margin:0 0 4px' }))
  if (kiosque.adresse) {
    wrap.appendChild(el('p', { text: kiosque.adresse, style: 'margin:0 0 4px' }))
  }
  wrap.appendChild(hr())

  // Client
  wrap.appendChild(labelLine('Client', client.nom))
  if (client.telephone) {
    wrap.appendChild(labelLine('Tél', client.telephone))
  }
  wrap.appendChild(hr())

  // Offer lines
  if (offres && offres.length > 0) {
    for (const item of offres) {
      wrap.appendChild(labelLine('Offre', item.nom))
      if (item.volume_ml) {
        wrap.appendChild(labelLine('Volume', `${item.volume_ml} ml`))
      }
      wrap.appendChild(labelLine('Qté', String(item.quantite)))
      wrap.appendChild(labelLine('Prix unitaire', `${item.prix} CFA`))
      wrap.appendChild(labelLine('Sous-total', `${item.sous_total} CFA`))
      wrap.appendChild(hr())
    }
  } else if (offre) {
    wrap.appendChild(labelLine('Offre', offre.nom))
    if (offre.volume_ml) {
      wrap.appendChild(labelLine('Volume', `${offre.volume_ml} ml`))
    }
    wrap.appendChild(labelLine('Qté', String(quantite ?? 1)))
    wrap.appendChild(hr())
  }

  // Total
  const totalP = el('p', { style: 'font-size:14px; margin:4px 0' })
  const totalStrong = document.createElement('strong')
  totalStrong.textContent = `Total : ${montant_total} CFA`
  totalP.appendChild(totalStrong)
  wrap.appendChild(totalP)

  wrap.appendChild(
    el('p', {
      text: 'Merci pour votre confiance !',
      style: 'font-size:10px; color:#555; margin-top:6px',
    })
  )

  container.appendChild(wrap)
  document.body.appendChild(container)

  const canvas = await html2canvas(container, { scale: 2 })
  document.body.removeChild(container)

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [canvas.height / 4, canvas.width / 4],
  })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 4, canvas.height / 4)

  return pdf.output('datauristring')
}
