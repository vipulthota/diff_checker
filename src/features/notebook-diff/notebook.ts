import { extOf, FileError, readTextFile, type LoadedText } from '../../lib/files'

/** Comment prefix per notebook language, as used by the Databricks source export. */
const PREFIX: Record<string, string> = {
  python: '#',
  r: '#',
  sql: '--',
  scala: '//',
}
const LANG_OF_PREFIX: Record<string, string> = { '#': 'python', '--': 'sql', '//': 'scala' }

const HEADER = /^(#|--|\/\/) Databricks notebook source\s*$/
const SEPARATOR = /^(?:#|--|\/\/) COMMAND ----------\s*$/

export const isDatabricksSource = (text: string) => HEADER.test(text.split('\n', 1)[0] ?? '')

/** Language of the notebook's default cells, taken from the header comment style. */
export function notebookLanguage(text: string): string {
  const m = HEADER.exec(text.split('\n', 1)[0] ?? '')
  return m ? LANG_OF_PREFIX[m[1]] : 'python'
}

/** Splits Databricks source text into cells (header and `COMMAND` separators removed). */
export function parseCells(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length && HEADER.test(lines[0])) lines.shift()
  const cells: string[] = []
  let cur: string[] = []
  for (const line of lines) {
    if (SEPARATOR.test(line)) {
      cells.push(cur.join('\n').trim())
      cur = []
    } else cur.push(line)
  }
  cells.push(cur.join('\n').trim())
  return cells.filter((c) => c !== '')
}

export interface CellSummary {
  left: number
  right: number
  unchanged: number
  /** Modified cells count as one removed and one added. */
  removed: number
  added: number
}

/** Cell-level summary: cells are matched by their content, ignoring position. */
export function summarizeCells(left: string, right: string): CellSummary {
  const l = parseCells(left)
  const r = parseCells(right)
  const pool = new Map<string, number>()
  for (const c of r) pool.set(c, (pool.get(c) ?? 0) + 1)
  let unchanged = 0
  for (const c of l) {
    const n = pool.get(c) ?? 0
    if (n > 0) {
      pool.set(c, n - 1)
      unchanged++
    }
  }
  return {
    left: l.length,
    right: r.length,
    unchanged,
    removed: l.length - unchanged,
    added: r.length - unchanged,
  }
}

interface IpynbCell {
  cell_type?: string
  source?: string | string[]
}

const joinSource = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join('') : (s ?? ''))

/** Converts a Jupyter/Databricks .ipynb into the Databricks source format so both can be compared. */
export function ipynbToSource(json: string): string {
  let nb: {
    cells?: IpynbCell[]
    metadata?: { language_info?: { name?: string }; kernelspec?: { language?: string } }
  }
  try {
    nb = JSON.parse(json)
  } catch {
    throw new FileError('This .ipynb file is not valid JSON.')
  }
  if (!nb || !Array.isArray(nb.cells)) throw new FileError('This .ipynb file has no cells.')
  const lang = (
    nb.metadata?.language_info?.name ??
    nb.metadata?.kernelspec?.language ??
    'python'
  ).toLowerCase()
  const p = PREFIX[lang] ?? '#'
  const magic = (src: string) =>
    src
      .split('\n')
      .map((l) => (l === '' ? `${p} MAGIC` : `${p} MAGIC ${l}`))
      .join('\n')
  const cells = nb.cells.map((c) => {
    const src = joinSource(c.source).replace(/\r\n?/g, '\n').replace(/\n+$/, '')
    if (c.cell_type === 'markdown') return magic(`%md\n${src}`)
    if (c.cell_type === 'raw') return magic(src)
    return /^%\w+/.test(src) ? magic(src) : src
  })
  return [`${p} Databricks notebook source`, ...cells].join(`\n\n${p} COMMAND ----------\n\n`) + '\n'
}

export async function loadNotebook(file: File): Promise<LoadedText> {
  if (extOf(file.name) !== 'ipynb') {
    const loaded = await readTextFile(file)
    if (!isDatabricksSource(loaded.text))
      loaded.note = `"${file.name}" has no "Databricks notebook source" header, so it is compared as plain code.`
    return loaded
  }
  const text = ipynbToSource(await file.text())
  return {
    name: file.name,
    text,
    size: file.size,
    note: `"${file.name}" was converted to the Databricks source format (outputs are ignored) so it can be compared with .py/.sql exports.`,
  }
}
