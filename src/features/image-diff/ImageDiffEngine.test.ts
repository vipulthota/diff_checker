import { describe, expect, it } from 'vitest'
import { computeImageDiff, type RawImage } from './ImageDiffEngine'

const solid = (w: number, h: number, rgba: [number, number, number, number]): RawImage => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4)
  return { width: w, height: h, data }
}

describe('ImageDiffEngine', () => {
  it('reports identical images as 0% different', () => {
    const r = computeImageDiff(solid(4, 4, [10, 20, 30, 255]), solid(4, 4, [10, 20, 30, 255]), {
      threshold: 0,
      intensity: 1,
    })
    expect(r.changedPixels).toBe(0)
    expect(r.percent).toBe(0)
  })

  it('detects fully different images', () => {
    const r = computeImageDiff(solid(4, 4, [0, 0, 0, 255]), solid(4, 4, [255, 255, 255, 255]), {
      threshold: 0,
      intensity: 1,
    })
    expect(r.percent).toBe(100)
  })

  it('respects the threshold', () => {
    const a = solid(2, 2, [100, 100, 100, 255])
    const b = solid(2, 2, [105, 100, 100, 255])
    expect(computeImageDiff(a, b, { threshold: 10, intensity: 1 }).changedPixels).toBe(0)
    expect(computeImageDiff(a, b, { threshold: 2, intensity: 1 }).changedPixels).toBe(4)
  })

  it('counts non-overlapping area when sizes differ', () => {
    const r = computeImageDiff(solid(2, 2, [1, 2, 3, 255]), solid(4, 2, [1, 2, 3, 255]), {
      threshold: 0,
      intensity: 1,
    })
    expect(r.sizeMismatch).toBe(true)
    expect(r.width).toBe(4)
    expect(r.changedPixels).toBe(4)
  })
})
