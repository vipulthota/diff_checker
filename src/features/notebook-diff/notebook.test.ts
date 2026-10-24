import { describe, expect, it } from 'vitest'
import { ipynbToSource, notebookLanguage, parseCells, summarizeCells } from './notebook'

const SRC = `# Databricks notebook source
x = 1

# COMMAND ----------

# MAGIC %sql
# MAGIC select 1

# COMMAND ----------

print(x)
`

describe('databricks notebooks', () => {
  it('parses cells', () => {
    expect(parseCells(SRC)).toEqual(['x = 1', '# MAGIC %sql\n# MAGIC select 1', 'print(x)'])
  })
  it('detects language from the header', () => {
    expect(notebookLanguage(SRC)).toBe('python')
    expect(notebookLanguage('-- Databricks notebook source\nselect 1')).toBe('sql')
  })
  it('summarizes changed cells', () => {
    const s = summarizeCells(SRC, SRC.replace('x = 1', 'x = 2'))
    expect(s).toMatchObject({ left: 3, right: 3, unchanged: 2, removed: 1, added: 1 })
  })
  it('converts ipynb to the same source format', () => {
    const nb = JSON.stringify({
      cells: [
        { cell_type: 'code', source: ['x = 1'] },
        { cell_type: 'code', source: ['%sql\n', 'select 1'] },
        { cell_type: 'code', source: 'print(x)' },
      ],
      metadata: { language_info: { name: 'python' } },
    })
    expect(parseCells(ipynbToSource(nb))).toEqual(parseCells(SRC))
  })
})
