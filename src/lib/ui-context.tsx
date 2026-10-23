import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

/* Toasts + global dialog state (settings / shortcuts) */

export interface ToastItem {
  id: number
  message: string
  kind: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

interface UiCtx {
  toast: (message: string, kind?: ToastItem['kind'], action?: ToastItem['action']) => void
  dialog: 'settings' | 'shortcuts' | null
  openDialog: (d: 'settings' | 'shortcuts') => void
  closeDialog: () => void
}

const Ctx = createContext<UiCtx | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<UiCtx['dialog']>(null)
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback<UiCtx['toast']>(
    (message, kind = 'info', action) => {
      const id = ++idRef.current
      setToasts((t) => [...t.slice(-3), { id, message, kind, action }])
      setTimeout(() => dismiss(id), action ? 7000 : 3500)
    },
    [dismiss],
  )

  const value = useMemo<UiCtx>(
    () => ({ toast, dialog, openDialog: setDialog, closeDialog: () => setDialog(null) }),
    [toast, dialog],
  )

  const icon = { success: CheckCircle2, error: AlertTriangle, info: Info }
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = icon[t.kind]
          return (
            <div
              key={t.id}
              className="animate-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm shadow-lg"
            >
              <Icon
                size={18}
                className={
                  t.kind === 'success'
                    ? 'text-add'
                    : t.kind === 'error'
                      ? 'text-del'
                      : 'text-accent'
                }
                aria-hidden
              />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  className="font-medium text-accent hover:underline"
                  onClick={() => {
                    t.action!.run()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                aria-label="Dismiss notification"
                className="text-muted hover:text-fg"
                onClick={() => dismiss(t.id)}
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useUi(): UiCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useUi must be used inside UiProvider')
  return c
}
