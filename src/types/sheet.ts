export type SheetData = string[][]

export interface SheetDiffOptions {
  /** Treat the first row as a header and align columns by header name. */
  header: boolean
  ignoreWhitespace: boolean
  ignoreCase: boolean
}

export type CellStatus = 'same' | 'modified' | 'added' | 'removed'
export type SheetRowKind = 'equal' | 'added' | 'removed' | 'modified'

export interface SheetColumn {
  label: string
  leftIdx: number | null
  rightIdx: number | null
  status: 'same' | 'added' | 'removed'
}

export interface SheetCell {
  left: string | null
  right: string | null
  status: CellStatus
}

export interface SheetRow {
  kind: SheetRowKind
  leftNo: number | null
  rightNo: number | null
  cells: SheetCell[]
}

export interface SheetStats {
  addedRows: number
  removedRows: number
  modifiedRows: number
  unchangedRows: number
  addedCols: number
  removedCols: number
  modifiedCells: number
}

export interface SheetDiffResult {
  columns: SheetColumn[]
  rows: SheetRow[]
  stats: SheetStats
}
