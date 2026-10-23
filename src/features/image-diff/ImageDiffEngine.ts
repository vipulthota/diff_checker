/** Minimal pixel buffer so the engine works with ImageData in the browser and plain objects in tests. */
export interface RawImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface ImageDiffOptions {
  /** Per-channel tolerance (0-255). Differences at or below this are ignored. */
  threshold: number
  /** Visual amplification of differences (1-10). */
  intensity: number
}

export interface ImageDiffResult {
  image: RawImage
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  percent: number
  sizeMismatch: boolean
}

/**
 * Compares two images pixel by pixel on a canvas big enough for both.
 * Pixels outside either image count as different. The output highlights changes in red
 * on top of a faded copy of the modified image.
 */
export function computeImageDiff(
  a: RawImage,
  b: RawImage,
  opts: ImageDiffOptions,
): ImageDiffResult {
  const width = Math.max(a.width, b.width)
  const height = Math.max(a.height, b.height)
  const out = new Uint8ClampedArray(width * height * 4)
  let changed = 0
  const gain = Math.max(1, opts.intensity)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const inA = x < a.width && y < a.height
      const inB = x < b.width && y < b.height
      if (inA && inB) {
        const ia = (y * a.width + x) * 4
        const ib = (y * b.width + x) * 4
        // Compare premultiplied against white so transparent pixels of any colour match.
        const aa = a.data[ia + 3]
        const ba = b.data[ib + 3]
        let delta = Math.abs(aa - ba)
        if (aa > 0 || ba > 0) {
          delta = Math.max(
            delta,
            Math.abs(a.data[ia] - b.data[ib]),
            Math.abs(a.data[ia + 1] - b.data[ib + 1]),
            Math.abs(a.data[ia + 2] - b.data[ib + 2]),
          )
        }
        if (delta > opts.threshold) {
          changed++
          const strength = Math.min(1, (delta / 255) * gain)
          out[o] = 255
          out[o + 1] = Math.round(40 * (1 - strength))
          out[o + 2] = Math.round(80 * (1 - strength))
          out[o + 3] = Math.round(120 + 135 * strength)
        } else {
          const lum = Math.round(
            0.299 * b.data[ib] + 0.587 * b.data[ib + 1] + 0.114 * b.data[ib + 2],
          )
          out[o] = out[o + 1] = out[o + 2] = Math.round(lum * 0.35 + 165)
          out[o + 3] = Math.max(40, Math.round(b.data[ib + 3] * 0.55))
        }
      } else {
        changed++
        // Area covered by only one of the images.
        out[o] = 255
        out[o + 1] = 0
        out[o + 2] = 200
        out[o + 3] = 200
      }
    }
  }
  const total = width * height
  return {
    image: { width, height, data: out },
    width,
    height,
    changedPixels: changed,
    totalPixels: total,
    percent: total === 0 ? 0 : (changed / total) * 100,
    sizeMismatch: a.width !== b.width || a.height !== b.height,
  }
}
