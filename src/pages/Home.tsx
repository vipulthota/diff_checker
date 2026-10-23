import {
  ArrowRight,
  Code2,
  FileText,
  FileType2,
  Image as ImageIcon,
  Lock,
  ShieldCheck,
  Table2,
  Zap,
} from 'lucide-react'
import { hrefFor, type Route } from '../hooks/useHashRoute'

const FEATURES: { route: Route; title: string; icon: typeof FileText; text: string }[] = [
  {
    route: 'text',
    title: 'Text Compare',
    icon: FileText,
    text: 'Line, word and character diffs with side-by-side or unified views, ignore options and one-click merging.',
  },
  {
    route: 'code',
    title: 'Code Compare',
    icon: Code2,
    text: 'Syntax highlighting for 20 languages, automatic language detection and a safe text-only display.',
  },
  {
    route: 'documents',
    title: 'Document Compare',
    icon: FileType2,
    text: 'Extract and compare the text of PDF, DOCX, Markdown and TXT files, page by page.',
  },
  {
    route: 'images',
    title: 'Image Compare',
    icon: ImageIcon,
    text: 'Slider, overlay, fade, flicker and pixel-difference views for PNG, JPG, WEBP and GIF.',
  },
  {
    route: 'spreadsheets',
    title: 'Spreadsheet Compare',
    icon: Table2,
    text: 'Find added, removed and changed rows, columns and cells in CSV, TSV, XLS and XLSX files.',
  },
]

export default function Home() {
  return (
    <div className="animate-in">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60rem 28rem at 50% -10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-muted">
              <Lock size={13} className="text-add" aria-hidden /> Runs entirely in your browser
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-[3.4rem]">
              Compare. Find Differences. <span className="text-accent">Fix Faster.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Compare text, code, documents, images and spreadsheets directly in your browser.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={hrefFor('text')}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-fg shadow-lg shadow-[color-mix(in_srgb,var(--accent)_35%,transparent)] transition hover:opacity-90"
              >
                Start Comparing <ArrowRight size={18} aria-hidden />
              </a>
              <span className="text-sm text-muted">No account · No upload · No setup</span>
            </div>
          </div>

          {/* Decorative illustration */}
          <div aria-hidden className="mx-auto w-full max-w-md select-none">
            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-line bg-panel2 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--del-strong)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--mod-strong)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--add-strong)]" />
              </div>
              <div className="grid grid-cols-2 font-mono text-[12px] leading-6">
                {[
                  ['const total = 0', 'const total = 0', ''],
                  ['let price = 4', 'let price = 5', 'mod'],
                  ['items.push(a)', '', 'del'],
                  ['', 'items.push(b)', 'add'],
                  ['return total', 'return total', ''],
                ].map(([l, r, k], i) => (
                  <div key={i} className="contents">
                    <div
                      className={`border-r border-line px-3 ${k === 'mod' ? 'bg-[var(--mod-bg)]' : k === 'del' ? 'bg-[var(--del-bg)]' : ''}`}
                    >
                      {k === 'del' ? '− ' : k === 'mod' ? '~ ' : '  '}
                      {l || ' '}
                    </div>
                    <div
                      className={`px-3 ${k === 'mod' ? 'bg-[var(--mod-bg)]' : k === 'add' ? 'bg-[var(--add-bg)]' : ''}`}
                    >
                      {k === 'add' ? '+ ' : k === 'mod' ? '~ ' : '  '}
                      {r || ' '}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="features">
        <h2 id="features" className="mb-8 text-2xl font-semibold tracking-tight">
          Everything you need to spot a difference
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ route, title, icon: Icon, text }) => (
            <a
              key={route}
              href={hrefFor(route)}
              className="group rounded-2xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon size={20} aria-hidden />
              </span>
              <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold">
                {title}
                <ArrowRight
                  size={15}
                  className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden
                />
              </h3>
              <p className="text-sm leading-relaxed text-muted">{text}</p>
            </a>
          ))}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--add-bg)] text-add">
              <ShieldCheck size={20} aria-hidden />
            </span>
            <h3 className="mb-1.5 font-semibold">Privacy First</h3>
            <p className="text-sm leading-relaxed text-muted">
              Files are read by your browser and never leave your device. There is nothing to sign
              up for.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-panel">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
          {[
            ['1', 'Choose what to compare', 'Pick text, code, documents, images or spreadsheets.'],
            [
              '2',
              'Paste or drop two inputs',
              'Type, paste, upload, or drag files onto either side.',
            ],
            [
              '3',
              'See the differences',
              'Navigate, search, merge, then download the result if you like.',
            ],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">
                {n}
              </span>
              <div>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center" aria-labelledby="privacy">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--add-bg)] text-add">
          <Zap size={22} aria-hidden />
        </span>
        <h2 id="privacy" className="text-2xl font-semibold tracking-tight">
          Your files stay in your browser
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
          Your files stay in your browser whenever possible. No account. No database. No permanent
          file storage.
        </p>
        <a
          href={hrefFor('text')}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
        >
          Start Comparing <ArrowRight size={18} aria-hidden />
        </a>
      </section>
    </div>
  )
}
