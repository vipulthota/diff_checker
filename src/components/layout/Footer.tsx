import { ShieldCheck } from 'lucide-react'

export const PRIVACY_TEXT =
  'Your files are processed locally in your browser whenever possible. We do not permanently store your files or comparison data.'

export function Footer() {
  return (
    <footer className="flex h-7 items-center justify-center gap-1.5 border-t border-line bg-panel px-3 text-[11.5px] text-muted">
      <ShieldCheck size={13} className="shrink-0 text-add" aria-hidden />
      <span className="truncate" title={PRIVACY_TEXT}>
        {PRIVACY_TEXT}
      </span>
    </footer>
  )
}
