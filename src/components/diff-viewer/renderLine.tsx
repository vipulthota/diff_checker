import type { ReactNode } from 'react'
import type { InlineSeg } from '../../types/diff'
import type { Run } from '../../lib/prism'

export interface LineMatch {
  start: number
  end: number
  /** global match index (used to mark the current match) */
  idx: number
}

interface Options {
  runs?: Run[]
  segs?: InlineSeg[]
  segClass?: string
  matches?: LineMatch[]
  currentMatch?: number
}

/**
 * Builds the contents of one line from three independent layers: syntax runs,
 * inline-diff segments and search matches. Everything is rendered as React text
 * nodes, never as HTML, so untrusted content cannot inject markup.
 */
export function renderLine(text: string, o: Options): ReactNode {
  if (text === '') return '​'
  const hasSegs = !!o.segs?.some((s) => s.changed)
  const hasMatches = !!o.matches?.length
  if (!o.runs && !hasSegs && !hasMatches) return text

  const bounds = new Set<number>([0, text.length])
  const runStarts: { at: number; cls?: string }[] = []
  if (o.runs) {
    let pos = 0
    for (const r of o.runs) {
      runStarts.push({ at: pos, cls: r.cls })
      pos += r.text.length
      bounds.add(pos)
    }
    // Syntax runs are built from the same text; if they ever disagree, ignore them.
    if (pos !== text.length) runStarts.length = 0
  }
  const changed: [number, number][] = []
  if (hasSegs) {
    let pos = 0
    for (const s of o.segs!) {
      if (s.changed) changed.push([pos, pos + s.text.length])
      pos += s.text.length
      bounds.add(pos)
    }
    if (pos !== text.length) changed.length = 0
  }
  for (const m of o.matches ?? []) {
    bounds.add(Math.min(m.start, text.length))
    bounds.add(Math.min(m.end, text.length))
  }
  for (const [a] of changed) bounds.add(a)
  const points = [...bounds].sort((a, b) => a - b)

  const out: ReactNode[] = []
  let ri = 0
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k]
    const b = points[k + 1]
    if (a === b) continue
    while (ri + 1 < runStarts.length && runStarts[ri + 1].at <= a) ri++
    const cls = runStarts.length ? runStarts[ri]?.cls : undefined
    const isChanged = changed.some(([s, e]) => a >= s && b <= e)
    const match = o.matches?.find((m) => a >= m.start && b <= m.end)
    let node: ReactNode = text.slice(a, b)
    if (cls || isChanged) {
      node = (
        <span className={`${cls ?? ''} ${isChanged ? (o.segClass ?? '') : ''}`.trim()}>{node}</span>
      )
    }
    if (match) {
      node = (
        <mark className={`match${match.idx === o.currentMatch ? ' current' : ''}`}>{node}</mark>
      )
    }
    out.push(<span key={k}>{node}</span>)
  }
  return out
}
