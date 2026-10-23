import { formatBytes } from '../utils/format'

export const MB = 1024 * 1024

/** Reasonable limits so the tab never freezes or runs out of memory. */
export const LIMITS = {
  textWarn: 1 * MB,
  textMax: 25 * MB,
  docWarn: 8 * MB,
  docMax: 60 * MB,
  sheetWarn: 5 * MB,
  sheetMax: 40 * MB,
  imageWarn: 10 * MB,
  imageMax: 40 * MB,
}

export class FileError extends Error {}

export type FileKind = 'text' | 'pdf' | 'docx' | 'sheet' | 'image' | 'binary'

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const SHEET_EXT = ['csv', 'tsv', 'xlsx', 'xls']
const BINARY_EXT = [
  'zip',
  'gz',
  'tar',
  '7z',
  'rar',
  'exe',
  'dll',
  'bin',
  'iso',
  'mp3',
  'mp4',
  'mov',
  'avi',
  'wav',
  'pptx',
  'ppt',
  'doc',
  'odt',
  'ods',
  'ttf',
  'otf',
  'woff',
  'woff2',
  'ico',
  'bmp',
  'tiff',
  'psd',
  'class',
  'jar',
  'so',
  'o',
  'pyc',
  'svg',
]

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function classifyFile(file: File): FileKind {
  const ext = extOf(file.name)
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (SHEET_EXT.includes(ext) && ext !== 'csv' && ext !== 'tsv') return 'sheet'
  if (IMAGE_EXT.includes(ext) || /^image\/(png|jpeg|webp|gif)$/.test(file.type)) return 'image'
  if (
    BINARY_EXT.includes(ext) ||
    file.type.startsWith('image/') ||
    file.type.startsWith('audio/') ||
    file.type.startsWith('video/')
  )
    return 'binary'
  return 'text'
}

export const isSheetFile = (file: File) => SHEET_EXT.includes(extOf(file.name))

function checkSize(file: File, warn: number, max: number): string | undefined {
  if (file.size > max)
    throw new FileError(
      `"${file.name}" is ${formatBytes(file.size)}. File is too large for reliable browser processing (limit ${formatBytes(max)}).`,
    )
  if (file.size > warn) return 'This file is large and may take longer to compare.'
  return undefined
}

export function checkTextSize(file: File) {
  return checkSize(file, LIMITS.textWarn, LIMITS.textMax)
}
export function checkDocSize(file: File) {
  return checkSize(file, LIMITS.docWarn, LIMITS.docMax)
}
export function checkSheetSize(file: File) {
  return checkSize(file, LIMITS.sheetWarn, LIMITS.sheetMax)
}
export function checkImageSize(file: File) {
  return checkSize(file, LIMITS.imageWarn, LIMITS.imageMax)
}

export interface LoadedText {
  name: string
  text: string
  size: number
  warning?: string
  /** 0-based line index where each page starts (PDF only). */
  pageStarts?: number[]
  /** Extra explanation shown to the user (e.g. formatting is not compared). */
  note?: string
}

/** Reads a file as text in the browser. The content is never executed or uploaded. */
export async function readTextFile(file: File): Promise<LoadedText> {
  const kind = classifyFile(file)
  if (kind !== 'text') throw new FileError('Unsupported file type.')
  const warning = checkTextSize(file)
  let buf: ArrayBuffer
  try {
    buf = await file.arrayBuffer()
  } catch {
    throw new FileError(
      `Unable to read "${file.name}". The file may have been moved or is not accessible.`,
    )
  }
  const bytes = new Uint8Array(buf)
  const probe = bytes.subarray(0, 8192)
  for (let i = 0; i < probe.length; i++) {
    if (probe[i] === 0)
      throw new FileError(
        `"${file.name}" looks like a binary file, not text. Unsupported file type.`,
      )
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return { name: file.name, text, size: file.size, warning }
}

export async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer()
  } catch {
    throw new FileError(
      `Unable to read "${file.name}". The file may have been moved or is not accessible.`,
    )
  }
}

/** Turns any thrown value into a message that is safe to show (never a stack trace). */
export function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof FileError) return e.message
  return fallback
}
