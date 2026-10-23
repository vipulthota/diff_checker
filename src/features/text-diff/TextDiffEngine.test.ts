import { describe, expect, it } from 'vitest'
import { computeTextDiff, toUnifiedDiff, toUnifiedRows, inlineDiff } from './TextDiffEngine'
import { buildMerged, allChoices } from './merge'
import { DEFAULT_IGNORE, type TextDiffOptions } from '../../types/diff'

const opts = (
  over: Partial<TextDiffOptions['ignore']> = {},
  g: TextDiffOptions['granularity'] = 'words',
): TextDiffOptions => ({
  granularity: g,
  ignore: { ...DEFAULT_IGNORE, ...over },
})

describe('TextDiffEngine', () => {
  it('reports identical text as no differences', () => {
    const r = computeTextDiff('a\nb\nc', 'a\nb\nc', opts())
    expect(r.stats).toEqual({ differences: 0, added: 0, removed: 0, modified: 0, unchanged: 3 })
  })

  it('handles empty inputs', () => {
    expect(computeTextDiff('', '', opts()).rows).toHaveLength(0)
    const r = computeTextDiff('', 'a\nb', opts())
    expect(r.stats.added).toBe(2)
    expect(r.stats.differences).toBe(1)
    const r2 = computeTextDiff('a\nb', '', opts())
    expect(r2.stats.removed).toBe(2)
  })

  it('detects completely different text as modified lines', () => {
    const r = computeTextDiff('one\ntwo', 'three\nfour', opts({}, 'lines'))
    expect(r.stats.modified).toBe(2)
    expect(r.stats.unchanged).toBe(0)
  })

  it('detects added, removed and modified lines', () => {
    const r = computeTextDiff('a\nb\nc\nd', 'a\nB\nc\nd\ne', opts())
    expect(r.stats.modified).toBe(1)
    expect(r.stats.added).toBe(1)
    expect(r.stats.removed).toBe(0)
    expect(r.stats.differences).toBe(2)
    const r2 = computeTextDiff('a\nb\nc', 'a\nc', opts())
    expect(r2.stats.removed).toBe(1)
  })

  it('produces word-level segments', () => {
    const r = computeTextDiff('the quick brown fox', 'the slow brown fox', opts())
    const row = r.rows[0]
    expect(row.kind).toBe('modified')
    expect(row.leftSegs!.filter((s) => s.changed).map((s) => s.text)).toEqual(['quick'])
    expect(row.rightSegs!.filter((s) => s.changed).map((s) => s.text)).toEqual(['slow'])
  })

  it('produces character-level segments', () => {
    const r = inlineDiff('color', 'colour', DEFAULT_IGNORE, true)
    expect(
      r.right
        .filter((s) => s.changed)
        .map((s) => s.text)
        .join(''),
    ).toBe('u')
  })

  it('handles unicode', () => {
    const r = computeTextDiff('héllo wörld 🌍', 'héllo wörld 🌎', opts({}, 'chars'))
    expect(r.stats.modified).toBe(1)
    expect(r.rows[0].rightSegs!.find((s) => s.changed)!.text).toBe('🌎')
  })

  it('ignores whitespace, case, punctuation', () => {
    expect(computeTextDiff('a  b', 'a b', opts({ whitespace: true })).stats.differences).toBe(0)
    expect(computeTextDiff('a  b', 'a b', opts()).stats.differences).toBe(1)
    expect(computeTextDiff('Hello', 'hello', opts({ case: true })).stats.differences).toBe(0)
    expect(
      computeTextDiff('Hi, there!', 'Hi there', opts({ punctuation: true })).stats.differences,
    ).toBe(0)
    expect(computeTextDiff('  x  ', 'x', opts({ trimLines: true })).stats.differences).toBe(0)
  })

  it('ignores blank lines but keeps them displayed', () => {
    const r = computeTextDiff('a\n\nb', 'a\nb', opts({ blankLines: true }))
    expect(r.stats.differences).toBe(0)
    expect(r.rows.map((x) => x.left ?? x.right)).toContain('')
  })

  it('treats CRLF vs LF according to the option', () => {
    expect(computeTextDiff('a\r\nb', 'a\nb', opts({ lineEndings: true })).stats.differences).toBe(0)
    expect(computeTextDiff('a\r\nb', 'a\nb', opts({ lineEndings: false })).stats.differences).toBe(
      1,
    )
  })

  it('merges choices', () => {
    const r = computeTextDiff('a\nb\nc', 'a\nX\nc\nd', opts())
    expect(buildMerged(r, allChoices(r, 'right'))).toBe('a\nX\nc\nd')
    expect(buildMerged(r, allChoices(r, 'left'))).toBe('a\nb\nc')
    expect(buildMerged(r, { 0: 'right' })).toBe('a\nX\nc')
  })

  it('creates a unified diff', () => {
    const r = computeTextDiff('a\nb\nc', 'a\nB\nc', opts())
    const u = toUnifiedDiff(r, 'x', 'y')
    expect(u).toContain('--- x')
    expect(u).toContain('-b')
    expect(u).toContain('+B')
    expect(u).toContain('@@ -1,3 +1,3 @@')
    expect(toUnifiedRows(r.rows).map((x) => x.kind)).toEqual(['equal', 'removed', 'added', 'equal'])
  })

  it('pairs a changed line with its real counterpart in uneven blocks', () => {
    const r = computeTextDiff(
      'console.log(total(a))',
      '// a note\nconsole.log(total(a), 0.1)',
      opts(),
    )
    const mod = r.rows.find((x) => x.kind === 'modified')!
    expect(mod.right).toBe('console.log(total(a), 0.1)')
    expect(r.rows.find((x) => x.kind === 'added')!.right).toBe('// a note')
  })

  it('handles large inputs quickly', () => {
    const a = Array.from({ length: 50000 }, (_, i) => `line ${i}`)
    const b = [...a]
    b[100] = 'changed'
    b.splice(25000, 1)
    const t = Date.now()
    const r = computeTextDiff(a.join('\n'), b.join('\n'), opts())
    expect(r.stats.differences).toBe(2)
    expect(Date.now() - t).toBeLessThan(5000)
  })
})
