import { diffArrays } from 'diff'
import type {
  SheetCell,
  SheetColumn,
  SheetData,
  SheetDiffOptions,
  SheetDiffResult,
  SheetRow,
  SheetStats,
} from '../../types/sheet'

export function columnLabel(i: number): string {
  let s = ''
  let n = i
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

export function normalizeCell(v: string | null | undefined, o: SheetDiffOptions): string {
  let s = v ?? ''
  if (o.ignoreWhitespace) s = s.replace(/\s+/g, '')
  else s = s.trim()
  if (o.ignoreCase) s = s.toLowerCase()
  return s
}

const width = (rows: SheetData) => rows.reduce((m, r) => Math.max(m, r.length), 0)

function alignColumns(left: SheetData, right: SheetData, o: SheetDiffOptions): SheetColumn[] {
  const lw = width(left)
  const rw = width(right)
  if (o.header && left.length && right.length) {
    const lh = Array.from({ length: lw }, (_, i) => left[0][i] ?? '')
    const rh = Array.from({ length: rw }, (_, i) => right[0][i] ?? '')
    const changes =
      diffArrays(
        lh.map((h) => normalizeCell(h, o)),
        rh.map((h) => normalizeCell(h, o)),
        { timeout: 1000 },
      ) ?? []
    const cols: SheetColumn[] = []
    let i = 0
    let j = 0
    for (const c of changes) {
      for (let k = 0; k < c.value.length; k++) {
        if (c.added) {
          cols.push({
            label: rh[j] || columnLabel(j),
            leftIdx: null,
            rightIdx: j++,
            status: 'added',
          })
        } else if (c.removed) {
          cols.push({
            label: lh[i] || columnLabel(i),
            leftIdx: i++,
            rightIdx: null,
            status: 'removed',
          })
        } else {
          cols.push({
            label: rh[j] || lh[i] || columnLabel(j),
            leftIdx: i++,
            rightIdx: j++,
            status: 'same',
          })
        }
      }
    }
    return cols
  }
  const n = Math.max(lw, rw)
  return Array.from({ length: n }, (_, i) => ({
    label: columnLabel(i),
    leftIdx: i < lw ? i : null,
    rightIdx: i < rw ? i : null,
    status: i < lw && i < rw ? 'same' : i < lw ? 'removed' : 'added',
  }))
}

export function computeSheetDiff(
  left: SheetData,
  right: SheetData,
  o: SheetDiffOptions,
): SheetDiffResult {
  const columns = alignColumns(left, right, o)
  const lRows = o.header ? left.slice(1) : left
  const rRows = o.header ? right.slice(1) : right
  const offset = o.header ? 2 : 1 // spreadsheet row numbers start at 1; header takes row 1

  const common = columns.filter((c) => c.status === 'same')
  const keyOf = (row: string[], side: 'left' | 'right') =>
    common
      .map((c) => normalizeCell(row[(side === 'left' ? c.leftIdx : c.rightIdx) as number], o))
      .join('\u0001')

  const lk = lRows.map((r) => keyOf(r, 'left'))
  const rk = rRows.map((r) => keyOf(r, 'right'))

  // Trim common prefix/suffix for speed on big sheets.
  let start = 0
  while (start < lk.length && start < rk.length && lk[start] === rk[start]) start++
  let eL = lk.length
  let eR = rk.length
  while (eL > start && eR > start && lk[eL - 1] === rk[eR - 1]) {
    eL--
    eR--
  }
  type Op = { t: 'eq' | 'del' | 'add'; l?: number; r?: number }
  const ops: Op[] = []
  for (let i = 0; i < start; i++) ops.push({ t: 'eq', l: i, r: i })
  const midL = lk.slice(start, eL)
  const midR = rk.slice(start, eR)
  if (!midL.length) midR.forEach((_, i) => ops.push({ t: 'add', r: start + i }))
  else if (!midR.length) midL.forEach((_, i) => ops.push({ t: 'del', l: start + i }))
  else {
    const ch = diffArrays(midL, midR, { timeout: 4000 })
    if (!ch) {
      midL.forEach((_, i) => ops.push({ t: 'del', l: start + i }))
      midR.forEach((_, i) => ops.push({ t: 'add', r: start + i }))
    } else {
      let i = start
      let j = start
      for (const c of ch)
        for (let k = 0; k < c.value.length; k++) {
          if (c.added) ops.push({ t: 'add', r: j++ })
          else if (c.removed) ops.push({ t: 'del', l: i++ })
          else ops.push({ t: 'eq', l: i++, r: j++ })
        }
    }
  }
  for (let i = eL, j = eR; i < lk.length; i++, j++) ops.push({ t: 'eq', l: i, r: j })

  const stats: SheetStats = {
    addedRows: 0,
    removedRows: 0,
    modifiedRows: 0,
    unchangedRows: 0,
    addedCols: columns.filter((c) => c.status === 'added').length,
    removedCols: columns.filter((c) => c.status === 'removed').length,
    modifiedCells: 0,
  }

  const makeCells = (l: string[] | null, r: string[] | null): SheetCell[] =>
    columns.map((c) => {
      const lv = l && c.leftIdx !== null ? (l[c.leftIdx] ?? '') : null
      const rv = r && c.rightIdx !== null ? (r[c.rightIdx] ?? '') : null
      if (c.status === 'added') return { left: null, right: rv, status: r ? 'added' : 'same' }
      if (c.status === 'removed') return { left: lv, right: null, status: l ? 'removed' : 'same' }
      if (l && r) {
        const same = normalizeCell(lv, o) === normalizeCell(rv, o)
        return { left: lv, right: rv, status: same ? 'same' : 'modified' }
      }
      return { left: lv, right: rv, status: 'same' }
    })

  const rows: SheetRow[] = []
  let k = 0
  while (k < ops.length) {
    const op = ops[k]
    if (op.t === 'eq') {
      rows.push({
        kind: 'equal',
        leftNo: op.l! + offset,
        rightNo: op.r! + offset,
        cells: makeCells(lRows[op.l!], rRows[op.r!]),
      })
      stats.unchangedRows++
      k++
      continue
    }
    const dels: number[] = []
    const adds: number[] = []
    while (k < ops.length && ops[k].t !== 'eq') {
      if (ops[k].t === 'del') dels.push(ops[k].l!)
      else adds.push(ops[k].r!)
      k++
    }
    const pairs = Math.min(dels.length, adds.length)
    for (let p = 0; p < pairs; p++) {
      const cells = makeCells(lRows[dels[p]], rRows[adds[p]])
      const mods = cells.filter((c) => c.status === 'modified').length
      stats.modifiedCells += mods
      rows.push({
        kind: mods ? 'modified' : 'equal',
        leftNo: dels[p] + offset,
        rightNo: adds[p] + offset,
        cells,
      })
      if (mods) stats.modifiedRows++
      else stats.unchangedRows++
    }
    for (let p = pairs; p < dels.length; p++) {
      rows.push({
        kind: 'removed',
        leftNo: dels[p] + offset,
        rightNo: null,
        cells: makeCells(lRows[dels[p]], null),
      })
      stats.removedRows++
    }
    for (let p = pairs; p < adds.length; p++) {
      rows.push({
        kind: 'added',
        leftNo: null,
        rightNo: adds[p] + offset,
        cells: makeCells(null, rRows[adds[p]]),
      })
      stats.addedRows++
    }
  }
  return { columns, rows, stats }
}

/** Flattens the result to a table with a leading status column (for CSV/XLSX export). */
export function sheetResultToTable(res: SheetDiffResult): string[][] {
  const header = ['Status', 'Left row', 'Right row', ...res.columns.map((c) => c.label)]
  const body = res.rows.map((r) => [
    r.kind === 'equal'
      ? 'unchanged'
      : r.kind === 'modified'
        ? 'modified'
        : r.kind === 'added'
          ? 'added'
          : 'removed',
    r.leftNo?.toString() ?? '',
    r.rightNo?.toString() ?? '',
    ...r.cells.map((c) =>
      c.status === 'modified' ? `${c.left} → ${c.right}` : (c.right ?? c.left ?? ''),
    ),
  ])
  return [header, ...body]
}
