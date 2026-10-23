import { FileError, checkImageSize, classifyFile, extOf } from '../../lib/files'

export interface LoadedImage {
  name: string
  url: string
  width: number
  height: number
  format: string
  size: number
  warning?: string
}

const MAX_PIXELS = 100_000_000

function formatOf(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'PNG'
    case 'image/jpeg':
      return 'JPEG'
    case 'image/webp':
      return 'WEBP'
    case 'image/gif':
      return 'GIF'
  }
  const e = extOf(file.name)
  return e === 'jpg' ? 'JPEG' : e.toUpperCase()
}

/** Decodes an image locally. The object URL must be revoked with URL.revokeObjectURL when done. */
export async function loadImage(file: File): Promise<LoadedImage> {
  if (classifyFile(file) !== 'image') throw new FileError('Unsupported file type.')
  const warning = checkImageSize(file)
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty')
    if (img.naturalWidth * img.naturalHeight > MAX_PIXELS)
      throw new FileError('File is too large for reliable browser processing.')
    return {
      name: file.name,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      format: formatOf(file),
      size: file.size,
      warning,
    }
  } catch (e) {
    URL.revokeObjectURL(url)
    if (e instanceof FileError) throw e
    throw new FileError(
      `Unable to decode "${file.name}". The image may be corrupted or in an unsupported format.`,
    )
  }
}

/** Reads the pixels of a loaded image. */
export async function readPixels(img: LoadedImage): Promise<ImageData> {
  const el = new Image()
  el.src = img.url
  await el.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new FileError('Your browser does not support canvas image processing.')
  ctx.drawImage(el, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
}
