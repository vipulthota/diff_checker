import { useEffect, useRef } from 'react'

export interface Hotkey {
  /** e.g. "mod+enter", "alt+arrowdown", "escape", "mod+f" ; mod = Ctrl or Cmd */
  combo: string
  handler: (e: KeyboardEvent) => void
  /** return true to allow the shortcut for this event */
  when?: (e: KeyboardEvent) => boolean
}

function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const need = new Set(parts.slice(0, -1))
  const mod = e.ctrlKey || e.metaKey
  if (need.has('mod') !== mod) return false
  if (need.has('alt') !== e.altKey) return false
  if (need.has('shift') !== e.shiftKey) return false
  return e.key.toLowerCase() === key
}

export function useHotkeys(keys: Hotkey[]): void {
  const ref = useRef(keys)
  ref.current = keys
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      for (const k of ref.current) {
        if (matches(e, k.combo) && (!k.when || k.when(e))) {
          e.preventDefault()
          k.handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}
