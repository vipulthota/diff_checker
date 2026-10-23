import {
  FileError,
  checkDocSize,
  classifyFile,
  readArrayBuffer,
  readTextFile,
  type LoadedText,
} from '../../lib/files'
import { computeTextDiff } from '../text-diff/TextDiffEngine'
import type { TextDiffOptions, TextDiffResult } from '../../types/diff'

/**
 * Document comparison works on extracted text. Visual formatting (fonts, colours,
 * images, layout) is deliberately not compared because it cannot be done reliably in a browser.
 */
export const FORMATTING_NOTE =
  'Documents are compared by their extracted text. Formatting such as fonts, colours, images and page layout is not compared.'

const MAX_PDF_PAGES = 400

/* ------------------------------------------------------------------------ */
/* PDF                                                                      */
/* ------------------------------------------------------------------------ */

interface PdfTextItem {
  str?: string
  hasEOL?: boolean
  transform?: number[]
}

export async function extractPdf(file: File): Promise<LoadedText> {
  const warning = checkDocSize(file)
  const data = new Uint8Array(await readArrayBuffer(file))
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const corrupt = () =>
    new FileError(`Unable to read "${file.name}". It may be corrupted, encrypted, or unsupported.`)

  // Only text is extracted; the PDF is never rendered, and scripts inside it are never run.
  const task = pdfjs.getDocument({ data, enableXfa: false, verbosity: 0 })
  let doc
  try {
    doc = await task.promise
  } catch {
    void task.destroy()
    throw corrupt()
  }

  try {
    const total = doc.numPages
    const pages = Math.min(total, MAX_PDF_PAGES)
    const lines: string[] = []
    const pageStarts: number[] = []
    let chars = 0
    for (let p = 1; p <= pages; p++) {
      pageStarts.push(lines.length)
      lines.push(`──────── Page ${p} ────────`)
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      let line = ''
      let lastY: number | null = null
      for (const raw of content.items as PdfTextItem[]) {
        if (typeof raw.str !== 'string') continue
        const y = raw.transform?.[5] ?? 0
        if (lastY !== null && Math.abs(y - lastY) > 2 && line !== '') {
          lines.push(line.trimEnd())
          line = ''
        }
        line += raw.str
        chars += raw.str.length
        lastY = y
        if (raw.hasEOL) {
          lines.push(line.trimEnd())
          line = ''
        }
      }
      if (line.trim() !== '') lines.push(line.trimEnd())
      page.cleanup()
    }
    const notes: string[] = []
    if (total > pages)
      notes.push(`Only the first ${pages} of ${total} pages of "${file.name}" were compared.`)
    if (chars === 0)
      notes.push(
        `"${file.name}" has no selectable text. It may be a scanned document; scanned PDFs would need OCR, which is not supported.`,
      )
    return {
      name: file.name,
      text: lines.join('\n'),
      size: file.size,
      warning,
      pageStarts,
      note: notes.join(' ') || undefined,
    }
  } catch {
    throw corrupt()
  } finally {
    void task.destroy()
  }
}

/* ------------------------------------------------------------------------ */
/* DOCX                                                                     */
/* ------------------------------------------------------------------------ */

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** Converts mammoth's HTML into plain text blocks. The HTML is parsed inertly and never inserted into the page. */
export function htmlToBlocks(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      out.push('', `${'#'.repeat(Number(tag[1]))} ${clean(el.textContent)}`, '')
    } else if (tag === 'p') {
      const t = clean(el.textContent)
      out.push(t)
    } else if (tag === 'ul' || tag === 'ol') {
      let n = 1
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() === 'li') {
          out.push(`${tag === 'ol' ? `${n++}.` : '-'} ${clean(li.textContent)}`)
        }
      }
      out.push('')
    } else if (tag === 'table') {
      for (const tr of Array.from(el.querySelectorAll('tr'))) {
        out.push(
          '| ' +
            Array.from(tr.children)
              .map((c) => clean(c.textContent))
              .join(' | ') +
            ' |',
        )
      }
      out.push('')
    } else if (el.children.length) {
      for (const c of Array.from(el.children)) walk(c)
    } else if (clean(el.textContent)) {
      out.push(clean(el.textContent))
    }
  }
  for (const c of Array.from(doc.body.children)) walk(c)
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractDocx(file: File): Promise<LoadedText> {
  const warning = checkDocSize(file)
  const arrayBuffer = await readArrayBuffer(file)
  try {
    const mod = (await import('mammoth')) as unknown as {
      default?: typeof import('mammoth')
    } & typeof import('mammoth')
    const mammoth = mod.default ?? mod
    const { value } = await mammoth.convertToHtml({ arrayBuffer })
    const text = htmlToBlocks(value)
    return { name: file.name, text, size: file.size, warning }
  } catch {
    throw new FileError(
      `Unable to read "${file.name}". It may be corrupted or not a valid DOCX file.`,
    )
  }
}

/* ------------------------------------------------------------------------ */
/* Entry points                                                             */
/* ------------------------------------------------------------------------ */

export async function loadDocument(file: File): Promise<LoadedText> {
  const kind = classifyFile(file)
  if (kind === 'pdf') return extractPdf(file)
  if (kind === 'docx') return extractDocx(file)
  if (kind === 'text') return readTextFile(file)
  throw new FileError('Unsupported file type.')
}

export function compareDocuments(
  left: string,
  right: string,
  options: TextDiffOptions,
): TextDiffResult {
  return computeTextDiff(left, right, options)
}
