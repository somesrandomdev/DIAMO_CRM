/**
 * Performance utilities for the Diam'o application
 * Provides production-grade performance optimization functions
 */

/**
 * Debounce function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}

/**
 * Throttle function that invokes func at most once per every limit milliseconds.
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Memoize function that caches the results of expensive function calls.
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
    const key = resolver ? resolver(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = func.apply(this, args)
    cache.set(key, result)

    return result
  } as T
}

/**
 * Request Idle Callback polyfill for browsers that don't support it
 */
export const requestIdleCallback =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback): number => {
        const start = Date.now()
        return setTimeout(() => {
          cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          })
        }, 1) as unknown as number
      }

/**
 * Cancel Idle Callback polyfill
 */
export const cancelIdleCallback =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : (id: number): void => {
        clearTimeout(id)
      }

/**
 * Schedule a task to run during browser idle periods
 */
export function scheduleIdleTask(callback: () => void, options?: IdleRequestOptions): number {
  return requestIdleCallback(callback, options)
}

/**
 * Chunk an array into smaller arrays for batch processing
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Process items in batches with a delay between batches
 * Useful for preventing UI blocking when processing large datasets
 */
export async function processBatched<T, R>(
  items: T[],
  processor: (item: T) => R | Promise<R>,
  batchSize: number = 10,
  delayMs: number = 0
): Promise<R[]> {
  const results: R[] = []
  const batches = chunkArray(items, batchSize)

  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    if (delayMs > 0) {
      await sleep(delayMs)
    }
  }

  return results
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  label: string,
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`)
  }

  return { result, duration }
}

/**
 * Create a performance marker for the Performance API
 */
export function markPerformance(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name)
  }
}

/**
 * Measure performance between two marks
 */
export function measurePerformance(name: string, startMark: string, endMark: string): void {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark)
      const entries = performance.getEntriesByName(name, 'measure')
      if (entries.length > 0 && process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${name}: ${entries[0].duration.toFixed(2)}ms`)
      }
    } catch {
      // Marks may not exist, ignore
    }
  }
}

/**
 * Intersection Observer utility for lazy loading
 */
export function createIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null
  }

  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  })
}

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Preload multiple images
 */
export async function preloadImages(sources: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(sources.map(preloadImage))
}

/**
 * Check if the browser supports passive event listeners
 */
export function supportsPassiveEvents(): boolean {
  let supported = false
  try {
    const options: AddEventListenerOptions = {
      get passive(): boolean {
        supported = true
        return true
      },
    }
    window.addEventListener('test' as keyof WindowEventMap, () => {}, options)
    window.removeEventListener('test' as keyof WindowEventMap, () => {}, options)
  } catch {
    supported = false
  }
  return supported
}

/**
 * Add an event listener with passive support for better scroll performance
 */
export function addPassiveEventListener(
  element: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions
): void {
  const passiveOptions = supportsPassiveEvents()
    ? { passive: true, ...options }
    : options

  element.addEventListener(type, listener, passiveOptions)
}

/**
 * Remove an event listener
 */
export function removePassiveEventListener(
  element: EventTarget,
  type: string,
  listener: EventListener,
  options?: EventListenerOptions
): void {
  element.removeEventListener(type, listener, options)
}

/**
 * Virtual scrolling helper - calculate visible range
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 3
): { startIndex: number; endIndex: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  return { startIndex, endIndex }
}

/**
 * RAF-based animation frame scheduler
 */
export class AnimationFrameScheduler {
  private rafId: number | null = null
  private callbacks: Set<() => void> = new Set()

  schedule(callback: () => void): void {
    this.callbacks.add(callback)

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null
        const callbacks = Array.from(this.callbacks)
        this.callbacks.clear()
        callbacks.forEach((cb) => cb())
      })
    }
  }

  cancel(callback: () => void): void {
    this.callbacks.delete(callback)
  }

  cancelAll(): void {
    this.callbacks.clear()
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

/**
 * Global animation frame scheduler instance
 */
export const rafScheduler = new AnimationFrameScheduler()
