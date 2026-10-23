import { useCallback, useEffect, useRef, useState } from 'react'
import { computeTextDiff, EMPTY_RESULT } from '../features/text-diff/TextDiffEngine'
import { textWorker } from '../lib/workerClient'
import type { TextDiffOptions, TextDiffResult } from '../types/diff'

const SYNC_LIMIT = 40_000 // characters; below this the diff is computed inline (instant)

interface Inputs {
  left: string
  right: string
  options: TextDiffOptions
}

/**
 * Debounced, cancellable text comparison. Small inputs are diffed inline,
 * large ones in a Web Worker so typing and scrolling stay smooth.
 */
export function useTextDiff(left: string, right: string, options: TextDiffOptions) {
  const [inputs, setInputs] = useState<Inputs>({ left, right, options })
  const [done, setDone] = useState<{ result: TextDiffResult; left: string; right: string }>(() => ({
    result: computeTextDiff(left, right, options),
    left,
    right,
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef({ left, right, options })
  current.current = { left, right, options }

  const small = left.length + right.length < SYNC_LIMIT

  // Debounce changes of the inputs.
  useEffect(() => {
    const t = setTimeout(() => setInputs({ left, right, options }), small ? 120 : 400)
    return () => clearTimeout(t)
  }, [left, right, options, small])

  // Compute whenever the debounced inputs change.
  useEffect(() => {
    let cancelled = false
    const total = inputs.left.length + inputs.right.length
    if (total < SYNC_LIMIT) {
      try {
        setDone({
          result: computeTextDiff(inputs.left, inputs.right, inputs.options),
          left: inputs.left,
          right: inputs.right,
        })
        setError(null)
      } catch {
        setError('Unable to compare these inputs.')
      }
      setLoading(false)
      return
    }
    setLoading(true)
    textWorker
      .text(inputs.left, inputs.right, inputs.options)
      .then((r) => {
        if (cancelled) return
        setDone({ result: r, left: inputs.left, right: inputs.right })
        setError(null)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled || e.message === 'cancelled') return
        setError(
          'The comparison could not be completed. The files may be too large for reliable browser processing.',
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [inputs])

  /** Skip the debounce (Ctrl/Cmd+Enter or the Compare button). */
  const flush = useCallback(() => setInputs({ ...current.current }), [])

  const pending = inputs.left !== left || inputs.right !== right || inputs.options !== options

  return {
    result: left === '' && right === '' ? EMPTY_RESULT : done.result,
    /** The exact texts the current result was computed from (line numbers refer to these). */
    source: done,
    loading: loading || pending,
    error,
    flush,
  }
}
