import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { DiffGranularity } from '../types/diff'

export type ThemeMode = 'light' | 'dark' | 'system'

/** Only harmless interface preferences are persisted. Comparison content never is. */
export interface Prefs {
  fontSize: number
  wrap: boolean
  granularity: DiffGranularity
}

const DEFAULT_PREFS: Prefs = { fontSize: 13, wrap: false, granularity: 'smart' }
const THEME_KEY = 'diffspace:theme'
const PREFS_KEY = 'diffspace:prefs'

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage may be unavailable (private mode) – preferences just won't persist */
  }
}

function loadPrefs(): Prefs {
  try {
    const raw = readLS(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      fontSize: typeof p.fontSize === 'number' ? Math.min(20, Math.max(10, p.fontSize)) : 13,
      wrap: typeof p.wrap === 'boolean' ? p.wrap : false,
      granularity: ['lines', 'words', 'chars', 'smart'].includes(p.granularity as string)
        ? (p.granularity as DiffGranularity)
        : 'smart',
    }
  } catch {
    return DEFAULT_PREFS
  }
}

interface PrefsCtx {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  resetPrefs: () => void
}

const Ctx = createContext<PrefsCtx | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const t = readLS(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  })
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t)
    writeLS(THEME_KEY, t)
  }, [])

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p }
      writeLS(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resetPrefs = useCallback(() => {
    setPrefsState(DEFAULT_PREFS)
    writeLS(PREFS_KEY, JSON.stringify(DEFAULT_PREFS))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, prefs, setPrefs, resetPrefs }),
    [theme, setTheme, prefs, setPrefs, resetPrefs],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs(): PrefsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrefs must be used inside PrefsProvider')
  return c
}
