import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  ImagePlus,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  ScanSearch,
  Trash2,
  ZoomIn,
  ZoomOut,
  ArrowLeftRight,
} from 'lucide-react'
import { Dropzone, FilePicker } from '../../components/file-dropzone/Dropzone'
import { Button, IconButton } from '../../components/ui/Button'
import { Notice, Segmented, Select, Spinner } from '../../components/ui/Controls'
import { friendlyError } from '../../lib/files'
import { useUi } from '../../lib/ui-context'
import { downloadBlob } from '../../utils/download'
import { formatBytes } from '../../utils/format'
import { computeImageDiff, type ImageDiffResult } from './ImageDiffEngine'
import { loadImage, readPixels, type LoadedImage } from './loadImage'
import { Pannable, zoomAround, type View } from './Pannable'

type Mode = 'side' | 'overlay' | 'fade' | 'slider' | 'difference' | 'flicker'

const MODES: { value: Mode; label: string; title: string }[] = [
  { value: 'side', label: 'Side by side', title: 'Both images next to each other' },
  {
    value: 'overlay',
    label: 'Overlay',
    title: 'Modified image on top of the original with adjustable opacity',
  },
  { value: 'fade', label: 'Fade', title: 'Cross-fade between the two images' },
  { value: 'slider', label: 'Slider', title: 'Drag a divider to reveal one image over the other' },
  { value: 'difference', label: 'Difference', title: 'Highlight changed pixels' },
  { value: 'flicker', label: 'Flicker', title: 'Alternate between the images' },
]

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif'

const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function ImageCompare() {
  const { toast } = useUi()
  const [a, setA] = useState<LoadedImage | null>(null)
  const [b, setB] = useState<LoadedImage | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setModeState] = useState<Mode>('slider')
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const setMode = (m: Mode) => {
    autoFit.current = true
    setModeState(m)
  }
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [opacity, setOpacity] = useState(50)
  const [fade, setFade] = useState(50)
  const [fadePlaying, setFadePlaying] = useState(false)
  const [sliderPos, setSliderPos] = useState(50)
  const [intensity, setIntensity] = useState(4)
  const [threshold, setThreshold] = useState(8)
  const [flickerMs, setFlickerMs] = useState('600')
  const [flickerPlaying, setFlickerPlaying] = useState(() => !reduceMotion())
  const [showB, setShowB] = useState(false)
  const [diff, setDiff] = useState<ImageDiffResult | null>(null)
  const [diffBusy, setDiffBusy] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const pixels = useRef<{ a?: ImageData; b?: ImageData }>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const urls = useRef<string[]>([])

  const W = a && b ? Math.max(a.width, b.width) : 1
  const H = a && b ? Math.max(a.height, b.height) : 1
  const vw = Math.max(50, size.w)
  const vh = Math.max(50, size.h)

  // Release object URLs on unmount.
  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  // While `autoFit` is on the image follows the viewport size; manual zoom/pan turns it off.
  const autoFit = useRef(true)
  const fit = useCallback(() => {
    autoFit.current = true
    const z = Math.min(vw / W, vh / H, 8)
    setView({ zoom: z, x: (vw - W * z) / 2, y: (vh - H * z) / 2 })
  }, [vw, vh, W, H])

  useEffect(() => {
    if (a && b && autoFit.current) fit()
  }, [a, b, fit])

  const userView = useCallback((v: View) => {
    autoFit.current = false
    setView(v)
  }, [])
  const zoomBy = (f: number) => userView(zoomAround(view, view.zoom * f, vw / 2, vh / 2))
  const actualSize = () => userView({ zoom: 1, x: (vw - W) / 2, y: (vh - H) / 2 })

  const setImage = async (side: 'a' | 'b', file: File) => {
    setBusy(true)
    try {
      const img = await loadImage(file)
      urls.current.push(img.url)
      const prev = side === 'a' ? a : b
      if (prev) URL.revokeObjectURL(prev.url)
      delete pixels.current[side]
      setDiff(null)
      if (side === 'a') setA(img)
      else setB(img)
      if (img.warning) toast(img.warning, 'info')
    } catch (e) {
      toast(friendlyError(e, 'Unable to read this image.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFiles = (side: 'a' | 'b') => (files: File[]) => {
    if (files.length >= 2) {
      void setImage('a', files[0])
      void setImage('b', files[1])
    } else void setImage(side, files[0])
  }

  const remove = (side: 'a' | 'b') => {
    const img = side === 'a' ? a : b
    if (img) URL.revokeObjectURL(img.url)
    delete pixels.current[side]
    setDiff(null)
    if (side === 'a') setA(null)
    else setB(null)
  }

  const swap = () => {
    setA(b)
    setB(a)
    pixels.current = { a: pixels.current.b, b: pixels.current.a }
    setDiff(null)
  }

  /* ----------------------------- difference ----------------------------- */

  useEffect(() => {
    if (!a || !b || mode !== 'difference') return
    let cancelled = false
    setDiffBusy(true)
    setDiffError(null)
    const t = setTimeout(async () => {
      try {
        pixels.current.a ??= await readPixels(a)
        pixels.current.b ??= await readPixels(b)
        if (cancelled) return
        await new Promise((r) => setTimeout(r, 0)) // let the spinner paint
        setDiff(computeImageDiff(pixels.current.a!, pixels.current.b!, { threshold, intensity }))
      } catch (e) {
        if (!cancelled)
          setDiffError(
            friendlyError(
              e,
              'Unable to compute the difference. The images may be too large for this browser.',
            ),
          )
      } finally {
        if (!cancelled) setDiffBusy(false)
      }
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [a, b, mode, threshold, intensity])

  useEffect(() => {
    if (mode !== 'difference' || !diff || !canvasRef.current) return
    const c = canvasRef.current
    c.width = diff.width
    c.height = diff.height
    const img = new ImageData(new Uint8ClampedArray(diff.image.data), diff.width, diff.height)
    c.getContext('2d')?.putImageData(img, 0, 0)
  }, [diff, mode])

  const downloadDiff = async () => {
    if (!a || !b) return
    try {
      let d = diff
      if (!d) {
        pixels.current.a ??= await readPixels(a)
        pixels.current.b ??= await readPixels(b)
        d = computeImageDiff(pixels.current.a, pixels.current.b, { threshold, intensity })
        setDiff(d)
      }
      const c = document.createElement('canvas')
      c.width = d.width
      c.height = d.height
      c.getContext('2d')!.putImageData(
        new ImageData(new Uint8ClampedArray(d.image.data), d.width, d.height),
        0,
        0,
      )
      c.toBlob((blob) => {
        if (blob) downloadBlob(blob, 'diffspace-image-difference.png')
        else toast('Unable to create the difference image.', 'error')
      }, 'image/png')
    } catch {
      toast('Unable to create the difference image.', 'error')
    }
  }

  /* ------------------------------- animation ----------------------------- */

  useEffect(() => {
    if (mode !== 'flicker' || !flickerPlaying) return
    const t = setInterval(() => setShowB((s) => !s), Math.max(250, Number(flickerMs)))
    return () => clearInterval(t)
  }, [mode, flickerPlaying, flickerMs])

  useEffect(() => {
    if (mode !== 'fade' || !fadePlaying) return
    let dir = 1
    const t = setInterval(() => {
      setFade((f) => {
        const n = f + dir * 2
        if (n >= 100) dir = -1
        if (n <= 0) dir = 1
        return Math.min(100, Math.max(0, n))
      })
    }, 40)
    return () => clearInterval(t)
  }, [mode, fadePlaying])

  /* -------------------------------- render ------------------------------- */

  const pixelated = view.zoom > 3 ? { imageRendering: 'pixelated' as const } : undefined
  const imgStyle = (i: LoadedImage): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    top: 0,
    width: i.width,
    height: i.height,
    maxWidth: 'none',
    userSelect: 'none',
    ...pixelated,
  })

  const imgEl = (i: LoadedImage, alt: string, extra: React.CSSProperties = {}) => (
    <img src={i.url} alt={alt} draggable={false} style={{ ...imgStyle(i), ...extra }} />
  )

  const stage = (children: React.ReactNode) => (
    <div ref={stageRef} style={{ width: W, height: H, position: 'relative' }}>
      {children}
    </div>
  )

  const content = () => {
    if (!a || !b) return null
    switch (mode) {
      case 'overlay':
        return stage(
          <>
            {imgEl(a, `Original: ${a.name}`)}
            {imgEl(b, `Modified: ${b.name}`, { opacity: opacity / 100 })}
          </>,
        )
      case 'fade':
        return stage(
          <>
            {imgEl(a, `Original: ${a.name}`, { opacity: 1 - fade / 100 })}
            {imgEl(b, `Modified: ${b.name}`, { opacity: fade / 100 })}
          </>,
        )
      case 'flicker':
        return stage(showB ? imgEl(b, `Modified: ${b.name}`) : imgEl(a, `Original: ${a.name}`))
      case 'difference':
        return diff ? (
          <canvas
            ref={canvasRef}
            aria-label="Difference between the images"
            style={{ width: diff.width, height: diff.height, ...pixelated }}
          />
        ) : null
      case 'slider':
        return stage(
          <>
            {imgEl(a, `Original: ${a.name}`)}
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${sliderPos}%)` }}>
              {imgEl(b, `Modified: ${b.name}`)}
            </div>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Comparison divider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(sliderPos)}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId) || !stageRef.current) return
                const r = stageRef.current.getBoundingClientRect()
                setSliderPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setSliderPos((p) => Math.max(0, p - 2))
                else if (e.key === 'ArrowRight') setSliderPos((p) => Math.min(100, p + 2))
                else return
                e.preventDefault()
                e.stopPropagation()
              }}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${sliderPos}%`,
                width: 24 / view.zoom,
                marginLeft: -12 / view.zoom,
                cursor: 'ew-resize',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: 2 / view.zoom,
                  background: 'var(--accent)',
                  transform: 'translateX(-50%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 28 / view.zoom,
                  height: 28 / view.zoom,
                  transform: 'translate(-50%,-50%)',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14 / view.zoom,
                  boxShadow: '0 1px 6px rgba(0,0,0,.4)',
                }}
              >
                ⇆
              </div>
            </div>
          </>,
        )
      default:
        return null
    }
  }

  const info = (img: LoadedImage | null, label: string, side: 'a' | 'b') => (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-[13px]">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {img ? (
          <div className="truncate text-muted" title={img.name}>
            {img.name} · {img.width}×{img.height}px · {img.format} · {formatBytes(img.size)}
          </div>
        ) : (
          <div className="text-muted">No image</div>
        )}
      </div>
      <FilePicker
        onFiles={onFiles(side)}
        accept={ACCEPT}
        label={img ? 'Replace' : 'Upload'}
        variant="ghost"
      />
      {img && (
        <IconButton label={`Remove ${label} image`} onClick={() => remove(side)}>
          <Trash2 size={16} />
        </IconButton>
      )}
    </div>
  )

  const drop = (side: 'a' | 'b', label: string, img: LoadedImage | null) => (
    <Dropzone
      onFiles={onFiles(side)}
      multiple
      label={`Drop image as ${label}`}
      className="min-h-[16rem] flex-1"
    >
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-panel p-6 text-center">
        {img ? (
          <img
            src={img.url}
            alt={`${label}: ${img.name}`}
            className="max-h-48 max-w-full rounded-lg object-contain"
          />
        ) : (
          <ImagePlus size={36} className="text-muted" aria-hidden />
        )}
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-sm text-muted">
            {img ? `${img.name} · ${img.width}×${img.height}px` : 'Drop an image here'}
          </p>
          <p className="text-xs text-muted">PNG, JPG, WEBP or GIF</p>
        </div>
        <FilePicker
          onFiles={onFiles(side)}
          accept={ACCEPT}
          label={img ? 'Replace image' : 'Choose image'}
          variant={img ? 'secondary' : 'primary'}
          size="md"
        />
      </div>
    </Dropzone>
  )

  const ready = a && b
  const sizeMismatch = ready && (a.width !== b.width || a.height !== b.height)

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5.25rem)] w-full max-w-[1800px] flex-col gap-3 p-3 md:h-[calc(100dvh-5.25rem)] md:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold leading-tight">Image Compare</h1>
          <p className="text-[13px] text-muted">
            Compare two images with slider, overlay, fade, flicker and pixel-difference views.
            Images never leave your browser.
          </p>
        </div>
        {ready && (
          <div className="flex gap-2">
            <Button size="sm" icon={<ArrowLeftRight size={15} aria-hidden />} onClick={swap}>
              Swap
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                remove('a')
                remove('b')
              }}
            >
              New comparison
            </Button>
          </div>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner size={14} /> Reading image…
        </div>
      )}

      {!ready ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
          {drop('a', 'Original', a)}
          {drop('b', 'Modified', b)}
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            {info(a, 'Original', 'a')}
            {info(b, 'Modified', 'b')}
          </div>
          {sizeMismatch && (
            <Notice kind="warn">
              The images have different dimensions ({a.width}×{a.height} vs {b.width}×{b.height}).
              They are aligned at the top-left corner and the uncovered area counts as different.
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Comparison mode" value={mode} onChange={setMode} options={MODES} />
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-panel px-1"
              role="group"
              aria-label="Zoom"
            >
              <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
                <ZoomOut size={16} />
              </IconButton>
              <span
                className="min-w-[3.2rem] text-center text-[13px] tabular-nums"
                aria-live="polite"
              >
                {Math.round(view.zoom * 100)}%
              </span>
              <IconButton label="Zoom in" onClick={() => zoomBy(1.25)}>
                <ZoomIn size={16} />
              </IconButton>
              <IconButton label="Fit to screen" onClick={fit}>
                <Maximize size={16} />
              </IconButton>
              <IconButton label="Actual size (100%)" onClick={actualSize}>
                <ScanSearch size={16} />
              </IconButton>
              <IconButton label="Reset zoom and position" onClick={fit}>
                <RotateCcw size={16} />
              </IconButton>
            </div>

            {(mode === 'overlay' || mode === 'fade') && (
              <label className="inline-flex items-center gap-2 text-[13px]">
                {mode === 'overlay' ? 'Opacity' : 'Fade'}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mode === 'overlay' ? opacity : fade}
                  onChange={(e) =>
                    mode === 'overlay'
                      ? setOpacity(Number(e.target.value))
                      : setFade(Number(e.target.value))
                  }
                  className="w-36 accent-[var(--accent)]"
                />
                <span className="w-9 tabular-nums text-muted">
                  {mode === 'overlay' ? opacity : fade}%
                </span>
              </label>
            )}
            {mode === 'fade' && (
              <Button
                size="sm"
                icon={
                  fadePlaying ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />
                }
                onClick={() => setFadePlaying((p) => !p)}
                active={fadePlaying}
              >
                {fadePlaying ? 'Pause' : 'Auto fade'}
              </Button>
            )}
            {mode === 'flicker' && (
              <>
                <Button
                  size="sm"
                  icon={
                    flickerPlaying ? (
                      <Pause size={14} aria-hidden />
                    ) : (
                      <Play size={14} aria-hidden />
                    )
                  }
                  onClick={() => setFlickerPlaying((p) => !p)}
                >
                  {flickerPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setFlickerPlaying(false)
                    setShowB((s) => !s)
                  }}
                >
                  Showing: {showB ? 'Modified' : 'Original'}
                </Button>
                <Select
                  label="Flicker speed"
                  value={flickerMs}
                  onChange={setFlickerMs}
                  options={[
                    { value: '300', label: 'Fast (0.3s)' },
                    { value: '600', label: 'Normal (0.6s)' },
                    { value: '1200', label: 'Slow (1.2s)' },
                    { value: '2500', label: 'Very slow (2.5s)' },
                  ]}
                />
              </>
            )}
            {mode === 'difference' && (
              <>
                <label className="inline-flex items-center gap-2 text-[13px]">
                  Intensity
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-28 accent-[var(--accent)]"
                  />
                  <span className="w-5 tabular-nums text-muted">{intensity}</span>
                </label>
                <label
                  className="inline-flex items-center gap-2 text-[13px]"
                  title="Ignore tiny colour differences up to this value (0–255)"
                >
                  Tolerance
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-28 accent-[var(--accent)]"
                  />
                  <span className="w-6 tabular-nums text-muted">{threshold}</span>
                </label>
              </>
            )}
            <Button
              size="sm"
              icon={<Download size={15} aria-hidden />}
              onClick={downloadDiff}
              className="md:ml-auto"
            >
              Download difference image
            </Button>
          </div>

          {mode === 'difference' && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]" aria-live="polite">
              {diffBusy ? (
                <span className="inline-flex items-center gap-2 text-muted">
                  <Spinner size={14} /> Calculating difference…
                </span>
              ) : diff ? (
                <>
                  <span className="rounded-md bg-[var(--del-bg)] px-2 py-1 font-medium text-del">
                    {diff.percent.toFixed(diff.percent < 1 ? 3 : 2)}% of pixels differ
                  </span>
                  <span className="text-muted">
                    {diff.changedPixels.toLocaleString()} of {diff.totalPixels.toLocaleString()}{' '}
                    pixels
                  </span>
                  {diff.changedPixels === 0 && (
                    <span className="font-medium text-add">The images are identical.</span>
                  )}
                </>
              ) : null}
              {diffError && <Notice kind="error">{diffError}</Notice>}
            </div>
          )}

          <div className="relative flex min-h-[22rem] flex-1 overflow-hidden rounded-xl border border-line bg-panel md:min-h-0">
            {mode === 'side' ? (
              <div className="grid min-h-0 w-full flex-1 grid-cols-1 md:grid-cols-2">
                {[a, b].map((img, i) => (
                  <div
                    key={i}
                    className="relative flex min-h-[14rem] flex-col border-line md:border-r md:last:border-r-0"
                  >
                    <div className="absolute left-2 top-2 z-10 rounded-md bg-panel/90 px-2 py-0.5 text-xs font-medium shadow">
                      {i === 0 ? 'Original' : 'Modified'}
                    </div>
                    <Pannable
                      view={view}
                      onView={userView}
                      onSize={i === 0 ? (w, h) => setSize({ w, h }) : undefined}
                      label={`${i === 0 ? 'Original' : 'Modified'} image`}
                      className="h-full w-full flex-1"
                    >
                      {stage(imgEl(img, `${i === 0 ? 'Original' : 'Modified'}: ${img.name}`))}
                    </Pannable>
                  </div>
                ))}
              </div>
            ) : (
              <Pannable
                view={view}
                onView={userView}
                onSize={(w, h) => setSize({ w, h })}
                label="Image comparison viewport. Drag to pan, scroll to zoom, arrow keys to move."
                className="h-full w-full flex-1"
              >
                {content()}
              </Pannable>
            )}
            {mode === 'slider' && (
              <>
                <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-panel/90 px-2 py-0.5 text-xs font-medium shadow">
                  Original
                </span>
                <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-panel/90 px-2 py-0.5 text-xs font-medium shadow">
                  Modified
                </span>
              </>
            )}
            {mode === 'flicker' && (
              <span
                className="pointer-events-none absolute left-2 top-2 rounded-md bg-panel/90 px-2 py-0.5 text-xs font-medium shadow"
                aria-live="off"
              >
                {showB ? 'Modified' : 'Original'}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
