import { languageForFilename, type Language } from '../../lib/languages'
import { tokenizeLines, type Run } from '../../lib/prism'
import type { TextDiffOptions, TextDiffResult } from '../../types/diff'
import { computeTextDiff } from '../text-diff/TextDiffEngine'

/**
 * Code comparison = the text engine (line alignment + inline highlights) plus language
 * detection and syntax tokenization. Code is only tokenized into text runs; it is never executed.
 */
export function detectLanguage(filename: string): Language | undefined {
  return languageForFilename(filename)
}

export function compareCode(left: string, right: string, options: TextDiffOptions): TextDiffResult {
  return computeTextDiff(left, right, options)
}

export function highlightCode(source: string, languageId: string): Run[][] | null {
  return tokenizeLines(source, languageId)
}
