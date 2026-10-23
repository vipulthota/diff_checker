import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface TriggerProps {
  onClick: () => void
  'aria-haspopup': 'true'
  'aria-expanded': boolean
  'aria-controls': string
}

interface Props {
  trigger: (props: TriggerProps) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: string
}

/** Click-to-open popover. Closes on outside click and Escape. */
export function Menu({ trigger, children, align = 'left', width = 'w-64' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {trigger({
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'true',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      {open && (
        <div
          id={id}
          className={`animate-in absolute z-30 mt-1.5 ${width} ${
            align === 'right' ? 'right-0' : 'left-0'
          } rounded-xl border border-line bg-panel p-1.5 shadow-xl`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  icon,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-panel2 disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  )
}
