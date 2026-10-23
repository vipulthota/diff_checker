import { diffArrays } from 'diff'
import type {
  DiffRow,
  DiffStats,
  IgnoreOptions,
  InlineSeg,
  RowKind,
  TextDiffOptions,
  TextDiffResult,
} from '../../types/diff'

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

const PUNCT = /[\p{P}\p{S}]/gu

/** Builds the comparison key of a string according to the ignore options. */
export function normalizeText(s: string, ig: IgnoreOptions): string {
  let out = s
  if (ig.lineEndings) out = out.replace(/\r/g, '')
  if (ig.trimLines) out = out.trim()
  if (ig.case) out = out.toLowerCase()
  if (ig.punctuation) out = out.replace(PUNCT, '')
  if (ig.whitespace) out = out.replace(/\s+/g, '')
  return out
}

/** Splits text on LF. A trailing CR is kept on the line so CRLF/LF differences can be detected. */
export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  // A final newline does not create an extra empty line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

const stripCR = (s: string) => (s.endsWith('\r') ? s.slice(0, -1) : s)

/* -------------------------------------------------------------------------- */
/* Inline (intra-line) diff                                                   */
/* -------------------------------------------------------------------------- */

const WORD_TOKEN = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu

function tokenize(s: string, chars: boolean): string[] {
  if (chars) return Array.from(s)
  return s.match(WORD_TOKEN) ?? []
}

function mergeSegs(segs: InlineSeg[]): InlineSeg[] {
  const out: InlineSeg[] = []
  for (const s of segs) {
    if (s.text === '') continue
    const last = out[out.length - 1]
    if (last && last.changed === s.changed) last.text += s.text
    else out.push({ ...s })
  }
  return out
}

export interface InlineResult {
  left: InlineSeg[]
  right: InlineSeg[]
  /** Fraction (0..1) of characters shared between both sides. */
  similarity: number
}

export function inlineDiff(a: string, b: string, ig: IgnoreOptions, chars: boolean): InlineResult {
  const ta = tokenize(a, chars)
  const tb = tokenize(b, chars)
  const ka = ta.map((t) => normalizeText(t, ig))
  const kb = tb.map((t) => normalizeText(t, ig))
  // Tokens are wrapped in arrays so empty keys (fully ignored tokens) still compare equal.
  const changes = diffArrays(ka, kb, { timeout: 150 })
  const left: InlineSeg[] = []
  const right: InlineSeg[] = []
  if (!changes) {
    return {
      left: [{ text: a, changed: a !== b }],
      right: [{ text: b, changed: a !== b }],
      similarity: 0,
    }
  }
  let i = 0
  let j = 0
  let same = 0
  for (const c of changes) {
    const n = c.value.length
    if (c.added) {
      for (let k = 0; k < n; k++) {
        const t = tb[j++]
        right.push({ text: t, changed: kb[j - 1] !== '' })
      }
    } else if (c.removed) {
      for (let k = 0; k < n; k++) {
        const t = ta[i++]
        left.push({ text: t, changed: ka[i - 1] !== '' })
      }
    } else {
      for (let k = 0; k < n; k++) {
        const ta_ = ta[i++]
        const tb_ = tb[j++]
        left.push({ text: ta_, changed: false })
        right.push({ text: tb_, changed: false })
        same += tb_.length
      }
    }
  }
  const total = Math.max(a.length, b.length, 1)
  return { left: mergeSegs(left), right: mergeSegs(right), similarity: same / total }
}

/* -------------------------------------------------------------------------- */
/* Line diff                                                                  */
/* -------------------------------------------------------------------------- */

interface Entry {
  /** index into the original line array */
  idx: number
  key: string
}

interface Op {
  type: 'equal' | 'del' | 'add'
  /** original line indices */
  l?: number
  r?: number
}

/** Myers diff over comparison keys with common prefix/suffix trimming for speed. */
function diffKeys(a: Entry[], b: Entry[]): { ops: Op[]; approximate: boolean } {
  const ops: Op[] = []
  let start = 0
  while (start < a.length && start < b.length && a[start].key === b[start].key) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1].key === b[endB - 1].key) {
    endA--
    endB--
  }
  for (let i = 0; i < start; i++) ops.push({ type: 'equal', l: a[i].idx, r: b[i].idx })

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  let approximate = false
  if (midA.length === 0) {
    for (const e of midB) ops.push({ type: 'add', r: e.idx })
  } else if (midB.length === 0) {
    for (const e of midA) ops.push({ type: 'del', l: e.idx })
  } else {
    const changes = diffArrays(
      midA.map((e) => e.key),
      midB.map((e) => e.key),
      { timeout: 4000 },
    )
    if (!changes) {
      // Too expensive: treat the whole middle section as replaced.
      approximate = true
      for (const e of midA) ops.push({ type: 'del', l: e.idx })
      for (const e of midB) ops.push({ type: 'add', r: e.idx })
    } else {
      let i = 0
      let j = 0
      for (const c of changes) {
        for (let k = 0; k < c.value.length; k++) {
          if (c.added) ops.push({ type: 'add', r: midB[j++].idx })
          else if (c.removed) ops.push({ type: 'del', l: midA[i++].idx })
          else ops.push({ type: 'equal', l: midA[i++].idx, r: midB[j++].idx })
        }
      }
    }
  }
  for (let i = endA, j = endB; i < a.length; i++, j++)
    ops.push({ type: 'equal', l: a[i].idx, r: b[j].idx })
  return { ops, approximate }
}

function emptyStats(): DiffStats {
  return { differences: 0, added: 0, removed: 0, modified: 0, unchanged: 0 }
}

export const EMPTY_RESULT: TextDiffResult = {
  rows: [],
  stats: emptyStats(),
  hunkStarts: [],
  approximate: false,
}

/* -------------------------------------------------------------------------- */
/* Pairing of removed/added lines inside one change block                     */
/* -------------------------------------------------------------------------- */

type PairOp =
  { t: 'pair'; d: number; a: number } | { t: 'del'; d: number } | { t: 'add'; a: number }

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

function dice(a: string, b: string, ga: Map<string, number>, gb: Map<string, number>): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  let inter = 0
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0)
  return (2 * inter) / (a.length - 1 + (b.length - 1))
}

const PAIR_THRESHOLD = 0.4
const ALIGN_LIMIT = 90_000

/**
 * Decides which removed line pairs with which added line. Equal-sized blocks are a
 * straightforward replacement (paired in order). For uneven blocks, lines are aligned by
 * similarity so a changed line pairs with its real counterpart instead of a neighbour.
 */
function pairBlock(delKeys: string[], addKeys: string[]): PairOp[] {
  const n = delKeys.length
  const m = addKeys.length
  const ops: PairOp[] = []
  if (n === m || n * m > ALIGN_LIMIT || n === 0 || m === 0) {
    const k = Math.min(n, m)
    for (let i = 0; i < k; i++) ops.push({ t: 'pair', d: i, a: i })
    for (let i = k; i < n; i++) ops.push({ t: 'del', d: i })
    for (let j = k; j < m; j++) ops.push({ t: 'add', a: j })
    return ops
  }
  const gd = delKeys.map(bigrams)
  const ga = addKeys.map(bigrams)
  const sim: number[][] = delKeys.map((dk, i) => addKeys.map((ak, j) => dice(dk, ak, gd[i], ga[j])))
  // dp[i][j]: best total similarity using dels[i..] and adds[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      let best = Math.max(dp[i + 1][j], dp[i][j + 1])
      if (sim[i][j] >= PAIR_THRESHOLD) best = Math.max(best, dp[i + 1][j + 1] + sim[i][j])
      dp[i][j] = best
    }
  }
  let i = 0
  let j = 0
  const pendDel: number[] = []
  const pendAdd: number[] = []
  const flush = () => {
    for (const d of pendDel) ops.push({ t: 'del', d })
    for (const a of pendAdd) ops.push({ t: 'add', a })
    pendDel.length = 0
    pendAdd.length = 0
  }
  while (i < n && j < m) {
    if (sim[i][j] >= PAIR_THRESHOLD && dp[i][j] === dp[i + 1][j + 1] + sim[i][j]) {
      flush()
      ops.push({ t: 'pair', d: i++, a: j++ })
    } else if (dp[i][j] === dp[i + 1][j]) pendDel.push(i++)
    else pendAdd.push(j++)
  }
  while (i < n) pendDel.push(i++)
  while (j < m) pendAdd.push(j++)
  flush()
  return ops
}

export function computeTextDiff(
  leftText: string,
  rightText: string,
  options: TextDiffOptions,
): TextDiffResult {
  const ig = options.ignore
  const leftLines = splitLines(leftText)
  const rightLines = splitLines(rightText)

  const entries = (lines: string[]): Entry[] => {
    const out: Entry[] = []
    lines.forEach((line, idx) => {
      const key = normalizeText(line, ig)
      if (ig.blankLines && key.trim() === '') return
      out.push({ idx, key })
    })
    return out
  }

  const { ops, approximate } = diffKeys(entries(leftLines), entries(rightLines))

  const rows: DiffRow[] = []
  const stats = emptyStats()
  let nextL = 0
  let nextR = 0

  const pushEqual = (l: number | null, r: number | null) => {
    rows.push({
      kind: 'equal',
      leftNo: l === null ? null : l + 1,
      rightNo: r === null ? null : r + 1,
      left: l === null ? null : stripCR(leftLines[l]),
      right: r === null ? null : stripCR(rightLines[r]),
      hunk: null,
    })
    stats.unchanged++
  }

  /** Emits ignored (blank) lines that precede the given original indices. */
  const flushBlanks = (uptoL: number, uptoR: number) => {
    while (nextL < uptoL || nextR < uptoR) {
      const l = nextL < uptoL ? nextL++ : null
      const r = nextR < uptoR ? nextR++ : null
      pushEqual(l, r)
    }
  }

  let hunk = -1
  const hunkStarts: number[] = []
  const startHunk = () => {
    hunk++
    hunkStarts.push(rows.length)
    stats.differences++
    return hunk
  }

  let k = 0
  while (k < ops.length) {
    const op = ops[k]
    if (op.type === 'equal') {
      flushBlanks(op.l!, op.r!)
      pushEqual(op.l!, op.r!)
      nextL = op.l! + 1
      nextR = op.r! + 1
      k++
      continue
    }
    // Gather one contiguous change block (deletions and additions).
    const dels: number[] = []
    const adds: number[] = []
    while (k < ops.length && ops[k].type !== 'equal') {
      if (ops[k].type === 'del') dels.push(ops[k].l!)
      else adds.push(ops[k].r!)
      k++
    }
    flushBlanks(dels.length ? dels[0] : nextL, adds.length ? adds[0] : nextR)
    const h = startHunk()
    const seq = pairBlock(
      dels.map((l) => normalizeText(leftLines[l], ig)),
      adds.map((r) => normalizeText(rightLines[r], ig)),
    )
    for (const op of seq) {
      if (op.t === 'pair') {
        const l = dels[op.d]
        const r = adds[op.a]
        const lt = stripCR(leftLines[l])
        const rt = stripCR(rightLines[r])
        const row: DiffRow = {
          kind: 'modified',
          leftNo: l + 1,
          rightNo: r + 1,
          left: lt,
          right: rt,
          hunk: h,
        }
        if (options.granularity !== 'lines') {
          let res: InlineResult | null = null
          if (options.granularity === 'smart') {
            // Words by default, characters when they give a cleaner result than whole words
            // (e.g. color -> colour), whole-line highlighting when the lines are mostly unrelated.
            const words = inlineDiff(lt, rt, ig, false)
            if (words.similarity >= 0.3) {
              const count = (x: InlineResult) =>
                x.left.filter((s) => s.changed).length + x.right.filter((s) => s.changed).length
              const chars = inlineDiff(lt, rt, ig, true)
              res = count(chars) <= count(words) ? chars : words
            }
          } else {
            res = inlineDiff(lt, rt, ig, options.granularity === 'chars')
          }
          if (res) {
            row.leftSegs = res.left
            row.rightSegs = res.right
          }
        }
        rows.push(row)
        stats.modified++
      } else if (op.t === 'del') {
        rows.push({
          kind: 'removed',
          leftNo: dels[op.d] + 1,
          rightNo: null,
          left: stripCR(leftLines[dels[op.d]]),
          right: null,
          hunk: h,
        })
        stats.removed++
      } else {
        rows.push({
          kind: 'added',
          leftNo: null,
          rightNo: adds[op.a] + 1,
          left: null,
          right: stripCR(rightLines[adds[op.a]]),
          hunk: h,
        })
        stats.added++
      }
    }
    if (dels.length) nextL = dels[dels.length - 1] + 1
    if (adds.length) nextR = adds[adds.length - 1] + 1
  }
  flushBlanks(leftLines.length, rightLines.length)

  return { rows, stats, hunkStarts, approximate }
}

/* -------------------------------------------------------------------------- */
/* Derived views                                                              */
/* -------------------------------------------------------------------------- */

export interface UnifiedRow {
  kind: Exclude<RowKind, 'modified'>
  leftNo: number | null
  rightNo: number | null
  text: string
  segs?: InlineSeg[]
  hunk: number | null
  /** index of the source DiffRow */
  source: number
}

/** Flattens rows into a single column: modified rows become a removal followed by an addition. */
export function toUnifiedRows(rows: DiffRow[]): UnifiedRow[] {
  const out: UnifiedRow[] = []
  rows.forEach((r, source) => {
    if (r.kind === 'equal') {
      out.push({
        kind: 'equal',
        leftNo: r.leftNo,
        rightNo: r.rightNo,
        text: r.right ?? r.left ?? '',
        hunk: null,
        source,
      })
    } else if (r.kind === 'modified') {
      // Pair rows: group all removals of a hunk before additions for readability.
      out.push({
        kind: 'removed',
        leftNo: r.leftNo,
        rightNo: null,
        text: r.left ?? '',
        segs: r.leftSegs,
        hunk: r.hunk,
        source,
      })
    } else if (r.kind === 'removed') {
      out.push({
        kind: 'removed',
        leftNo: r.leftNo,
        rightNo: null,
        text: r.left ?? '',
        hunk: r.hunk,
        source,
      })
    } else {
      out.push({
        kind: 'added',
        leftNo: null,
        rightNo: r.rightNo,
        text: r.right ?? '',
        hunk: r.hunk,
        source,
      })
    }
  })
  // Insert the additions of modified rows after the removals of their hunk.
  const result: UnifiedRow[] = []
  let i = 0
  while (i < out.length) {
    const u = out[i]
    if (u.hunk === null) {
      result.push(u)
      i++
      continue
    }
    const h = u.hunk
    const block: UnifiedRow[] = []
    while (i < out.length && out[i].hunk === h) block.push(out[i++])
    const removed: UnifiedRow[] = []
    const added: UnifiedRow[] = []
    for (const b of block) {
      if (b.kind === 'removed') {
        removed.push(b)
        const src = rows[b.source]
        if (src.kind === 'modified') {
          added.push({
            kind: 'added',
            leftNo: null,
            rightNo: src.rightNo,
            text: src.right ?? '',
            segs: src.rightSegs,
            hunk: h,
            source: b.source,
          })
        }
      } else added.push(b)
    }
    result.push(...removed, ...added)
  }
  return result
}

/** Builds a standard unified diff (3 lines of context) from the computed rows. */
export function toUnifiedDiff(
  result: TextDiffResult,
  leftName = 'original',
  rightName = 'modified',
  context = 3,
): string {
  const rows = result.rows
  if (result.stats.differences === 0) return ''
  const keep = new Array<boolean>(rows.length).fill(false)
  rows.forEach((r, i) => {
    if (r.kind === 'equal') return
    for (let d = -context; d <= context; d++) {
      const x = i + d
      if (x >= 0 && x < rows.length) keep[x] = true
    }
  })
  const out: string[] = [`--- ${leftName}`, `+++ ${rightName}`]
  let i = 0
  while (i < rows.length) {
    if (!keep[i]) {
      i++
      continue
    }
    const startIdx = i
    while (i < rows.length && keep[i]) i++
    const slice = rows.slice(startIdx, i)
    let lCount = 0
    let rCount = 0
    let lStart: number | null = null
    let rStart: number | null = null
    const body: string[] = []
    const dels: string[] = []
    const adds: string[] = []
    const flush = () => {
      body.push(...dels, ...adds)
      dels.length = 0
      adds.length = 0
    }
    for (const r of slice) {
      if (r.leftNo !== null && lStart === null) lStart = r.leftNo
      if (r.rightNo !== null && rStart === null) rStart = r.rightNo
      if (r.kind === 'equal') {
        flush()
        if (r.left !== null && r.right !== null) {
          body.push(' ' + r.left)
          lCount++
          rCount++
        } else if (r.left !== null) {
          body.push('-' + r.left)
          lCount++
        } else if (r.right !== null) {
          body.push('+' + r.right)
          rCount++
        }
        continue
      }
      if (r.left !== null) {
        dels.push('-' + r.left)
        lCount++
      }
      if (r.right !== null) {
        adds.push('+' + r.right)
        rCount++
      }
    }
    flush()
    const ls = lCount === 0 ? (lStart ?? 1) - 1 : (lStart ?? 1)
    const rs = rCount === 0 ? (rStart ?? 1) - 1 : (rStart ?? 1)
    out.push(`@@ -${ls},${lCount} +${rs},${rCount} @@`, ...body)
  }
  return out.join('\n') + '\n'
}

export function countChars(text: string): { lines: number; chars: number; words: number } {
  const lines = text === '' ? 0 : splitLines(text).length
  const trimmed = text.trim()
  return { lines, chars: text.length, words: trimmed === '' ? 0 : trimmed.split(/\s+/).length }
}
