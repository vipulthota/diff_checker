import type { TextDiffOptions, TextDiffResult } from '../types/diff'
import type { SheetData, SheetDiffOptions, SheetDiffResult } from '../types/sheet'
import type { WorkerRequest, WorkerResponse } from '../workers/protocol'

/**
 * Runs expensive comparisons off the main thread so the UI never freezes.
 * A new request cancels the previous one (the worker is recycled), so typing
 * quickly on huge inputs never queues up stale work.
 */
class DiffWorkerClient {
  private worker: Worker | null = null
  private seq = 0
  private pending: {
    id: number
    resolve: (v: unknown) => void
    reject: (e: Error) => void
  } | null = null

  private spawn(): Worker {
    const w = new Worker(new URL('../workers/diff.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (!this.pending || this.pending.id !== msg.id) return
      const p = this.pending
      this.pending = null
      if (msg.ok) p.resolve(msg.result)
      else p.reject(new Error(msg.error))
    }
    w.onerror = () => {
      const p = this.pending
      this.pending = null
      this.worker = null
      p?.reject(new Error('The comparison worker crashed. The input may be too large.'))
    }
    return w
  }

  private run<T>(build: (id: number) => WorkerRequest): Promise<T> {
    if (this.pending) {
      this.pending.reject(new Error('cancelled'))
      this.pending = null
      this.worker?.terminate()
      this.worker = null
    }
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.pending = { id, resolve: resolve as (v: unknown) => void, reject }
      try {
        this.worker ??= this.spawn()
        this.worker.postMessage(build(id))
      } catch (e) {
        this.pending = null
        reject(e instanceof Error ? e : new Error('Unable to start the comparison worker'))
      }
    })
  }

  text(left: string, right: string, options: TextDiffOptions): Promise<TextDiffResult> {
    return this.run((id) => ({ id, kind: 'text', left, right, options }))
  }

  sheet(left: SheetData, right: SheetData, options: SheetDiffOptions): Promise<SheetDiffResult> {
    return this.run((id) => ({ id, kind: 'sheet', left, right, options }))
  }
}

// Separate instances so text and spreadsheet comparisons never cancel each other.
export const textWorker = new DiffWorkerClient()
export const sheetWorker = new DiffWorkerClient()
