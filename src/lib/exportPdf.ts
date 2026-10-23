/** Exports a unified diff as a PDF report, entirely in the browser (jsPDF is loaded on demand). */
export async function exportDiffPdf(opts: {
  title: string
  subtitle: string
  unifiedDiff: string
  filename: string
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 36
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const lineH = 11

  // The built-in PDF fonts only cover Latin-1; replace other characters so nothing garbles.
  const safe = (s: string) => s.replace(/\t/g, '    ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(safe(opts.title), margin, margin + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(safe(opts.subtitle), margin, margin + 24)
  doc.text(
    'Characters outside Latin-1 are shown as "?" in this PDF. Use the text download for full fidelity.',
    margin,
    margin + 36,
  )

  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  let y = margin + 58
  const maxW = pageW - margin * 2
  const lines = opts.unifiedDiff === '' ? ['(no differences)'] : opts.unifiedDiff.split('\n')
  for (const raw of lines) {
    const wrapped = doc.splitTextToSize(safe(raw) || ' ', maxW) as string[]
    for (const part of wrapped) {
      if (y > pageH - margin) {
        doc.addPage()
        y = margin
      }
      const c = raw[0]
      if (raw.startsWith('@@')) doc.setTextColor(79, 70, 229)
      else if (c === '+' && !raw.startsWith('+++')) doc.setTextColor(15, 107, 53)
      else if (c === '-' && !raw.startsWith('---')) doc.setTextColor(163, 38, 29)
      else doc.setTextColor(40)
      doc.text(part, margin, y)
      y += lineH
    }
  }
  doc.save(opts.filename)
}
