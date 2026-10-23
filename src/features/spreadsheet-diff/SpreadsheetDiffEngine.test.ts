import { describe, expect, it } from 'vitest'
import { computeSheetDiff, sheetResultToTable } from './SpreadsheetDiffEngine'
import type { SheetDiffOptions } from '../../types/sheet'

const o: SheetDiffOptions = { header: true, ignoreWhitespace: false, ignoreCase: false }

describe('SpreadsheetDiffEngine', () => {
  const left = [
    ['id', 'name', 'qty'],
    ['1', 'apple', '5'],
    ['2', 'pear', '3'],
    ['3', 'plum', '1'],
  ]

  it('identical sheets have no differences', () => {
    const r = computeSheetDiff(left, left, o)
    expect(r.stats.modifiedRows + r.stats.addedRows + r.stats.removedRows).toBe(0)
    expect(r.stats.unchangedRows).toBe(3)
  })

  it('detects added, removed and modified rows and cells', () => {
    const right = [
      ['id', 'name', 'qty'],
      ['1', 'apple', '6'],
      ['3', 'plum', '1'],
      ['4', 'kiwi', '9'],
    ]
    const r = computeSheetDiff(left, right, o)
    expect(r.stats.modifiedCells).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((x) => x.kind === 'removed' || x.kind === 'modified')).toBe(true)
    expect(r.rows.some((x) => x.kind === 'added' || x.kind === 'modified')).toBe(true)
  })

  it('detects added and removed columns by header', () => {
    const right = [
      ['id', 'qty', 'color'],
      ['1', '5', 'red'],
      ['2', '3', 'green'],
      ['3', '1', 'purple'],
    ]
    const r = computeSheetDiff(left, right, o)
    expect(r.stats.addedCols).toBe(1)
    expect(r.stats.removedCols).toBe(1)
    expect(r.columns.find((c) => c.label === 'color')!.status).toBe('added')
  })

  it('ignores whitespace and case on request', () => {
    const right = [
      ['id', 'name', 'qty'],
      ['1', ' APPLE ', '5'],
      ['2', 'pear', '3'],
      ['3', 'plum', '1'],
    ]
    expect(computeSheetDiff(left, right, o).stats.modifiedCells).toBe(1)
    const r = computeSheetDiff(left, right, { ...o, ignoreWhitespace: true, ignoreCase: true })
    expect(r.stats.modifiedCells).toBe(0)
  })

  it('handles empty sheets and exports a table', () => {
    const r = computeSheetDiff([], [], o)
    expect(r.rows).toHaveLength(0)
    const t = sheetResultToTable(computeSheetDiff(left, left, o))
    expect(t[0].slice(0, 3)).toEqual(['Status', 'Left row', 'Right row'])
  })
})
