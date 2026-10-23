import type { ReactNode } from 'react'

export function Checkbox({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  hint?: string
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-panel2"
      title={hint}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
      />
      <span>{children}</span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg border border-line bg-panel2 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
            value === o.value ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
  className?: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-lg border border-line bg-panel px-2 text-[13px] text-fg ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-accent/30 border-t-accent"
    />
  )
}

export function Notice({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warn' | 'error'
  children: ReactNode
}) {
  const cls =
    kind === 'error'
      ? 'bg-[var(--del-bg)] text-del border-[var(--del-strong)]'
      : kind === 'warn'
        ? 'bg-[var(--mod-bg)] text-mod border-[var(--mod-strong)]'
        : 'bg-accent-soft text-fg border-accent/20'
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-[13px] ${cls}`}
    >
      {children}
    </div>
  )
}
