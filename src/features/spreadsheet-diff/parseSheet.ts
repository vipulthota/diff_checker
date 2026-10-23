import { FileError, checkSheetSize, extOf, readArrayBuffer } from '../../lib/files'
import type { SheetData } from '../../types/sheet'

export interface Workbook {
  name: string
  size: number
  sheetNames: string[]
  sheets: Record<string, SheetData>
  warning?: string
}

const MAX_CELLS = 5_000_000

function trimTrailing(rows: string[][]): string[][] {
  let end = rows.length
  while (end > 0 && rows[end - 1].every((c) => c === '')) end--
  const out = rows.slice(0, end)
  let width = 0
  for (const r of out) {
    let w = r.length
    while (w > 0 && r[w - 1] === '') w--
    width = Math.max(width, w)
  }
  return out.map((r) => {
    const row = r.slice(0, width)
    while (row.length < width) row.push('')
    return row
  })
}

/** Parses CSV, TSV, XLS and XLSX locally with SheetJS. Formulas are never evaluated or executed. */
export async function parseWorkbook(file: File): Promise<Workbook> {
  const ext = extOf(file.name)
  if (!['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) {
    throw new FileError('Unsupported file type. Use CSV, TSV, XLSX or XLS.')
  }
  const warning = checkSheetSize(file)
  const buf = await readArrayBuffer(file)
  const XLSX = await import('xlsx')
  try {
    let wb
    if (ext === 'csv' || ext === 'tsv') {
      const text = new TextDecoder('utf-8').decode(buf)
      // raw keeps values exactly as written (e.g. "007" stays "007").
      wb = XLSX.read(text, { type: 'string', raw: true, FS: ext === 'tsv' ? '\t' : undefined })
    } else {
      const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength))
      const isZip = head[0] === 0x50 && head[1] === 0x4b // XLSX is a ZIP container
      const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0 // legacy XLS
      const isXml = head[0] === 0x3c // SpreadsheetML 2003 saved with an .xls extension
      if (!isZip && !isOle && !isXml) throw new Error('not a spreadsheet')
      wb = XLSX.read(new Uint8Array(buf), {
        type: 'array',
        cellDates: true,
        cellFormula: false,
        bookVBA: false,
      })
    }
    const sheets: Record<string, SheetData> = Object.create(null)
    const names = wb.SheetNames.filter((n) => n !== '__proto__')
    for (const name of names) {
      const ws = wb.Sheets[name]
      if (!ws || !ws['!ref']) {
        sheets[name] = []
        continue
      }
      const r = XLSX.utils.decode_range(ws['!ref'])
      if ((r.e.r - r.s.r + 1) * (r.e.c - r.s.c + 1) > MAX_CELLS)
        throw new FileError(`The sheet "${name}" is too large for reliable browser processing.`)
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: ext === 'csv' || ext === 'tsv',
        defval: '',
        blankrows: true,
      })
      sheets[name] = trimTrailing(
        rows.map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c)))),
      )
    }
    if (!names.length) throw new Error('empty')
    return { name: file.name, size: file.size, sheetNames: names, sheets, warning }
  } catch (e) {
    if (e instanceof FileError) throw e
    throw new FileError(
      `Unable to read "${file.name}". The spreadsheet may be corrupted, password-protected, or unsupported.`,
    )
  }
}
