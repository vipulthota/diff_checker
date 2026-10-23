export type DiffGranularity = 'lines' | 'words' | 'chars' | 'smart'

export interface IgnoreOptions {
  whitespace: boolean
  blankLines: boolean
  case: boolean
  punctuation: boolean
  lineEndings: boolean
  trimLines: boolean
}

export const DEFAULT_IGNORE: IgnoreOptions = {
  whitespace: false,
  blankLines: false,
  case: false,
  punctuation: false,
  lineEndings: true,
  trimLines: false,
}

export interface TextDiffOptions {
  granularity: DiffGranularity
  ignore: IgnoreOptions
}

export type RowKind = 'equal' | 'added' | 'removed' | 'modified'

/** A run of characters inside a line; `changed` marks the part that differs. */
export interface InlineSeg {
  text: string
  changed: boolean
}

export interface DiffRow {
  kind: RowKind
  /** 1-based line numbers, null when the side has no line in this row. */
  leftNo: number | null
  rightNo: number | null
  left: string | null
  right: string | null
  leftSegs?: InlineSeg[]
  rightSegs?: InlineSeg[]
  /** Index of the difference (hunk) this row belongs to; null for equal rows. */
  hunk: number | null
}

export interface DiffStats {
  differences: number
  added: number
  removed: number
  modified: number
  unchanged: number
}

export interface TextDiffResult {
  rows: DiffRow[]
  stats: DiffStats
  /** Row index of the first row of each hunk. */
  hunkStarts: number[]
  /** True when the diff was too expensive and a coarse fallback was used. */
  approximate: boolean
}

export type MergeChoice = 'left' | 'right'
