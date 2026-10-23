import { useUi } from '../../lib/ui-context'
import { usePrefs, type ThemeMode } from '../../lib/prefs'
import type { DiffGranularity } from '../../types/diff'
import { Button } from '../ui/Button'
import { Checkbox, Segmented, Select } from '../ui/Controls'
import { Dialog } from '../ui/Dialog'

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Ctrl/Cmd', 'Enter'], action: 'Run comparison' },
  { keys: ['Ctrl/Cmd', 'F'], action: 'Search in the comparison' },
  { keys: ['Alt', '↓'], action: 'Next difference' },
  { keys: ['Alt', '↑'], action: 'Previous difference' },
  { keys: ['Enter'], action: 'Next search match (in the search box)' },
  { keys: ['Shift', 'Enter'], action: 'Previous search match' },
  { keys: ['Esc'], action: 'Close dialog or search' },
  { keys: ['Ctrl/Cmd', 'Z'], action: 'Undo (typing, or merge choices)' },
  { keys: ['Ctrl/Cmd', 'Shift', 'Z'], action: 'Redo' },
  { keys: ['Ctrl/Cmd', '/'], action: 'Show this panel' },
]

export function Dialogs() {
  const { dialog, closeDialog } = useUi()
  const { theme, setTheme, prefs, setPrefs, resetPrefs } = usePrefs()

  return (
    <>
      <Dialog open={dialog === 'shortcuts'} title="Keyboard shortcuts" onClose={closeDialog}>
        <table className="w-full text-sm">
          <caption className="sr-only">Keyboard shortcuts</caption>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.action} className="border-b border-line last:border-0">
                <td className="py-2 pr-4">{s.action}</td>
                <td className="py-2 text-right">
                  {s.keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && <span className="px-0.5 text-muted">+</span>}
                      <kbd className="rounded-md border border-line bg-panel2 px-1.5 py-0.5 font-mono text-xs">
                        {k}
                      </kbd>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Ctrl/Cmd + F only opens the in-page search while focus is inside the comparison; elsewhere
          your browser’s own find keeps working.
        </p>
      </Dialog>

      <Dialog open={dialog === 'settings'} title="Settings" onClose={closeDialog}>
        <div className="space-y-5 text-sm">
          <div>
            <p className="mb-2 font-medium">Theme</p>
            <Segmented<ThemeMode>
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
          <div>
            <label htmlFor="fs" className="mb-2 block font-medium">
              Editor font size: {prefs.fontSize}px
            </label>
            <input
              id="fs"
              type="range"
              min={10}
              max={20}
              value={prefs.fontSize}
              onChange={(e) => setPrefs({ fontSize: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div>
            <p className="mb-1 font-medium">Default comparison style</p>
            <Select
              label="Default granularity"
              value={prefs.granularity}
              onChange={(v) => setPrefs({ granularity: v as DiffGranularity })}
              options={[
                { value: 'smart', label: 'Smart' },
                { value: 'lines', label: 'Line' },
                { value: 'words', label: 'Word' },
                { value: 'chars', label: 'Character' },
              ]}
            />
          </div>
          <Checkbox checked={prefs.wrap} onChange={(v) => setPrefs({ wrap: v })}>
            Wrap long lines by default
          </Checkbox>
          <p className="rounded-lg bg-panel2 p-3 text-xs text-muted">
            Only these interface preferences are remembered in your browser. Your files and
            comparison content are never stored.
          </p>
          <div className="flex justify-between">
            <Button size="sm" variant="ghost" onClick={resetPrefs}>
              Reset preferences
            </Button>
            <Button size="sm" variant="primary" onClick={closeDialog}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
