import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeftRight,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  Download,
  FileText,
  GitMerge,
  Loader2,
  Pencil,
  Play,
  Search,
  WrapText,
  X,
  Filter,
  Rows3,
  Columns2,
  Share,
  Copy,
  FileDown,
  Replace,
  BookOpen,
} from 'lucide-react'
import { DiffViewer } from '../../components/diff-viewer/DiffViewer'
import { TextInputPane } from '../../components/editors/TextInputPane'
import { Button, IconButton } from '../../components/ui/Button'
import { Checkbox, Notice, Segmented, Select, Spinner } from '../../components/ui/Controls'
import { Menu, MenuItem } from '../../components/ui/Menu'
import { useHotkeys } from '../../hooks/useHotkeys'
import { useTextDiff } from '../../hooks/useTextDiff'
import { friendlyError, readTextFile, type LoadedText } from '../../lib/files'
import { LANGUAGES } from '../../lib/languages'
import { detectLanguage, highlightCode } from '../code-diff/CodeDiffEngine'
import { usePrefs } from '../../lib/prefs'
import { loadLanguage } from '../../lib/prism'
import { useUi } from '../../lib/ui-context'
import {
  DEFAULT_IGNORE,
  type DiffGranularity,
  type IgnoreOptions,
  type MergeChoice,
  type TextDiffOptions,
} from '../../types/diff'
import { copyText, downloadText } from '../../utils/download'
import { exportDiffPdf } from '../../lib/exportPdf'
import { buildDisplayModel, findMatches, type ViewMode } from './displayModel'
import { allChoices, buildMerged, type MergeChoices } from './merge'
import { toUnifiedDiff } from './TextDiffEngine'

export type WorkspaceMode = 'text' | 'code' | 'document'

export interface TextWorkspaceProps {
  mode: WorkspaceMode
  title: string
  subtitle: string
  loadFile?: (file: File) => Promise<LoadedText>
  accept?: string
  banner?: ReactNode
  sample: { left: string; right: string }
  fileStem: string
}

interface Meta {
  name: string
  size: number
  pageStarts?: number[]
}

const GRANULARITY: { value: DiffGranularity; label: string; title: string }[] = [
  { value: 'smart', label: 'Smart', title: 'Words by default, characters for small edits' },
  { value: 'lines', label: 'Line', title: 'Highlight whole changed lines' },
  { value: 'words', label: 'Word', title: 'Highlight changed words inside lines' },
  { value: 'chars', label: 'Char', title: 'Highlight changed characters inside lines' },
]

const IGNORE_LABELS: { key: keyof IgnoreOptions; label: string; hint: string }[] = [
  {
    key: 'whitespace',
    label: 'Ignore whitespace',
    hint: 'Spaces, tabs and other whitespace are not compared',
  },
  { key: 'blankLines', label: 'Ignore blank lines', hint: 'Empty lines are skipped' },
  { key: 'case', label: 'Ignore case', hint: 'A and a are treated as equal' },
  {
    key: 'punctuation',
    label: 'Ignore punctuation',
    hint: 'Punctuation and symbols are not compared',
  },
  { key: 'lineEndings', label: 'Ignore line endings', hint: 'CRLF and LF are treated as equal' },
  {
    key: 'trimLines',
    label: 'Ignore leading/trailing spaces',
    hint: 'Each line is trimmed before comparing',
  },
]

function pageOf(starts: number[] | undefined, lineNo: number | null): number | null {
  if (!starts || !starts.length || lineNo === null) return null
  let lo = 0
  let hi = starts.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= lineNo - 1) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans >= 0 ? ans + 1 : null
}

export function TextWorkspace(props: TextWorkspaceProps) {
  const { mode } = props
  const { prefs } = usePrefs()
  const { toast } = useUi()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [leftMeta, setLeftMeta] = useState<Meta | null>(null)
  const [rightMeta, setRightMeta] = useState<Meta | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [stage, setStage] = useState<'edit' | 'diff'>('edit')
  // Narrow screens start with the unified view because two side-by-side panes would be too small.
  const [view, setView] = useState<ViewMode>(() =>
    typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches
      ? 'unified'
      : 'split',
  )
  const [wrap, setWrap] = useState(mode === 'code' ? false : prefs.wrap)
  const [granularity, setGranularity] = useState<DiffGranularity>(prefs.granularity)
  const [ignore, setIgnore] = useState<IgnoreOptions>(DEFAULT_IGNORE)
  const [hide, setHide] = useState(false)
  const [language, setLanguage] = useState('plain')

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [currentMatch, setCurrentMatch] = useState(0)

  // Navigation
  const [currentHunk, setCurrentHunk] = useState(-1)
  const [reveal, setReveal] = useState<{ item: number; nonce: number } | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // Merge
  const [mergeOpen, setMergeOpen] = useState(false)
  const [choices, setChoicesState] = useState<MergeChoices>({})
  const [past, setPast] = useState<MergeChoices[]>([])
  const [future, setFuture] = useState<MergeChoices[]>([])
  const [override, setOverride] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'code') setWrap(prefs.wrap)
  }, [prefs.wrap, mode])
  useEffect(() => setGranularity(prefs.granularity), [prefs.granularity])

  const options = useMemo<TextDiffOptions>(() => ({ granularity, ignore }), [granularity, ignore])
  const { result, source, loading, error, flush } = useTextDiff(left, right, options)
  const stats = result.stats

  // Reset per-result state when the result changes.
  useEffect(() => {
    setCurrentHunk(-1)
    setExpanded(new Set())
    setChoicesState({})
    setPast([])
    setFuture([])
    setOverride(null)
  }, [result])

  const searching = searchOpen && query !== ''
  const model = useMemo(
    () => buildDisplayModel(result, view, hide && !searching, expanded),
    [result, view, hide, searching, expanded],
  )
  const matches = useMemo(
    () => (searching ? findMatches(model.items, query, caseSensitive) : []),
    [searching, model.items, query, caseSensitive],
  )
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  const revealItem = useCallback((item: number) => {
    setReveal((r) => ({ item, nonce: (r?.nonce ?? 0) + 1 }))
  }, [])

  // Syntax highlighting (code mode)
  const [readyLang, setReadyLang] = useState('plain')
  useEffect(() => {
    if (mode !== 'code' || language === 'plain') return
    let cancelled = false
    loadLanguage(language).then(() => !cancelled && setReadyLang(language))
    return () => {
      cancelled = true
    }
  }, [language, mode])
  const highlight = mode === 'code' && language !== 'plain' && readyLang === language
  const leftRuns = useMemo(
    () => (highlight ? highlightCode(source.left, language) : null),
    [highlight, source.left, language],
  )
  const rightRuns = useMemo(
    () => (highlight ? highlightCode(source.right, language) : null),
    [highlight, source.right, language],
  )

  /* ----------------------------- file handling ---------------------------- */

  const loadInto = useCallback(
    async (side: 'left' | 'right', file: File) => {
      try {
        const loaded = await (props.loadFile ?? readTextFile)(file)
        const meta: Meta = { name: loaded.name, size: loaded.size, pageStarts: loaded.pageStarts }
        if (side === 'left') {
          setLeft(loaded.text)
          setLeftMeta(meta)
        } else {
          setRight(loaded.text)
          setRightMeta(meta)
        }
        const msgs = [loaded.warning, loaded.note].filter(Boolean) as string[]
        if (msgs.length) setNotes((n) => [...new Set([...n, ...msgs])])
        if (loaded.warning) toast(loaded.warning, 'info')
        if (mode === 'code') {
          const l = detectLanguage(loaded.name)
          if (l) setLanguage(l.id)
        }
        if (loaded.text === '') toast(`"${loaded.name}" is empty.`, 'info')
      } catch (e) {
        toast(
          friendlyError(e, `Unable to read "${file.name}". It may be corrupted or unsupported.`),
          'error',
        )
      }
    },
    [props.loadFile, mode, toast],
  )

  const onFiles = useCallback(
    (side: 'left' | 'right') => (files: File[]) => {
      if (files.length >= 2) {
        void loadInto('left', files[0])
        void loadInto('right', files[1])
      } else void loadInto(side, files[0])
    },
    [loadInto],
  )

  const clearSide = (side: 'left' | 'right') => {
    const prev = side === 'left' ? { text: left, meta: leftMeta } : { text: right, meta: rightMeta }
    if (side === 'left') {
      setLeft('')
      setLeftMeta(null)
    } else {
      setRight('')
      setRightMeta(null)
    }
    if (prev.text)
      toast(`Cleared ${side === 'left' ? 'Original' : 'Modified'}.`, 'info', {
        label: 'Undo',
        run: () => {
          if (side === 'left') {
            setLeft(prev.text)
            setLeftMeta(prev.meta)
          } else {
            setRight(prev.text)
            setRightMeta(prev.meta)
          }
        },
      })
  }

  const clearAll = () => {
    setLeft('')
    setRight('')
    setLeftMeta(null)
    setRightMeta(null)
    setNotes([])
    setStage('edit')
    setQuery('')
    setSearchOpen(false)
  }

  const paste = async (side: 'left' | 'right') => {
    try {
      const t = await navigator.clipboard.readText()
      if (side === 'left') {
        setLeft(t)
        setLeftMeta(null)
      } else {
        setRight(t)
        setRightMeta(null)
      }
    } catch {
      toast(
        'Clipboard access was blocked by the browser. Paste with Ctrl/Cmd + V instead.',
        'error',
      )
    }
  }

  const copySide = async (text: string, label: string) =>
    toast((await copyText(text)) ? `${label} copied.` : 'Unable to copy to the clipboard.', 'info')

  const swap = () => {
    setLeft(right)
    setRight(left)
    setLeftMeta(rightMeta)
    setRightMeta(leftMeta)
  }

  /* ------------------------------ navigation ------------------------------ */

  const hunks = stats.differences
  const goHunk = useCallback(
    (h: number) => {
      if (hunks === 0) return
      const idx = ((h % hunks) + hunks) % hunks
      setCurrentHunk(idx)
      const item = model.hunkItem[idx]
      if (item !== undefined) revealItem(item)
    },
    [hunks, model.hunkItem, revealItem],
  )
  const nextHunk = () => goHunk(currentHunk < 0 ? 0 : currentHunk + 1)
  const prevHunk = () => goHunk(currentHunk < 0 ? hunks - 1 : currentHunk - 1)

  const goMatch = useCallback(
    (i: number) => {
      const list = matchesRef.current
      if (!list.length) return
      const idx = ((i % list.length) + list.length) % list.length
      setCurrentMatch(idx)
      revealItem(list[idx].item)
    },
    [revealItem],
  )

  // New query → jump to the first match.
  useEffect(() => {
    setCurrentMatch(0)
    if (query && matchesRef.current.length) revealItem(matchesRef.current[0].item)
  }, [query, caseSensitive, revealItem])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    }, 0)
  }, [])

  /* -------------------------------- merging ------------------------------- */

  const applyChoices = (next: MergeChoices) => {
    setPast((p) => [...p.slice(-49), choices])
    setFuture([])
    setChoicesState(next)
    setOverride(null)
  }
  const choose = (h: number, side: MergeChoice) => {
    setMergeOpen(true)
    applyChoices({ ...choices, [h]: side })
  }
  const undoMerge = () => {
    const prev = past[past.length - 1]
    if (!prev) return
    setFuture((f) => [choices, ...f])
    setPast(past.slice(0, -1))
    setChoicesState(prev)
    setOverride(null)
  }
  const redoMerge = () => {
    const next = future[0]
    if (!next) return
    setPast((p) => [...p, choices])
    setFuture(future.slice(1))
    setChoicesState(next)
    setOverride(null)
  }
  const merged = useMemo(
    () => override ?? buildMerged(result, choices),
    [override, result, choices],
  )
  const resolved = Object.values(choices).filter(Boolean).length

  /* -------------------------------- shortcuts ----------------------------- */

  const inWorkspaceOrIdle = (e: KeyboardEvent) => {
    const t = e.target as Node | null
    return !t || t === document.body || !!rootRef.current?.contains(t)
  }
  const inField = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')
  }

  const compare = useCallback(() => {
    if (!left && !right) {
      toast('Add some text to both sides first.', 'info')
      return
    }
    flush()
    setStage('diff')
  }, [left, right, flush, toast])

  useHotkeys([
    { combo: 'mod+enter', handler: compare, when: inWorkspaceOrIdle },
    {
      combo: 'mod+f',
      handler: openSearch,
      when: (e) => stage === 'diff' && inWorkspaceOrIdle(e),
    },
    { combo: 'alt+arrowdown', handler: () => nextHunk(), when: () => stage === 'diff' },
    { combo: 'alt+arrowup', handler: () => prevHunk(), when: () => stage === 'diff' },
    {
      combo: 'escape',
      handler: () => setSearchOpen(false),
      when: () => searchOpen && !document.querySelector('[role="dialog"]'),
    },
    {
      combo: 'mod+z',
      handler: undoMerge,
      when: (e) => stage === 'diff' && mergeOpen && !inField(e),
    },
    {
      combo: 'mod+shift+z',
      handler: redoMerge,
      when: (e) => stage === 'diff' && mergeOpen && !inField(e),
    },
    {
      combo: 'mod+y',
      handler: redoMerge,
      when: (e) => stage === 'diff' && mergeOpen && !inField(e),
    },
  ])

  /* -------------------------------- exports ------------------------------- */

  const unified = useMemo(
    () => toUnifiedDiff(result, leftMeta?.name ?? 'original', rightMeta?.name ?? 'modified'),
    [result, leftMeta, rightMeta],
  )
  const pdf = async () => {
    try {
      await exportDiffPdf({
        title: `DiffSpace — ${props.title}`,
        subtitle: `${leftMeta?.name ?? 'Original'}  vs  ${rightMeta?.name ?? 'Modified'}  ·  ${stats.differences} differences (+${stats.added} / -${stats.removed} / ~${stats.modified})`,
        unifiedDiff: unified,
        filename: `${props.fileStem}.pdf`,
      })
    } catch {
      toast('Unable to create the PDF in this browser.', 'error')
    }
  }

  /* --------------------------------- pages -------------------------------- */

  const pageList = useMemo(() => {
    if (!leftMeta?.pageStarts && !rightMeta?.pageStarts) return []
    const byPage = new Map<number, number[]>()
    for (let h = 0; h < result.hunkStarts.length; h++) {
      const row = result.rows[result.hunkStarts[h]]
      const page =
        pageOf(leftMeta?.pageStarts, row.leftNo) ?? pageOf(rightMeta?.pageStarts, row.rightNo) ?? 0
      byPage.set(page, [...(byPage.get(page) ?? []), h])
    }
    return [...byPage.entries()].sort((a, b) => a[0] - b[0])
  }, [leftMeta, rightMeta, result])
  const hasPages = !!(leftMeta?.pageStarts || rightMeta?.pageStarts)
  const currentPage = useMemo(() => {
    if (currentHunk < 0 || !hasPages) return null
    const row = result.rows[result.hunkStarts[currentHunk]]
    return pageOf(leftMeta?.pageStarts, row.leftNo) ?? pageOf(rightMeta?.pageStarts, row.rightNo)
  }, [currentHunk, hasPages, result, leftMeta, rightMeta])

  /* --------------------------------- render ------------------------------- */

  const anyIgnore = (Object.keys(ignore) as (keyof IgnoreOptions)[]).filter(
    (k) => ignore[k] !== DEFAULT_IGNORE[k],
  ).length
  const hasContent = left !== '' || right !== ''
  const identical = hasContent && left !== '' && right !== '' && stats.differences === 0 && !loading

  const optionsBar = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Comparison granularity"
        value={granularity}
        onChange={setGranularity}
        options={GRANULARITY}
      />
      <Menu
        trigger={(t) => (
          <Button size="sm" icon={<Filter size={15} aria-hidden />} {...t} active={anyIgnore > 0}>
            Ignore{anyIgnore > 0 && ` (${anyIgnore})`}
          </Button>
        )}
      >
        {() => (
          <div role="group" aria-label="Ignore options">
            {IGNORE_LABELS.map((o) => (
              <Checkbox
                key={o.key}
                checked={ignore[o.key]}
                hint={o.hint}
                onChange={(v) => setIgnore((s) => ({ ...s, [o.key]: v }))}
              >
                {o.label}
              </Checkbox>
            ))}
            <button
              type="button"
              className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-accent hover:bg-panel2"
              onClick={() => setIgnore(DEFAULT_IGNORE)}
            >
              Reset to defaults
            </button>
          </div>
        )}
      </Menu>
      <Button
        size="sm"
        icon={<WrapText size={15} aria-hidden />}
        active={wrap}
        onClick={() => setWrap((w) => !w)}
      >
        Wrap
      </Button>
      {mode === 'code' && (
        <Select
          label="Language"
          value={language}
          onChange={setLanguage}
          options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
        />
      )}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className="mx-auto flex min-h-[calc(100dvh-5.25rem)] w-full max-w-[1800px] flex-col gap-3 p-3 md:h-[calc(100dvh-5.25rem)] md:p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold leading-tight">{props.title}</h1>
          <p className="text-[13px] text-muted">{props.subtitle}</p>
        </div>
        {stage === 'edit' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<ArrowLeftRight size={15} aria-hidden />}
              onClick={swap}
              disabled={!hasContent}
            >
              Swap
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setLeft(props.sample.left)
                setRight(props.sample.right)
                setLeftMeta(null)
                setRightMeta(null)
                if (mode === 'code') setLanguage('javascript')
              }}
            >
              Load example
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll} disabled={!hasContent}>
              Clear all
            </Button>
            <Button
              variant="primary"
              icon={<Play size={15} aria-hidden />}
              onClick={compare}
              title="Compare (Ctrl/Cmd + Enter)"
            >
              Compare
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<Pencil size={15} aria-hidden />}
              onClick={() => setStage('edit')}
            >
              Edit inputs
            </Button>
            <Button size="sm" icon={<ArrowLeftRight size={15} aria-hidden />} onClick={swap}>
              Swap sides
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>
              New comparison
            </Button>
          </div>
        )}
      </div>

      {props.banner}
      {notes.length > 0 && (
        <Notice kind="warn">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </Notice>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {result.approximate && stage === 'diff' && (
        <Notice kind="warn">
          These inputs are very different, so the line alignment is approximate: the changed section
          is shown as a full replacement.
        </Notice>
      )}

      {optionsBar}

      {stage === 'edit' ? (
        <>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <TextInputPane
              side="original"
              value={left}
              onChange={(v) => {
                setLeft(v)
                if (leftMeta) setLeftMeta(null)
              }}
              onFiles={onFiles('left')}
              onClear={() => clearSide('left')}
              onCopy={() => copySide(left, 'Original')}
              onPaste={() => paste('left')}
              fileName={leftMeta?.name ?? null}
              fileSize={leftMeta?.size ?? null}
              wrap={wrap}
              fontSize={prefs.fontSize}
              accept={props.accept}
              className="min-h-[18rem]"
            />
            <TextInputPane
              side="modified"
              value={right}
              onChange={(v) => {
                setRight(v)
                if (rightMeta) setRightMeta(null)
              }}
              onFiles={onFiles('right')}
              onClear={() => clearSide('right')}
              onCopy={() => copySide(right, 'Modified')}
              onPaste={() => paste('right')}
              fileName={rightMeta?.name ?? null}
              fileSize={rightMeta?.size ?? null}
              wrap={wrap}
              fontSize={prefs.fontSize}
              accept={props.accept}
              className="min-h-[18rem]"
            />
          </div>
          <div
            className="flex flex-wrap items-center gap-3 text-[13px] text-muted"
            aria-live="polite"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={14} /> Comparing…
              </span>
            ) : hasContent ? (
              <span>
                Live result:{' '}
                <strong className="text-fg">{stats.differences.toLocaleString()}</strong>{' '}
                {stats.differences === 1 ? 'difference' : 'differences'} · press Compare (Ctrl/Cmd +
                Enter) to view them.
              </span>
            ) : (
              <span>
                Paste text on both sides or drop files onto either panel. Drop two files at once to
                fill both sides.
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="View mode"
              value={view}
              onChange={setView}
              options={[
                {
                  value: 'split',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Columns2 size={14} aria-hidden />
                      Side by side
                    </span>
                  ),
                },
                {
                  value: 'unified',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Rows3 size={14} aria-hidden />
                      Unified
                    </span>
                  ),
                },
              ]}
            />
            <Button
              size="sm"
              icon={<ChevronsDownUp size={15} aria-hidden />}
              active={hide}
              onClick={() => setHide((h) => !h)}
              title={hide ? 'Show unchanged lines' : 'Hide unchanged lines'}
            >
              {hide ? 'Show unchanged' : 'Hide unchanged'}
            </Button>

            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-panel px-1"
              role="group"
              aria-label="Difference navigation"
            >
              <IconButton label="First difference" onClick={() => goHunk(0)} disabled={!hunks}>
                <ArrowUpToLine size={16} />
              </IconButton>
              <IconButton
                label="Previous difference (Alt + ↑)"
                onClick={prevHunk}
                disabled={!hunks}
              >
                <ChevronUp size={17} />
              </IconButton>
              <span
                className="min-w-[4.5rem] text-center text-[13px] tabular-nums text-muted"
                aria-live="polite"
              >
                {hunks ? `${currentHunk < 0 ? '–' : currentHunk + 1} / ${hunks}` : '0 / 0'}
                {currentPage ? ` · p.${currentPage}` : ''}
              </span>
              <IconButton label="Next difference (Alt + ↓)" onClick={nextHunk} disabled={!hunks}>
                <ChevronDown size={17} />
              </IconButton>
              <IconButton
                label="Last difference"
                onClick={() => goHunk(hunks - 1)}
                disabled={!hunks}
              >
                <ArrowDownToLine size={16} />
              </IconButton>
            </div>

            {hasPages && pageList.length > 0 && (
              <Menu
                trigger={(t) => (
                  <Button size="sm" icon={<BookOpen size={15} aria-hidden />} {...t}>
                    Pages
                  </Button>
                )}
                width="w-56"
              >
                {(close) => (
                  <div className="max-h-72 overflow-y-auto">
                    {pageList.map(([page, hs]) => (
                      <MenuItem
                        key={page}
                        onClick={() => {
                          goHunk(hs[0])
                          close()
                        }}
                      >
                        {page ? `Page ${page}` : 'Unknown page'} · {hs.length}{' '}
                        {hs.length === 1 ? 'difference' : 'differences'}
                      </MenuItem>
                    ))}
                  </div>
                )}
              </Menu>
            )}

            <Button
              size="sm"
              icon={<Search size={15} aria-hidden />}
              active={searchOpen}
              onClick={() => (searchOpen ? setSearchOpen(false) : openSearch())}
              title="Search (Ctrl/Cmd + F)"
            >
              Search
            </Button>
            <Button
              size="sm"
              icon={<GitMerge size={15} aria-hidden />}
              active={mergeOpen}
              onClick={() => setMergeOpen((m) => !m)}
            >
              Merge
            </Button>
            <Menu
              align="right"
              trigger={(t) => (
                <Button size="sm" icon={<Share size={15} aria-hidden />} {...t}>
                  Export
                </Button>
              )}
              width="w-64"
            >
              {(close) => (
                <>
                  <MenuItem
                    icon={<Copy size={15} />}
                    onClick={async () => {
                      close()
                      toast(
                        (await copyText(unified)) ? 'Unified diff copied.' : 'Unable to copy.',
                        'info',
                      )
                    }}
                    disabled={!unified}
                  >
                    Copy unified diff
                  </MenuItem>
                  <MenuItem
                    icon={<Download size={15} />}
                    onClick={() => {
                      close()
                      downloadText(unified, `${props.fileStem}.diff`)
                    }}
                    disabled={!unified}
                  >
                    Download diff (.diff)
                  </MenuItem>
                  <MenuItem
                    icon={<FileDown size={15} />}
                    onClick={() => {
                      close()
                      void pdf()
                    }}
                  >
                    Export as PDF
                  </MenuItem>
                  <MenuItem
                    icon={<Copy size={15} />}
                    onClick={async () => {
                      close()
                      toast(
                        (await copyText(merged)) ? 'Merged text copied.' : 'Unable to copy.',
                        'info',
                      )
                    }}
                  >
                    Copy merged result
                  </MenuItem>
                  <MenuItem
                    icon={<Download size={15} />}
                    onClick={() => {
                      close()
                      downloadText(merged, `${props.fileStem}-merged.txt`)
                    }}
                  >
                    Download merged text
                  </MenuItem>
                </>
              )}
            </Menu>

            <div
              className="ml-auto flex flex-wrap items-center gap-1.5 text-[13px]"
              aria-label="Statistics"
              role="group"
            >
              <span className="rounded-md bg-panel2 px-2 py-1 font-medium">
                Differences: {stats.differences.toLocaleString()}
              </span>
              <span className="rounded-md bg-[var(--add-bg)] px-2 py-1 font-medium text-add">
                + Added: {stats.added.toLocaleString()}
              </span>
              <span className="rounded-md bg-[var(--del-bg)] px-2 py-1 font-medium text-del">
                − Removed: {stats.removed.toLocaleString()}
              </span>
              <span className="rounded-md bg-[var(--mod-bg)] px-2 py-1 font-medium text-mod">
                ~ Modified: {stats.modified.toLocaleString()}
              </span>
              <span className="rounded-md bg-panel2 px-2 py-1 text-muted">
                Unchanged: {stats.unchanged.toLocaleString()}
              </span>
            </div>
          </div>

          {searchOpen && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-2"
              role="search"
            >
              <Search size={16} className="ml-1 text-muted" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                aria-label="Search in comparison"
                placeholder="Search in comparison…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    goMatch(currentMatch + (e.shiftKey ? -1 : 1))
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setSearchOpen(false)
                  }
                }}
                className="h-8 min-w-[10rem] flex-1 bg-transparent text-sm outline-none"
              />
              <span className="text-[13px] tabular-nums text-muted" aria-live="polite">
                {query === ''
                  ? ''
                  : matches.length === 0
                    ? 'No matches'
                    : `${currentMatch + 1} of ${matches.length.toLocaleString()} ${matches.length === 1 ? 'match' : 'matches'}`}
              </span>
              <Button
                size="sm"
                active={caseSensitive}
                onClick={() => setCaseSensitive((c) => !c)}
                title="Match case"
              >
                Aa
              </Button>
              <IconButton
                label="Previous match (Shift + Enter)"
                onClick={() => goMatch(currentMatch - 1)}
                disabled={!matches.length}
              >
                <ChevronUp size={17} />
              </IconButton>
              <IconButton
                label="Next match (Enter)"
                onClick={() => goMatch(currentMatch + 1)}
                disabled={!matches.length}
              >
                <ChevronDown size={17} />
              </IconButton>
              <IconButton label="Close search" onClick={() => setSearchOpen(false)}>
                <X size={17} />
              </IconButton>
            </div>
          )}

          {identical && (
            <Notice kind="info">
              <span className="font-medium">No differences found.</span>{' '}
              {anyIgnore > 0
                ? 'Both sides are identical with the current ignore options.'
                : 'Both sides are identical.'}
            </Notice>
          )}

          <div className="relative flex min-h-[20rem] flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel md:min-h-0">
            {loading && (
              <div className="absolute right-3 top-9 z-20 flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs shadow">
                <Loader2 size={14} className="animate-spin text-accent" aria-hidden /> Updating…
              </div>
            )}
            {!hasContent ? (
              <div className="m-auto flex flex-col items-center gap-3 p-8 text-center text-muted">
                <FileText size={34} aria-hidden />
                <p>Nothing to compare yet.</p>
                <Button size="sm" onClick={() => setStage('edit')}>
                  Add text
                </Button>
              </div>
            ) : (
              <DiffViewer
                items={model.items}
                hunkItem={model.hunkItem}
                view={view}
                wrap={wrap}
                fontSize={prefs.fontSize}
                leftRuns={leftRuns}
                rightRuns={rightRuns}
                matches={matches}
                currentMatch={currentMatch}
                currentHunk={currentHunk}
                reveal={reveal}
                onExpandFold={(id) => setExpanded((s) => new Set(s).add(id))}
                merge={{ choices, onChoose: choose }}
                onCopy={(side) =>
                  copySide(source[side], side === 'left' ? 'Old version' : 'New version')
                }
                leftLabel={leftMeta?.name ?? 'Original'}
                rightLabel={rightMeta?.name ?? 'Modified'}
              />
            )}
          </div>

          {mergeOpen && (
            <section
              aria-label="Merged result"
              className="flex h-60 shrink-0 flex-col rounded-xl border border-line bg-panel"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <h2 className="mr-auto text-sm font-semibold">
                  Merged result{' '}
                  <span className="font-normal text-muted">
                    · {resolved} of {hunks} differences resolved (unresolved keep the original)
                  </span>
                </h2>
                <Button
                  size="sm"
                  onClick={() => applyChoices(allChoices(result, 'left'))}
                  disabled={!hunks}
                >
                  Accept all left
                </Button>
                <Button
                  size="sm"
                  onClick={() => applyChoices(allChoices(result, 'right'))}
                  disabled={!hunks}
                >
                  Accept all right
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Replace size={14} aria-hidden />}
                  onClick={() => applyChoices({})}
                  disabled={!resolved && override === null}
                >
                  Reset
                </Button>
                <IconButton
                  label="Copy merged result"
                  onClick={async () =>
                    toast(
                      (await copyText(merged)) ? 'Merged text copied.' : 'Unable to copy.',
                      'info',
                    )
                  }
                >
                  <Copy size={16} />
                </IconButton>
                <IconButton
                  label="Download merged text"
                  onClick={() => downloadText(merged, `${props.fileStem}-merged.txt`)}
                >
                  <Download size={16} />
                </IconButton>
              </div>
              <textarea
                aria-label="Merged result (editable)"
                value={merged}
                onChange={(e) => setOverride(e.target.value)}
                spellCheck={false}
                wrap={wrap ? 'soft' : 'off'}
                className="diff-font min-h-0 flex-1 resize-none bg-transparent px-3 py-2 outline-none"
                style={
                  {
                    '--diff-font-size': `${prefs.fontSize}px`,
                    '--diff-row-height': `${Math.round(prefs.fontSize * 1.65)}px`,
                  } as React.CSSProperties
                }
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
