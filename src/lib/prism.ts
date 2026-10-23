import Prism from 'prismjs'
import { LANGUAGES } from './languages'

/*
 * Syntax highlighting without ever touching innerHTML: Prism only tokenizes the
 * text, and React renders the tokens as ordinary text nodes inside <span>s.
 * Uploaded code is therefore displayed as text and can never be executed.
 */

;(globalThis as { Prism?: unknown }).Prism = Prism

type Loader = () => Promise<unknown>

const COMPONENTS: Record<string, Loader> = {
  markup: () => import('prismjs/components/prism-markup'),
  css: () => import('prismjs/components/prism-css'),
  clike: () => import('prismjs/components/prism-clike'),
  javascript: () => import('prismjs/components/prism-javascript'),
  typescript: () => import('prismjs/components/prism-typescript'),
  json: () => import('prismjs/components/prism-json'),
  python: () => import('prismjs/components/prism-python'),
  java: () => import('prismjs/components/prism-java'),
  c: () => import('prismjs/components/prism-c'),
  cpp: () => import('prismjs/components/prism-cpp'),
  csharp: () => import('prismjs/components/prism-csharp'),
  go: () => import('prismjs/components/prism-go'),
  rust: () => import('prismjs/components/prism-rust'),
  'markup-templating': () => import('prismjs/components/prism-markup-templating'),
  php: () => import('prismjs/components/prism-php'),
  sql: () => import('prismjs/components/prism-sql'),
  bash: () => import('prismjs/components/prism-bash'),
  yaml: () => import('prismjs/components/prism-yaml'),
  markdown: () => import('prismjs/components/prism-markdown'),
  kotlin: () => import('prismjs/components/prism-kotlin'),
  swift: () => import('prismjs/components/prism-swift'),
}

/** Grammars that must be loaded first. */
const DEPS: Record<string, string[]> = {
  javascript: ['clike'],
  typescript: ['clike', 'javascript'],
  java: ['clike'],
  c: ['clike'],
  cpp: ['clike', 'c'],
  csharp: ['clike'],
  go: ['clike'],
  kotlin: ['clike'],
  php: ['markup', 'clike', 'markup-templating'],
  markdown: ['markup'],
  'markup-templating': ['markup'],
}

const loading = new Map<string, Promise<void>>()

export function loadGrammar(name: string): Promise<void> {
  if (!name || Prism.languages[name]) return Promise.resolve()
  let p = loading.get(name)
  if (!p) {
    p = (async () => {
      for (const d of DEPS[name] ?? []) await loadGrammar(d)
      const loader = COMPONENTS[name]
      if (loader) await loader()
    })().catch(() => {
      loading.delete(name)
    })
    loading.set(name, p)
  }
  return p
}

export function loadLanguage(id: string): Promise<void> {
  const lang = LANGUAGES.find((l) => l.id === id)
  return lang?.grammar ? loadGrammar(lang.grammar) : Promise.resolve()
}

export interface Run {
  text: string
  cls?: string
}

const HIGHLIGHT_LIMIT = 600_000

function flatten(tokens: (string | Prism.Token)[], cls: string | undefined, lines: Run[][]): void {
  for (const t of tokens) {
    if (typeof t === 'string') {
      pushText(t, cls, lines)
    } else {
      const own = `tok-${t.type}${
        t.alias
          ? ' ' +
            [t.alias]
              .flat()
              .map((a) => `tok-${a}`)
              .join(' ')
          : ''
      }`
      if (typeof t.content === 'string') pushText(t.content, own, lines)
      else flatten(Array.isArray(t.content) ? t.content : [t.content], own, lines)
    }
  }
}

function pushText(text: string, cls: string | undefined, lines: Run[][]) {
  const parts = text.split('\n')
  parts.forEach((p, i) => {
    if (i > 0) lines.push([])
    if (p) lines[lines.length - 1].push({ text: p.replace(/\r$/, ''), cls })
  })
}

/** Tokenizes text into per-line style runs. Returns null when no grammar applies. */
export function tokenizeLines(text: string, languageId: string): Run[][] | null {
  const lang = LANGUAGES.find((l) => l.id === languageId)
  if (!lang?.grammar || text.length > HIGHLIGHT_LIMIT) return null
  const grammar = Prism.languages[lang.grammar]
  if (!grammar) return null
  try {
    const lines: Run[][] = [[]]
    flatten(Prism.tokenize(text, grammar), undefined, lines)
    return lines
  } catch {
    return null
  }
}
