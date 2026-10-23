import { Keyboard, Laptop, Moon, Settings, Sun } from 'lucide-react'
import { hrefFor, type Route } from '../../hooks/useHashRoute'
import { usePrefs, type ThemeMode } from '../../lib/prefs'
import { useUi } from '../../lib/ui-context'
import { IconButton } from '../ui/Button'
import { Menu, MenuItem } from '../ui/Menu'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="6" y="9" width="8.5" height="3" rx="1.5" fill="#fff" />
      <rect x="6" y="14.5" width="8.5" height="3" rx="1.5" fill="#fff" opacity=".55" />
      <rect x="6" y="20" width="8.5" height="3" rx="1.5" fill="#fff" />
      <rect x="17.5" y="9" width="8.5" height="3" rx="1.5" fill="#fff" />
      <rect x="17.5" y="14.5" width="8.5" height="3" rx="1.5" fill="#34d399" />
      <rect x="17.5" y="20" width="8.5" height="3" rx="1.5" fill="#fff" />
    </svg>
  )
}

export const NAV: { route: Route; label: string }[] = [
  { route: 'text', label: 'Text' },
  { route: 'code', label: 'Code' },
  { route: 'documents', label: 'Documents' },
  { route: 'images', label: 'Images' },
  { route: 'spreadsheets', label: 'Spreadsheets' },
]

const THEMES: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Laptop },
]

export function Header({ route }: { route: Route }) {
  const { theme, setTheme } = usePrefs()
  const { openDialog } = useUi()
  const Current = THEMES.find((t) => t.mode === theme)!.icon

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur">
      <a
        href="#main"
        className="sr-only-focusable left-2 top-2 z-50 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-2 px-3 md:gap-4 md:px-4">
        <a
          href={hrefFor('home')}
          className="flex items-center gap-2 rounded-lg pr-1 font-semibold tracking-tight"
          aria-label="DiffSpace home"
        >
          <Logo />
          <span className="hidden text-[17px] sm:inline">DiffSpace</span>
        </a>
        <nav
          aria-label="Comparison modes"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1"
        >
          {NAV.map((n) => (
            <a
              key={n.route}
              href={hrefFor(n.route)}
              aria-current={route === n.route ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                route === n.route
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:bg-panel2 hover:text-fg'
              }`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-0.5">
          <Menu
            align="right"
            width="w-40"
            trigger={(t) => (
              <IconButton label={`Theme: ${theme}`} {...t}>
                <Current size={18} />
              </IconButton>
            )}
          >
            {(close) =>
              THEMES.map(({ mode, label, icon: Icon }) => (
                <MenuItem
                  key={mode}
                  icon={<Icon size={16} />}
                  onClick={() => {
                    setTheme(mode)
                    close()
                  }}
                >
                  <span className={theme === mode ? 'font-semibold text-accent' : ''}>{label}</span>
                </MenuItem>
              ))
            }
          </Menu>
          <IconButton label="Settings" onClick={() => openDialog('settings')}>
            <Settings size={18} />
          </IconButton>
          <IconButton
            label="Keyboard shortcuts (Ctrl/Cmd + /)"
            onClick={() => openDialog('shortcuts')}
          >
            <Keyboard size={18} />
          </IconButton>
        </div>
      </div>
    </header>
  )
}
