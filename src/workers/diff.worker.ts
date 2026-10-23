/// <reference lib="webworker" />
import { computeTextDiff } from '../features/text-diff/TextDiffEngine'
import { computeSheetDiff } from '../features/spreadsheet-diff/SpreadsheetDiffEngine'
import type { WorkerRequest, WorkerResponse } from './protocol'

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  try {
    const result =
      req.kind === 'text'
        ? computeTextDiff(req.left, req.right, req.options)
        : computeSheetDiff(req.left, req.right, req.options)
    const res: WorkerResponse = { id: req.id, ok: true, result }
    ;(self as unknown as Worker).postMessage(res)
  } catch (err) {
    const res: WorkerResponse = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : 'Comparison failed',
    }
    ;(self as unknown as Worker).postMessage(res)
  }
}
