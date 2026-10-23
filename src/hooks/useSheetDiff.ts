import { useEffect, useState } from 'react'
import { computeSheetDiff } from '../features/spreadsheet-diff/SpreadsheetDiffEngine'
import { sheetWorker } from '../lib/workerClient'
import type { SheetData, SheetDiffOptions, SheetDiffResult } from '../types/sheet'

const cells = (d: SheetData) => d.length * (d[0]?.length ?? 0)

/** Computes the spreadsheet diff; large sheets run in a Web Worker. */
export function useSheetDiff(
  left: SheetData | null,
  right: SheetData | null,
  options: SheetDiffOptions,
) {
  const [result, setResult] = useState<SheetDiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!left || !right) {
      setResult(null)
      setError(null)
      return
    }
    let cancelled = false
    setError(null)
    if (cells(left) + cells(right) < 40_000) {
      try {
        setResult(computeSheetDiff(left, right, options))
      } catch {
        setError('Unable to compare these sheets.')
      }
      setLoading(false)
      return
    }
    setLoading(true)
    sheetWorker
      .sheet(left, right, options)
      .then((r) => {
        if (cancelled) return
        setResult(r)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled || e.message === 'cancelled') return
        setError(
          'The comparison could not be completed. The sheets may be too large for reliable browser processing.',
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [left, right, options])

  return { result, loading, error }
}
