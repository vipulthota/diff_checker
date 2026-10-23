export interface Language {
  id: string
  label: string
  /** Prism grammar name */
  grammar: string
  exts: string[]
}

export const LANGUAGES: Language[] = [
  { id: 'plain', label: 'Plain text', grammar: '', exts: ['txt', 'log', 'text'] },
  {
    id: 'javascript',
    label: 'JavaScript',
    grammar: 'javascript',
    exts: ['js', 'mjs', 'cjs', 'jsx'],
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    grammar: 'typescript',
    exts: ['ts', 'tsx', 'mts', 'cts'],
  },
  { id: 'html', label: 'HTML', grammar: 'markup', exts: ['html', 'htm', 'xhtml', 'vue', 'svelte'] },
  { id: 'css', label: 'CSS', grammar: 'css', exts: ['css', 'scss', 'less'] },
  { id: 'json', label: 'JSON', grammar: 'json', exts: ['json', 'jsonc', 'json5', 'geojson'] },
  { id: 'python', label: 'Python', grammar: 'python', exts: ['py', 'pyw', 'pyi'] },
  { id: 'java', label: 'Java', grammar: 'java', exts: ['java'] },
  { id: 'c', label: 'C', grammar: 'c', exts: ['c', 'h'] },
  { id: 'cpp', label: 'C++', grammar: 'cpp', exts: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'] },
  { id: 'csharp', label: 'C#', grammar: 'csharp', exts: ['cs', 'csx'] },
  { id: 'go', label: 'Go', grammar: 'go', exts: ['go'] },
  { id: 'rust', label: 'Rust', grammar: 'rust', exts: ['rs'] },
  { id: 'php', label: 'PHP', grammar: 'php', exts: ['php', 'phtml'] },
  { id: 'sql', label: 'SQL', grammar: 'sql', exts: ['sql'] },
  { id: 'bash', label: 'Bash', grammar: 'bash', exts: ['sh', 'bash', 'zsh'] },
  { id: 'yaml', label: 'YAML', grammar: 'yaml', exts: ['yml', 'yaml'] },
  { id: 'xml', label: 'XML', grammar: 'markup', exts: ['xml', 'svg', 'xsd', 'xsl', 'plist'] },
  { id: 'markdown', label: 'Markdown', grammar: 'markdown', exts: ['md', 'markdown', 'mdx'] },
  { id: 'kotlin', label: 'Kotlin', grammar: 'kotlin', exts: ['kt', 'kts'] },
  { id: 'swift', label: 'Swift', grammar: 'swift', exts: ['swift'] },
]

export function languageForFilename(name: string): Language | undefined {
  const i = name.lastIndexOf('.')
  if (i < 0) return undefined
  const ext = name.slice(i + 1).toLowerCase()
  return LANGUAGES.find((l) => l.exts.includes(ext) && l.id !== 'plain')
}
