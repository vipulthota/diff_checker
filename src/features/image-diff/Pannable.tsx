import { useEffect, useRef, type ReactNode } from 'react'

export interface View {
  zoom: number
  x: number
  y: number
}

interface Props {
  view: View
  onView: (v: View) => void
  onSize?: (w: number, h: number) => void
  label: string
  children: ReactNode
  className?: string
}

export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 32

export function zoomAround(v: View, nextZoom: number, cx: number, cy: number): View {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
  const k = z / v.zoom
  return { zoom: z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
}

/** A viewport that supports drag-to-pan and wheel-to-zoom around the cursor. */
export function Pannable({ view, onView, onSize, label, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const onViewRef = useRef(onView)
  onViewRef.current = onView

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => onSize?.(el.clientWidth, el.clientHeight))
    ro.observe(el)
    onSize?.(el.clientWidth, el.clientHeight)
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0015)
      onViewRef.current(
        zoomAround(
          viewRef.current,
          viewRef.current.zoom * factor,
          e.clientX - r.left,
          e.clientY - r.top,
        ),
      )
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', wheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={label}
      className={`relative cursor-grab overflow-hidden bg-[repeating-conic-gradient(var(--panel-2)_0%_25%,var(--panel)_0%_50%)] [background-size:16px_16px] active:cursor-grabbing ${className}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        ref.current?.setPointerCapture(e.pointerId)
        drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        onView({ ...viewRef.current, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py })
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const step = 40
        const v = viewRef.current
        if (e.key === 'ArrowLeft') onView({ ...v, x: v.x + step })
        else if (e.key === 'ArrowRight') onView({ ...v, x: v.x - step })
        else if (e.key === 'ArrowUp') onView({ ...v, y: v.y + step })
        else if (e.key === 'ArrowDown') onView({ ...v, y: v.y - step })
        else return
        e.preventDefault()
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
