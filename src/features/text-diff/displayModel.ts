import type { DiffRow, TextDiffResult } from '../../types/diff'
import { toUnifiedRows, type UnifiedRow } from './TextDiffEngine'

export type ViewMode = 'split' | 'unified'

export type Item =
  | { type: 'row'; row: DiffRow; rowIdx: number }
  | { type: 'urow'; u: UnifiedRow }
  | { type: 'fold'; id: string; count: number; from: number; to: number }

export interface DisplayModel {
  items: Item[]
  /** Item index of the first item of each hunk. */
  hunkItem: number[]
}

const CONTEXT = 3

/** Which rows stay visible when unchanged lines are hidden (changes ± context). */
function keepFlags(rows: DiffRow[]): boolean[] {
  const keep = new Array<boolean>(rows.length).fill(false)
  rows.forEach((r, i) => {
    if (r.kind === 'equal') return
    for (let d = -CONTEXT; d <= CONTEXT; d++) {
      const x = i + d
      if (x >= 0 && x < rows.length) keep[x] = true
    }
  })
  return keep
}

export function buildDisplayModel(
  result: TextDiffResult,
  view: ViewMode,
  hideUnchanged: boolean,
  expanded: ReadonlySet<string>,
): DisplayModel {
  const rows = result.rows
  const items: Item[] = []
  const hunkItem: number[] = []

  const pushRows = (from: number, to: number) => {
    // [from, to)
    if (view === 'split') {
      for (let i = from; i < to; i++) items.push({ type: 'row', row: rows[i], rowIdx: i })
    } else {
      for (const u of toUnifiedRows(rows.slice(from, to))) items.push({ type: 'urow', u })
    }
  }

  if (!hideUnchanged || result.stats.differences === 0) {
    pushRows(0, rows.length)
  } else {
    const keep = keepFlags(rows)
    let i = 0
    while (i < rows.length) {
      let j = i
      while (j < rows.length && keep[j] === keep[i]) j++
      if (keep[i]) pushRows(i, j)
      else {
        const id = `f${i}`
        if (expanded.has(id)) pushRows(i, j)
        else items.push({ type: 'fold', id, count: j - i, from: i, to: j })
      }
      i = j
    }
  }

  const seen = new Set<number>()
  items.forEach((it, idx) => {
    const h = it.type === 'row' ? it.row.hunk : it.type === 'urow' ? it.u.hunk : null
    if (h !== null && !seen.has(h)) {
      seen.add(h)
      hunkItem[h] = idx
    }
  })
  return { items, hunkItem }
}

export type MatchSide = 'left' | 'right' | 'single'

export interface Match {
  item: number
  side: MatchSide
  start: number
  end: number
}

export const MAX_MATCHES = 5000

/** Literal (non-regex) search over what is currently displayed. */
export function findMatches(items: Item[], query: string, caseSensitive: boolean): Match[] {
  if (!query) return []
  const q = caseSensitive ? query : query.toLowerCase()
  const out: Match[] = []
  const scan = (text: string | null, item: number, side: MatchSide) => {
    if (!text) return
    const hay = caseSensitive ? text : text.toLowerCase()
    let from = 0
    for (;;) {
      const at = hay.indexOf(q, from)
      if (at < 0) break
      out.push({ item, side, start: at, end: at + q.length })
      from = at + Math.max(q.length, 1)
      if (out.length >= MAX_MATCHES) return
    }
  }
  for (let i = 0; i < items.length && out.length < MAX_MATCHES; i++) {
    const it = items[i]
    if (it.type === 'row') {
      scan(it.row.left, i, 'left')
      scan(it.row.right, i, 'right')
    } else if (it.type === 'urow') scan(it.u.text, i, 'single')
  }
  return out
}
