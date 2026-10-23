import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  active?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
  secondary: 'bg-panel border border-line text-fg hover:bg-panel2',
  ghost: 'text-muted hover:text-fg hover:bg-panel2',
  danger: 'bg-panel border border-line text-del hover:bg-[var(--del-bg)]',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', icon, active, className = '', children, ...rest },
  ref,
) {
  const sz = size === 'sm' ? 'h-8 px-2.5 text-[13px] gap-1.5' : 'h-9 px-3.5 text-sm gap-2'
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${sz} ${
        active ? 'border border-accent/30 bg-accent-soft text-accent' : variants[variant]
      } ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

interface IconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

/** Icon-only button; `label` becomes the accessible name and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconProps>(function IconButton(
  { label, active, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-panel2 hover:text-fg'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})
