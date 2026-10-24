import type { MergeChoice, TextDiffResult } from '../../types/diff'

/** Choices per hunk index. Unresolved hunks keep the original (left) text. */
export type MergeChoices = Record<number, MergeChoice | undefined>

/**
 * Builds the merged text. Equal rows come from the left side (they are identical
 * under the active ignore options); each hunk takes the chosen side.
 */
export function buildMerged(result: TextDiffResult, choices: MergeChoices): string {
  const out: string[] = []
  for (const row of result.rows) {
    if (row.hunk === null) {
      const t = row.left ?? row.right
      if (t !== null) out.push(t)
      continue
    }
    const side = choices[row.hunk] ?? 'left'
    const t = side === 'left' ? row.left : row.right
    if (t !== null) out.push(t)
  }
  return out.join('\n')
}

export function allChoices(result: TextDiffResult, side: MergeChoice): MergeChoices {
  const c: MergeChoices = {}
  for (let i = 0; i < result.stats.differences; i++) c[i] = side
  return c
}

/**
 * Applies the chosen sides to both texts: each chosen hunk takes the same lines on
 * both sides, everything else is left untouched.
 */
export function applyMerge(
  result: TextDiffResult,
  choices: MergeChoices,
): { left: string; right: string } {
  const l: string[] = []
  const r: string[] = []
  for (const row of result.rows) {
    const side = row.hunk === null ? undefined : choices[row.hunk]
    if (side) {
      const t = side === 'left' ? row.left : row.right
      if (t !== null) {
        l.push(t)
        r.push(t)
      }
      continue
    }
    if (row.left !== null) l.push(row.left)
    if (row.right !== null) r.push(row.right)
  }
  return { left: l.join('\n'), right: r.join('\n') }
}
