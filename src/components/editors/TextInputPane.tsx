import { useMemo, useRef } from 'react'
import { ClipboardPaste, Copy, FileUp, Trash2 } from 'lucide-react'
import { Dropzone, FilePicker } from '../file-dropzone/Dropzone'
import { IconButton } from '../ui/Button'
import { countChars } from '../../features/text-diff/TextDiffEngine'
import { formatBytes } from '../../utils/format'

interface Props {
  side: 'original' | 'modified'
  value: string
  onChange: (v: string) => void
  onFiles: (files: File[]) => void
  onClear: () => void
  onCopy: () => void
  onPaste: () => void
  fileName: string | null
  fileSize: number | null
  wrap: boolean
  fontSize: number
  accept?: string
  placeholder?: string
  className?: string
}

/** A plain textarea with a line-number gutter, drag & drop and a small toolbar. */
export function TextInputPane(p: Props) {
  const gutterRef = useRef<HTMLPreElement>(null)
  const title = p.side === 'original' ? 'Original' : 'Modified'
  const stats = useMemo(() => countChars(p.value), [p.value])
  const lineH = Math.round(p.fontSize * 1.65)
  // Soft-wrapping multi-megabyte text makes the browser's textarea layout very slow.
  const wrap = p.wrap && p.value.length < 400_000
  const showGutter = !wrap

  const numbers = useMemo(() => {
    if (!showGutter) return ''
    const n = Math.max(stats.lines, 1)
    let s = '1'
    for (let i = 2; i <= n; i++) s += '\n' + i
    return s
  }, [stats.lines, showGutter])

  return (
    <Dropzone
      onFiles={p.onFiles}
      className={`flex min-h-0 flex-col rounded-xl border border-line bg-panel ${p.className ?? ''}`}
      label={`Drop file as ${title}`}
    >
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-1.5">
        <h2 className="mr-auto min-w-0 truncate text-sm font-semibold">
          {title}
          {p.fileName && (
            <span className="ml-2 font-normal text-muted" title={p.fileName}>
              {p.fileName}
              {p.fileSize !== null && ` · ${formatBytes(p.fileSize)}`}
            </span>
          )}
        </h2>
        <FilePicker
          onFiles={p.onFiles}
          accept={p.accept}
          label="Upload"
          variant="ghost"
          icon={<FileUp size={15} aria-hidden />}
        />
        <IconButton label={`Paste into ${title}`} onClick={p.onPaste}>
          <ClipboardPaste size={16} />
        </IconButton>
        <IconButton label={`Copy ${title}`} onClick={p.onCopy} disabled={!p.value}>
          <Copy size={16} />
        </IconButton>
        <IconButton label={`Clear ${title}`} onClick={p.onClear} disabled={!p.value && !p.fileName}>
          <Trash2 size={16} />
        </IconButton>
      </div>
      <div className="relative flex min-h-0 flex-1">
        {showGutter && (
          <pre
            ref={gutterRef}
            aria-hidden
            className="diff-font m-0 w-12 shrink-0 select-none overflow-hidden border-r border-line bg-panel2 py-2 pr-2 text-right text-muted"
            style={
              {
                '--diff-font-size': `${p.fontSize}px`,
                '--diff-row-height': `${lineH}px`,
              } as React.CSSProperties
            }
          >
            {numbers}
          </pre>
        )}
        <textarea
          aria-label={`${title} text`}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap={wrap ? 'soft' : 'off'}
          placeholder={
            p.placeholder ?? `Paste or type the ${title.toLowerCase()} text here, or drop a file…`
          }
          className="diff-font min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-fg outline-none placeholder:text-muted/70"
          style={
            {
              '--diff-font-size': `${p.fontSize}px`,
              '--diff-row-height': `${lineH}px`,
            } as React.CSSProperties
          }
        />
      </div>
      <div className="flex items-center gap-3 border-t border-line px-3 py-1 text-xs text-muted">
        <span>{stats.lines.toLocaleString()} lines</span>
        <span>{stats.words.toLocaleString()} words</span>
        <span>{stats.chars.toLocaleString()} chars</span>
      </div>
    </Dropzone>
  )
}
