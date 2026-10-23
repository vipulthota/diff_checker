import type { TextDiffOptions, TextDiffResult } from '../types/diff'
import type { SheetData, SheetDiffOptions, SheetDiffResult } from '../types/sheet'

export type WorkerRequest =
  | { id: number; kind: 'text'; left: string; right: string; options: TextDiffOptions }
  | { id: number; kind: 'sheet'; left: SheetData; right: SheetData; options: SheetDiffOptions }

export type WorkerResponse =
  | { id: number; ok: true; result: TextDiffResult | SheetDiffResult }
  | { id: number; ok: false; error: string }
