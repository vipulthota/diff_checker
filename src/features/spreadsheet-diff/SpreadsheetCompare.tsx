import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Dropzone, FilePicker } from '../../components/file-dropzone/Dropzone'
import { Button, IconButton } from '../../components/ui/Button'
import { Checkbox, Notice, Select, Spinner } from '../../components/ui/Controls'
import { Menu, MenuItem } from '../../components/ui/Menu'
import { useSheetDiff } from '../../hooks/useSheetDiff'
import { friendlyError } from '../../lib/files'
import { useUi } from '../../lib/ui-context'
import type { SheetCell, SheetDiffOptions, SheetRow } from '../../types/sheet'
import { downloadBlob, downloadText } from '../../utils/download'
import { formatBytes } from '../../utils/format'
import { sheetResultToTable } from './SpreadsheetDiffEngine'
import { parseWorkbook, type Workbook } from './parseSheet'

const ROW_H = 34
const COL_W = 168
const NUM_W = 112
const ACCEPT = '.csv,.tsv,.xlsx,.xls'

type Filter = 'all' | 'changed' | 'added' | 'removed' | 'modified'

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

interface Loaded {
  wb: Workbook
  sheet: string
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="match">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function CellView({ c, q }: { c: SheetCell; q: string }) {
  if (c.status === 'modified')
    return (
      <span className="flex min-w-0 flex-col leading-tight" title={`${c.left} → ${c.right}`}>
        <span className="truncate text-del line-through decoration-1">
          <Highlight text={c.left ?? ''} q={q} />
        </span>
        <span className="truncate font-medium text-add">
          <Highlight text={c.right ?? ''} q={q} />
        </span>
      </span>
    )
  const v = c.status === 'removed' ? c.left : (c.right ?? c.left)
  return (
    <span
      className={`truncate ${c.status === 'added' ? 'text-add' : c.status === 'removed' ? 'text-del line-through' : ''}`}
      title={v ?? ''}
    >
      <Highlight text={v ?? ''} q={q} />
    </span>
  )
}

export function SpreadsheetCompare() {
  const { toast } = useUi()
  const [left, setLeft] = useState<Loaded | null>(null)
  const [right, setRight] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [header, setHeader] = useState(true)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [matchIdx, setMatchIdx] = useState(0)
  const [diffIdx, setDiffIdx] = useState(-1)
  const [scrollTop, setScrollTop] = useState(0)
  const [vh, setVh] = useState(500)
  const scrollRef = useRef<HTMLDivElement>(null)

  const options = useMemo<SheetDiffOptions>(
    () => ({ header, ignoreWhitespace, ignoreCase }),
    [header, ignoreWhitespace, ignoreCase],
  )
  const leftData = left ? left.wb.sheets[left.sheet] : null
  const rightData = right ? right.wb.sheets[right.sheet] : null
  const { result, loading, error } = useSheetDiff(leftData, rightData, options)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setVh(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  })

  const load = useCallback(
    async (side: 'left' | 'right', file: File) => {
      setBusy(true)
      try {
        const wb = await parseWorkbook(file)
        const loaded = { wb, sheet: wb.sheetNames[0] }
        if (side === 'left') setLeft(loaded)
        else setRight(loaded)
        if (wb.warning) toast(wb.warning, 'info')
        if (Object.values(wb.sheets).every((s) => s.length === 0))
          toast(`"${file.name}" has no data.`, 'info')
      } catch (e) {
        toast(friendlyError(e, `Unable to read "${file.name}".`), 'error')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  const onFiles = (side: 'left' | 'right') => (files: File[]) => {
    if (files.length >= 2) {
      void load('left', files[0])
      void load('right', files[1])
    } else void load(side, files[0])
  }

  const rows: SheetRow[] = useMemo(() => {
    if (!result) return []
    return result.rows.filter((r) => {
      if (filter === 'all') return !hideUnchanged || r.kind !== 'equal'
      if (filter === 'changed') return r.kind !== 'equal'
      return r.kind === filter
    })
  }, [result, hideUnchanged, filter])

  const matches = useMemo(() => {
    if (!query || !result) return [] as number[]
    const q = query.toLowerCase()
    const out: number[] = []
    rows.forEach((r, i) => {
      if (
        r.cells.some(
          (c) =>
            (c.left ?? '').toLowerCase().includes(q) || (c.right ?? '').toLowerCase().includes(q),
        )
      )
        out.push(i)
    })
    return out
  }, [rows, query, result])

  useEffect(() => setMatchIdx(0), [query])

  const scrollToRow = useCallback((i: number) => {
    const el = scrollRef.current
    if (el) el.scrollTop = Math.max(0, i * ROW_H - el.clientHeight / 3)
  }, [])

  const diffRows = useMemo(() => {
    const out: number[] = []
    rows.forEach((r, i) => r.kind !== 'equal' && out.push(i))
    return out
  }, [rows])

  const nextDiff = (dir: 1 | -1) => {
    if (!diffRows.length) return
    const n =
      diffIdx < 0
        ? dir === 1
          ? 0
          : diffRows.length - 1
        : (diffIdx + dir + diffRows.length) % diffRows.length
    setDiffIdx(n)
    scrollToRow(diffRows[n])
  }
  const goMatch = (d: number) => {
    if (!matches.length) return
    const n = (matchIdx + d + matches.length) % matches.length
    setMatchIdx(n)
    scrollToRow(matches[n])
  }
  useEffect(() => {
    if (matches.length) scrollToRow(matches[0])
  }, [matches, scrollToRow])

  const columns = result?.columns ?? []
  const totalW = NUM_W + columns.length * COL_W
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 10)
  const end = Math.min(rows.length, Math.ceil((scrollTop + vh) / ROW_H) + 10)

  const exportCsv = () => {
    if (!result) return
    const t = sheetResultToTable(result)
    downloadText(
      t.map((r) => r.map(csvEscape).join(',')).join('\r\n'),
      'diffspace-spreadsheet-comparison.csv',
      'text/csv',
    )
  }
  const exportXlsx = async () => {
    if (!result) return
    try {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.aoa_to_sheet(sheetResultToTable(result))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Comparison')
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      downloadBlob(
        new Blob([out], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'diffspace-spreadsheet-comparison.xlsx',
      )
    } catch {
      toast('Unable to create the XLSX file.', 'error')
    }
  }

  const fileCard = (side: 'left' | 'right', label: string, l: Loaded | null) => (
    <Dropzone
      onFiles={onFiles(side)}
      label={`Drop spreadsheet as ${label}`}
      className="min-w-0 flex-1"
    >
      <div className="flex h-full min-h-[8rem] items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <FileSpreadsheet size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{label}</h2>
          {l ? (
            <>
              <p className="truncate text-[13px] text-muted" title={l.wb.name}>
                {l.wb.name} · {formatBytes(l.wb.size)}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[13px]">
                <span className="text-muted">Worksheet</span>
                <Select
                  label={`${label} worksheet`}
                  value={l.sheet}
                  onChange={(v) =>
                    side === 'left' ? setLeft({ ...l, sheet: v }) : setRight({ ...l, sheet: v })
                  }
                  options={l.wb.sheetNames.map((n) => ({ value: n, label: n }))}
                  className="max-w-[12rem]"
                />
                <span className="text-muted">
                  {l.wb.sheets[l.sheet].length.toLocaleString()} rows
                </span>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">Drop CSV, TSV, XLSX or XLS here</p>
          )}
        </div>
        <FilePicker
          onFiles={onFiles(side)}
          accept={ACCEPT}
          label={l ? 'Replace' : 'Choose file'}
          variant={l ? 'ghost' : 'primary'}
        />
        {l && (
          <IconButton
            label={`Remove ${label} file`}
            onClick={() => (side === 'left' ? setLeft(null) : setRight(null))}
          >
            <Trash2 size={16} />
          </IconButton>
        )}
      </div>
    </Dropzone>
  )

  const stats = result?.stats
  const noDiff =
    !!stats &&
    stats.addedRows +
      stats.removedRows +
      stats.modifiedRows +
      stats.addedCols +
      stats.removedCols ===
      0

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5.25rem)] w-full max-w-[1800px] flex-col gap-3 p-3 md:h-[calc(100dvh-5.25rem)] md:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold leading-tight">Spreadsheet Compare</h1>
          <p className="text-[13px] text-muted">
            Compare rows, columns and cells of CSV, TSV, XLSX and XLS files. Files are parsed
            locally in your browser.
          </p>
        </div>
        {(left || right) && (
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={<ArrowLeftRight size={15} aria-hidden />}
              onClick={() => {
                setLeft(right)
                setRight(left)
              }}
            >
              Swap
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setLeft(null)
                setRight(null)
              }}
            >
              New comparison
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        {fileCard('left', 'Original', left)}
        {fileCard('right', 'Modified', right)}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner size={14} /> Reading spreadsheet…
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}

      {!result ? (
        !busy &&
        !error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-8 text-center text-muted">
            <FileSpreadsheet size={34} aria-hidden />
            <p>Add two spreadsheets to see which rows, columns and cells changed.</p>
          </div>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center rounded-lg border border-line bg-panel px-1">
              <Checkbox
                checked={header}
                onChange={setHeader}
                hint="Align columns by their header names"
              >
                First row is header
              </Checkbox>
              <Checkbox checked={ignoreWhitespace} onChange={setIgnoreWhitespace}>
                Ignore whitespace
              </Checkbox>
              <Checkbox checked={ignoreCase} onChange={setIgnoreCase}>
                Ignore case
              </Checkbox>
            </div>
            <Button size="sm" active={hideUnchanged} onClick={() => setHideUnchanged((h) => !h)}>
              Hide unchanged rows
            </Button>
            <Select
              label="Filter differences"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'all', label: 'Show all rows' },
                { value: 'changed', label: 'Only differences' },
                { value: 'added', label: 'Only added rows' },
                { value: 'removed', label: 'Only removed rows' },
                { value: 'modified', label: 'Only modified rows' },
              ]}
            />
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-panel px-1"
              role="group"
              aria-label="Difference navigation"
            >
              <IconButton
                label="Previous difference"
                onClick={() => nextDiff(-1)}
                disabled={!diffRows.length}
              >
                <ChevronUp size={17} />
              </IconButton>
              <span
                className="min-w-[3.5rem] text-center text-[13px] tabular-nums text-muted"
                aria-live="polite"
              >
                {diffRows.length
                  ? `${diffIdx < 0 ? '–' : diffIdx + 1} / ${diffRows.length}`
                  : '0 / 0'}
              </span>
              <IconButton
                label="Next difference"
                onClick={() => nextDiff(1)}
                disabled={!diffRows.length}
              >
                <ChevronDown size={17} />
              </IconButton>
            </div>
            <Button
              size="sm"
              icon={<Search size={15} aria-hidden />}
              active={searchOpen}
              onClick={() => setSearchOpen((s) => !s)}
            >
              Search
            </Button>
            <Menu
              align="right"
              trigger={(t) => (
                <Button size="sm" icon={<Download size={15} aria-hidden />} {...t}>
                  Download result
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      close()
                      exportCsv()
                    }}
                  >
                    CSV (.csv)
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      void exportXlsx()
                    }}
                  >
                    Excel (.xlsx)
                  </MenuItem>
                </>
              )}
            </Menu>
            {stats && (
              <div
                className="ml-auto flex flex-wrap items-center gap-1.5 text-[13px]"
                role="group"
                aria-label="Statistics"
              >
                <span className="rounded-md bg-[var(--add-bg)] px-2 py-1 font-medium text-add">
                  + Added rows: {stats.addedRows}
                </span>
                <span className="rounded-md bg-[var(--del-bg)] px-2 py-1 font-medium text-del">
                  − Removed rows: {stats.removedRows}
                </span>
                <span className="rounded-md bg-[var(--mod-bg)] px-2 py-1 font-medium text-mod">
                  ~ Modified rows: {stats.modifiedRows}
                </span>
                <span className="rounded-md bg-panel2 px-2 py-1 font-medium">
                  Cells changed: {stats.modifiedCells}
                </span>
                <span className="rounded-md bg-panel2 px-2 py-1 font-medium">
                  Cols +{stats.addedCols} / −{stats.removedCols}
                </span>
                <span className="rounded-md bg-panel2 px-2 py-1 text-muted">
                  Unchanged: {stats.unchangedRows}
                </span>
              </div>
            )}
          </div>

          {searchOpen && (
            <div
              className="flex items-center gap-2 rounded-xl border border-line bg-panel p-2"
              role="search"
            >
              <Search size={16} className="ml-1 text-muted" aria-hidden />
              <input
                autoFocus
                type="search"
                aria-label="Search in spreadsheet comparison"
                placeholder="Search cells…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') goMatch(e.shiftKey ? -1 : 1)
                  else if (e.key === 'Escape') setSearchOpen(false)
                }}
                className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <span className="text-[13px] tabular-nums text-muted" aria-live="polite">
                {query
                  ? matches.length
                    ? `${matchIdx + 1} of ${matches.length} matching ${matches.length === 1 ? 'row' : 'rows'}`
                    : 'No matches'
                  : ''}
              </span>
              <IconButton
                label="Previous match"
                onClick={() => goMatch(-1)}
                disabled={!matches.length}
              >
                <ChevronUp size={17} />
              </IconButton>
              <IconButton label="Next match" onClick={() => goMatch(1)} disabled={!matches.length}>
                <ChevronDown size={17} />
              </IconButton>
              <IconButton label="Close search" onClick={() => setSearchOpen(false)}>
                <X size={17} />
              </IconButton>
            </div>
          )}

          {noDiff && (
            <Notice kind="info">
              <span className="font-medium">No differences found.</span> Both worksheets match with
              the current options.
            </Notice>
          )}

          <div className="relative flex min-h-[20rem] flex-1 overflow-hidden rounded-xl border border-line bg-panel md:min-h-0">
            {loading && (
              <div className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs shadow">
                <Spinner size={12} /> Comparing…
              </div>
            )}
            <div
              ref={scrollRef}
              tabIndex={0}
              role="region"
              aria-label="Spreadsheet differences. Scroll horizontally for more columns."
              className="min-h-0 flex-1 overflow-auto text-[13px]"
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            >
              <div style={{ width: totalW, minWidth: '100%' }}>
                {/* Header */}
                <div
                  className="sticky top-0 z-20 flex border-b border-line bg-panel2 font-medium"
                  style={{ height: ROW_H }}
                >
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center border-r border-line bg-panel2 px-2 text-xs text-muted"
                    style={{ width: NUM_W }}
                  >
                    Row (old · new)
                  </div>
                  {columns.map((c, i) => (
                    <div
                      key={i}
                      className={`flex shrink-0 items-center gap-1 truncate border-r border-line px-2 ${c.status === 'added' ? 'bg-[var(--add-bg)] text-add' : c.status === 'removed' ? 'bg-[var(--del-bg)] text-del' : ''}`}
                      style={{ width: COL_W }}
                      title={`${c.label}${c.status === 'added' ? ' (added column)' : c.status === 'removed' ? ' (removed column)' : ''}`}
                    >
                      <span aria-hidden>
                        {c.status === 'added' ? '+' : c.status === 'removed' ? '−' : ''}
                      </span>
                      <span className="truncate">{c.label}</span>
                      {c.status !== 'same' && (
                        <span className="sr-only">
                          {c.status === 'added' ? 'added column' : 'removed column'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Body */}
                <div style={{ position: 'relative', height: rows.length * ROW_H }}>
                  {rows.length === 0 && (
                    <p className="p-6 text-center text-muted">
                      No rows to show with the current filters.
                    </p>
                  )}
                  {Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k).map(
                    (i) => {
                      const r = rows[i]
                      const tint =
                        r.kind === 'added'
                          ? 'bg-[var(--add-bg)]'
                          : r.kind === 'removed'
                            ? 'bg-[var(--del-bg)]'
                            : r.kind === 'modified'
                              ? 'bg-[var(--mod-bg)]'
                              : 'bg-panel'
                      const mark =
                        r.kind === 'added'
                          ? '+'
                          : r.kind === 'removed'
                            ? '−'
                            : r.kind === 'modified'
                              ? '~'
                              : ''
                      const label =
                        r.kind === 'added'
                          ? 'Added row'
                          : r.kind === 'removed'
                            ? 'Removed row'
                            : r.kind === 'modified'
                              ? 'Modified row'
                              : undefined
                      return (
                        <div
                          key={i}
                          className={`absolute left-0 flex border-b border-line/60 ${tint} ${diffIdx >= 0 && diffRows[diffIdx] === i ? 'ring-2 ring-inset ring-accent' : ''}`}
                          style={{ top: i * ROW_H, height: ROW_H, width: totalW }}
                        >
                          <div
                            className={`sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-line px-2 text-xs text-muted ${tint}`}
                            style={{ width: NUM_W }}
                          >
                            <span
                              className="w-3 text-center font-bold"
                              role="img"
                              aria-label={label}
                              aria-hidden={!label}
                            >
                              {mark}
                            </span>
                            <span className="tabular-nums">
                              {r.leftNo ?? '–'} · {r.rightNo ?? '–'}
                            </span>
                          </div>
                          {r.cells.map((c, ci) => (
                            <div
                              key={ci}
                              className={`flex shrink-0 items-center overflow-hidden border-r border-line/60 px-2 ${c.status === 'modified' ? 'bg-[var(--mod-strong)]/50' : c.status === 'added' && r.kind !== 'added' ? 'bg-[var(--add-bg)]' : c.status === 'removed' && r.kind !== 'removed' ? 'bg-[var(--del-bg)]' : ''}`}
                              style={{ width: COL_W }}
                            >
                              <CellView c={c} q={query} />
                            </div>
                          ))}
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
