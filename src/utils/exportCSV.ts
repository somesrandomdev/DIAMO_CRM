type CsvValue = string | number | boolean | null | undefined

function escapeCsvValue(value: CsvValue): string {
  const normalized = value === null || typeof value === 'undefined' ? '' : String(value)
  return `"${normalized.replaceAll('"', '""')}"`
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

export function exportRowsCSV(
  rows: Record<string, CsvValue>[],
  filename: string
) {
  if (rows.length === 0) {
    downloadBlob('', filename, 'text/csv;charset=utf-8;')
    return
  }

  const headers = Object.keys(rows[0])
  const csv = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n')

  downloadBlob(csv, filename, 'text/csv;charset=utf-8;')
}
