import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { ArrowLeft, ArrowRight, ChevronsUpDown, Copy } from 'lucide-react'
import type { DiffRow, MergeChoice } from '../../types/diff'
import type { Item, Match, ViewMode } from '../../features/text-diff/displayModel'
import type { MergeChoices } from '../../features/text-diff/merge'
import type { Run } from '../../lib/prism'
import { renderLine, type LineMatch } from './renderLine'

export interface MergeControls {
  choices: MergeChoices
  onChoose: (hunk: number, side: MergeChoice) => void
}

/** The row (or whole difference) under the pointer; it is highlighted on both sides. */
export interface Hover {
  item: number
  hunk: number | null
}

const isHover = (h: Hover | null | undefined, hunk: number | null, i: number) =>
  !!h && (hunk !== null ? h.hunk === hunk : h.hunk === null && h.item === i)

export interface DiffViewerProps {
  items: Item[]
  hunkItem: number[]
  view: ViewMode
  wrap: boolean
  fontSize: number
  leftRuns: Run[][] | null
  rightRuns: Run[][] | null
  matches: Match[]
  currentMatch: number
  currentHunk: number
  reveal: { item: number; nonce: number } | null
  onExpandFold: (id: string) => void
  merge?: MergeControls
  leftLabel: string
  hover?: Hover | null
  onHover?: (h: Hover | null) => void
  onCopy?: (side: 'left' | 'right') => void
  rightLabel: string
}

const OVERSCAN = 12
const MARKER = { added: '+', removed: '−', modified: '~', equal: '' } as const
const MARKER_LABEL = {
  added: 'Added',
  removed: 'Removed',
  modified: 'Modified',
  equal: '',
} as const

type ItemMatches = { side: Match['side']; m: LineMatch }[]

function tabLen(s: string | null): number {
  if (!s) return 0
  let n = 0
  for (const ch of s) n += ch === '\t' ? 4 : 1
  return n
}

/* -------------------------------------------------------------------------- */
/* Cells                                                                      */
/* -------------------------------------------------------------------------- */

interface CellProps {
  kind: DiffRow['kind'] | 'filler'
  no: number | null
  text: string | null
  segs?: DiffRow['leftSegs']
  segClass: string
  runs?: Run[]
  matches?: LineMatch[]
  currentMatch: number
  current: boolean
  hovered?: boolean
  wrap: boolean
  item: number
  extra?: React.ReactNode
}

const Cell = memo(function Cell(p: CellProps) {
  if (p.kind === 'filler' || p.text === null) {
    return (
      <div
        className={`drow filler ${p.wrap ? 'wrap' : ''}`}
        aria-hidden={p.extra ? undefined : true}
      >
        <span className="gutter" />
        <span className="marker" />
        <span className="code" />
        {p.extra}
      </div>
    )
  }
  const k = p.kind
  return (
    <div
      className={`drow ${k} ${p.wrap ? 'wrap' : ''} ${p.current ? 'current' : ''} ${p.hovered ? 'hover' : ''}`}
      data-item={p.item}
    >
      <span className="gutter">{p.no}</span>
      <span
        className="marker"
        role="img"
        aria-label={MARKER_LABEL[k] || undefined}
        aria-hidden={k === 'equal'}
      >
        {MARKER[k]}
      </span>
      <span className="code">
        {renderLine(p.text, {
          runs: p.runs,
          segs: p.segs,
          segClass: p.segClass,
          matches: p.matches,
          currentMatch: p.currentMatch,
        })}
      </span>
      {p.extra}
    </div>
  )
})

function MergeButtons({ hunk, merge }: { hunk: number; merge: MergeControls }) {
  const c = merge.choices[hunk]
  const base =
    'pointer-events-auto inline-flex h-[1.5em] items-center gap-1 rounded-md border px-1.5 text-[11px] font-sans font-medium leading-none'
  return (
    <span
      className="sticky right-2 z-10 ml-auto flex items-center gap-1 self-center pl-2"
      role="group"
      aria-label={`Merge difference ${hunk + 1}`}
    >
      <button
        type="button"
        className={`${base} ${c === 'left' ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-panel text-fg hover:bg-panel2'}`}
        title="Accept left: keep the original lines for this difference"
        aria-label={`Accept left for difference ${hunk + 1}`}
        aria-pressed={c === 'left'}
        onClick={() => merge.onChoose(hunk, 'left')}
      >
        <ArrowLeft size={11} aria-hidden /> Left
      </button>
      <button
        type="button"
        className={`${base} ${c === 'right' ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-panel text-fg hover:bg-panel2'}`}
        title="Accept right: use the modified lines for this difference"
        aria-label={`Accept right for difference ${hunk + 1}`}
        aria-pressed={c === 'right'}
        onClick={() => merge.onChoose(hunk, 'right')}
      >
        Right <ArrowRight size={11} aria-hidden />
      </button>
    </span>
  )
}

function FoldBar({
  item,
  onExpand,
}: {
  item: Extract<Item, { type: 'fold' }>
  onExpand: (id: string) => void
}) {
  return (
    <button type="button" className="fold w-full text-left" onClick={() => onExpand(item.id)}>
      <ChevronsUpDown size={13} aria-hidden />
      {item.count.toLocaleString()} unchanged {item.count === 1 ? 'line' : 'lines'} hidden — click
      to show
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function useItemMatches(matches: Match[]) {
  return useMemo(() => {
    const map = new Map<number, ItemMatches>()
    matches.forEach((m, idx) => {
      let list = map.get(m.item)
      if (!list) map.set(m.item, (list = []))
      list.push({ side: m.side, m: { start: m.start, end: m.end, idx } })
    })
    return map
  }, [matches])
}

function useViewport(ref: React.RefObject<HTMLDivElement | null>) {
  const [vh, setVh] = useState(600)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setVh(el.clientHeight || 600))
    ro.observe(el)
    setVh(el.clientHeight || 600)
    return () => ro.disconnect()
  }, [ref])
  return vh
}

function PaneHeader({
  children,
  copy,
}: {
  children: React.ReactNode
  copy?: { label: string; run: () => void }[]
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-panel2 px-3 py-1 text-xs font-medium text-muted">
      <span className="mr-auto truncate">{children}</span>
      {copy?.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.run}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-panel px-2 py-0.5 text-[11px] font-medium text-fg hover:bg-bg"
        >
          <Copy size={11} aria-hidden /> {c.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Split view, no wrapping: two virtualized panes with synchronized scrolling */
/* -------------------------------------------------------------------------- */

function SplitVirtual(p: DiffViewerProps) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const vh = useViewport(leftRef)
  const rowH = Math.round(p.fontSize * 1.65)
  const byItem = useItemMatches(p.matches)

  const { maxL, maxR } = useMemo(() => {
    let l = 0
    let r = 0
    for (const it of p.items) {
      if (it.type !== 'row') continue
      l = Math.max(l, tabLen(it.row.left))
      r = Math.max(r, tabLen(it.row.right))
    }
    return { maxL: l, maxR: r }
  }, [p.items])

  const sync = useCallback((src: HTMLDivElement | null, dst: HTMLDivElement | null) => {
    if (!src || !dst) return
    if (dst.scrollTop !== src.scrollTop) dst.scrollTop = src.scrollTop
    if (dst.scrollLeft !== src.scrollLeft) dst.scrollLeft = src.scrollLeft
    setScrollTop(src.scrollTop)
  }, [])

  // Scroll to a revealed item.
  useEffect(() => {
    if (!p.reveal || !leftRef.current) return
    const target = Math.max(0, p.reveal.item * rowH - vh / 3)
    leftRef.current.scrollTop = target
    if (rightRef.current) rightRef.current.scrollTop = target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.reveal?.nonce])

  const n = p.items.length
  const start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN)
  const end = Math.min(n, Math.ceil((scrollTop + vh) / rowH) + OVERSCAN)
  const style = {
    '--diff-font-size': `${p.fontSize}px`,
    '--diff-row-height': `${rowH}px`,
  } as CSSProperties

  const renderSide = (side: 'left' | 'right') => {
    const rows: React.ReactNode[] = []
    for (let i = start; i < end; i++) {
      const it = p.items[i]
      const top = i * rowH
      let content: React.ReactNode
      if (it.type === 'fold') {
        content = <FoldBar item={it} onExpand={p.onExpandFold} />
      } else if (it.type === 'row') {
        const r = it.row
        const text = side === 'left' ? r.left : r.right
        const no = side === 'left' ? r.leftNo : r.rightNo
        const kind = text === null ? 'filler' : r.kind
        const runs = (side === 'left' ? p.leftRuns : p.rightRuns)?.[(no ?? 1) - 1]
        const ms = byItem
          .get(i)
          ?.filter((x) => x.side === side)
          .map((x) => x.m)
        const showMerge =
          !!p.merge && r.hunk !== null && p.hunkItem[r.hunk] === i && side === 'left'
        content = (
          <Cell
            kind={kind}
            no={no}
            text={text}
            segs={side === 'left' ? r.leftSegs : r.rightSegs}
            segClass={side === 'left' ? 'seg-del' : 'seg-add'}
            runs={runs}
            matches={ms}
            currentMatch={p.currentMatch}
            current={r.hunk !== null && r.hunk === p.currentHunk}
            hovered={isHover(p.hover, r.hunk, i)}
            wrap={false}
            item={i}
            extra={showMerge ? <MergeButtons hunk={r.hunk!} merge={p.merge!} /> : undefined}
          />
        )
      }
      rows.push(
        <div
          key={i}
          style={{ position: 'absolute', top, left: 0, right: 0, height: rowH }}
          onMouseEnter={() => p.onHover?.(hoverKey(it, i))}
        >
          {content}
        </div>,
      )
    }
    return rows
  }

  const pane = (
    side: 'left' | 'right',
    ref: React.RefObject<HTMLDivElement | null>,
    other: React.RefObject<HTMLDivElement | null>,
    maxLen: number,
  ) => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PaneHeader
        copy={
          p.onCopy
            ? [
                {
                  label: side === 'left' ? 'Copy old version' : 'Copy new version',
                  run: () => p.onCopy!(side),
                },
              ]
            : undefined
        }
      >
        {side === 'left' ? p.leftLabel : p.rightLabel}
      </PaneHeader>
      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label={
          side === 'left' ? 'Original text with differences' : 'Modified text with differences'
        }
        className={`diff-font min-h-0 flex-1 overflow-auto ${side === 'left' ? 'border-r border-line' : ''}`}
        onScroll={(e) => sync(e.currentTarget, other.current)}
        onMouseLeave={() => p.onHover?.(null)}
      >
        <div
          style={{
            position: 'relative',
            height: n * rowH,
            minWidth: '100%',
            width: `calc(${maxLen}ch + 7em)`,
          }}
        >
          {renderSide(side)}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0" style={style}>
      {pane('left', leftRef, rightRef, maxL)}
      {pane('right', rightRef, leftRef, maxR)}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Split view with wrapping: a single scroller so wrapped rows stay aligned   */
/* -------------------------------------------------------------------------- */

function SplitWrapped(p: DiffViewerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const byItem = useItemMatches(p.matches)
  const rowH = Math.round(p.fontSize * 1.65)
  const style = {
    '--diff-font-size': `${p.fontSize}px`,
    '--diff-row-height': `${rowH}px`,
  } as CSSProperties

  useEffect(() => {
    if (!p.reveal) return
    ref.current
      ?.querySelector(`[data-slot="${p.reveal.item}"]`)
      ?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.reveal?.nonce])

  return (
    <div className="flex h-full min-h-0 flex-col" style={style}>
      <div className="grid grid-cols-2">
        <PaneHeader
          copy={
            p.onCopy ? [{ label: 'Copy old version', run: () => p.onCopy!('left') }] : undefined
          }
        >
          {p.leftLabel}
        </PaneHeader>
        <PaneHeader
          copy={
            p.onCopy ? [{ label: 'Copy new version', run: () => p.onCopy!('right') }] : undefined
          }
        >
          {p.rightLabel}
        </PaneHeader>
      </div>
      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label="Differences, side by side"
        onMouseLeave={() => p.onHover?.(null)}
        className="diff-font min-h-0 flex-1 overflow-auto"
      >
        {p.items.map((it, i) => {
          if (it.type === 'fold') return <FoldBar key={i} item={it} onExpand={p.onExpandFold} />
          if (it.type !== 'row') return null
          const r = it.row
          const ms = byItem.get(i)
          const showMerge = !!p.merge && r.hunk !== null && p.hunkItem[r.hunk] === i
          const current = r.hunk !== null && r.hunk === p.currentHunk
          return (
            <div
              key={i}
              data-slot={i}
              onMouseEnter={() => p.onHover?.(hoverKey(it, i))}
              className="grid grid-cols-2 [&>div:first-child]:border-r [&>div:first-child]:border-line"
            >
              <Cell
                kind={r.left === null ? 'filler' : r.kind}
                no={r.leftNo}
                text={r.left}
                segs={r.leftSegs}
                segClass="seg-del"
                runs={p.leftRuns?.[(r.leftNo ?? 1) - 1]}
                matches={ms?.filter((x) => x.side === 'left').map((x) => x.m)}
                currentMatch={p.currentMatch}
                current={current}
                hovered={isHover(p.hover, r.hunk, i)}
                wrap
                item={i}
                extra={showMerge ? <MergeButtons hunk={r.hunk!} merge={p.merge!} /> : undefined}
              />
              <Cell
                kind={r.right === null ? 'filler' : r.kind}
                no={r.rightNo}
                text={r.right}
                segs={r.rightSegs}
                segClass="seg-add"
                runs={p.rightRuns?.[(r.rightNo ?? 1) - 1]}
                matches={ms?.filter((x) => x.side === 'right').map((x) => x.m)}
                currentMatch={p.currentMatch}
                current={current}
                hovered={isHover(p.hover, r.hunk, i)}
                wrap
                item={i}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Unified view                                                               */
/* -------------------------------------------------------------------------- */

function Unified(p: DiffViewerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const vh = useViewport(ref)
  const rowH = Math.round(p.fontSize * 1.65)
  const byItem = useItemMatches(p.matches)
  const style = {
    '--diff-font-size': `${p.fontSize}px`,
    '--diff-row-height': `${rowH}px`,
  } as CSSProperties

  const maxLen = useMemo(
    () => p.items.reduce((m, it) => (it.type === 'urow' ? Math.max(m, tabLen(it.u.text)) : m), 0),
    [p.items],
  )

  useEffect(() => {
    if (!p.reveal || !ref.current) return
    if (p.wrap) {
      ref.current
        .querySelector(`[data-slot="${p.reveal.item}"]`)
        ?.scrollIntoView({ block: 'center' })
    } else {
      ref.current.scrollTop = Math.max(0, p.reveal.item * rowH - vh / 3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.reveal?.nonce])

  const renderItem = (i: number) => {
    const it = p.items[i]
    if (it.type === 'fold') return <FoldBar item={it} onExpand={p.onExpandFold} />
    if (it.type !== 'urow') return null
    const u = it.u
    const runs =
      u.kind === 'removed' ? p.leftRuns?.[(u.leftNo ?? 1) - 1] : p.rightRuns?.[(u.rightNo ?? 1) - 1]
    const showMerge = !!p.merge && u.hunk !== null && p.hunkItem[u.hunk] === i
    return (
      <div
        className={`drow ${u.kind} ${p.wrap ? 'wrap' : ''} ${u.hunk !== null && u.hunk === p.currentHunk ? 'current' : ''} ${isHover(p.hover, u.hunk, i) ? 'hover' : ''}`}
        data-item={i}
      >
        <span className="gutter">{u.leftNo}</span>
        <span className="gutter">{u.rightNo}</span>
        <span
          className="marker"
          role="img"
          aria-label={MARKER_LABEL[u.kind] || undefined}
          aria-hidden={u.kind === 'equal'}
        >
          {MARKER[u.kind]}
        </span>
        <span className="code">
          {renderLine(u.text, {
            runs,
            segs: u.segs,
            segClass: u.kind === 'removed' ? 'seg-del' : 'seg-add',
            matches: byItem.get(i)?.map((x) => x.m),
            currentMatch: p.currentMatch,
          })}
        </span>
        {showMerge && <MergeButtons hunk={u.hunk!} merge={p.merge!} />}
      </div>
    )
  }

  const n = p.items.length
  const start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN)
  const end = Math.min(n, Math.ceil((scrollTop + vh) / rowH) + OVERSCAN)

  return (
    <div className="flex h-full min-h-0 flex-col" style={style}>
      <PaneHeader
        copy={
          p.onCopy
            ? [
                { label: 'Copy old version', run: () => p.onCopy!('left') },
                { label: 'Copy new version', run: () => p.onCopy!('right') },
              ]
            : undefined
        }
      >
        {p.leftLabel} → {p.rightLabel}
      </PaneHeader>
      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label="Differences, unified"
        onMouseLeave={() => p.onHover?.(null)}
        className="diff-font min-h-0 flex-1 overflow-auto"
        onScroll={(e) => !p.wrap && setScrollTop(e.currentTarget.scrollTop)}
      >
        {p.wrap ? (
          p.items.map((_, i) => (
            <div key={i} data-slot={i}>
              {renderItem(i)}
            </div>
          ))
        ) : (
          <div
            style={{
              position: 'relative',
              height: n * rowH,
              minWidth: '100%',
              width: `calc(${maxLen}ch + 11em)`,
            }}
          >
            {Array.from({ length: end - start }, (_, k) => start + k).map((i) => (
              <div
                key={i}
                style={{ position: 'absolute', top: i * rowH, left: 0, right: 0, height: rowH }}
                onMouseEnter={() => p.onHover?.(hoverKey(p.items[i], i))}
              >
                {renderItem(i)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function hoverKey(it: Item, i: number): Hover {
  return { item: i, hunk: it.type === 'row' ? it.row.hunk : it.type === 'urow' ? it.u.hunk : null }
}

export function DiffViewer(props: DiffViewerProps) {
  const [hover, setHover] = useState<Hover | null>(null)
  const p = { ...props, hover, onHover: setHover }
  if (p.view === 'unified') return <Unified {...p} />
  return p.wrap ? <SplitWrapped {...p} /> : <SplitVirtual {...p} />
}
