/**
 * Performance optimization utilities
 * Provides memoization, debouncing, throttling, and other performance helpers
 */

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function - limits execution to once every wait milliseconds
 * @param func - Function to throttle
 * @param wait - Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, wait)
    }
  }
}

/**
 * Memoize function - caches results based on arguments
 * @param func - Function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = func(...args)
    cache.set(key, result)
    return result
  }) as T
}

/**
 * Request animation frame throttle
 * Optimizes animations and scroll handlers
 * @param callback - Function to execute
 * @returns Throttled function
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  callback: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null

  return function executedFunction(...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
    rafId = requestAnimationFrame(() => {
      callback(...args)
      rafId = null
    })
  }
}

/**
 * Lazy load images with Intersection Observer
 * @param img - Image element
 * @param src - Image source
 */
export function lazyLoadImage(img: HTMLImageElement, src: string): void {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src
          observer.unobserve(img)
        }
      })
    })
    observer.observe(img)
  } else {
    // Fallback for browsers without Intersection Observer
    img.src = src
  }
}

/**
 * Measure performance of a function
 * @param label - Performance label
 * @param fn - Function to measure
 * @returns Function result
 */
export async function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now()
  
  try {
    const result = await fn()
    const duration = performance.now() - start
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`)
    }
    
    return result
  } catch (error) {
    const duration = performance.now() - start
    console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms:`, error)
    throw error
  }
}

/**
 * Batch DOM updates to reduce reflows
 * @param updates - Array of update functions
 */
export function batchDOMUpdates(updates: Array<() => void>): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update())
  })
}

/**
 * Virtual scroll helper for large lists
 * Calculates visible items based on scroll position
 */
export interface VirtualScrollOptions {
  itemCount: number
  itemHeight: number
  containerHeight: number
  scrollTop: number
}

export interface VirtualScrollResult {
  visibleStartIndex: number
  visibleEndIndex: number
  offsetY: number
}

export function calculateVirtualScroll({
  itemCount,
  itemHeight,
  containerHeight,
  scrollTop,
}: VirtualScrollOptions): VirtualScrollResult {
  const visibleStartIndex = Math.floor(scrollTop / itemHeight)
  const visibleEndIndex = Math.min(
    visibleStartIndex + Math.ceil(containerHeight / itemHeight) + 1,
    itemCount
  )
  const offsetY = visibleStartIndex * itemHeight

  return {
    visibleStartIndex,
    visibleEndIndex,
    offsetY,
  }
}

/**
 * Cache utility with TTL (Time To Live)
 */
export class Cache<T> {
  private cache: Map<string, { value: T; expiry: number }> = new Map()
  private defaultTTL: number

  constructor(defaultTTL: number = 60000) {
    this.defaultTTL = defaultTTL
  }

  set(key: string, value: T, ttl: number = this.defaultTTL): void {
    const expiry = Date.now() + ttl
    this.cache.set(key, { value, expiry })
  }

  get(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * Create a singleton cache instance
 */
export const appCache = new Cache<any>(300000) // 5 minutes default TTL

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Check if device is mobile
 * @returns True if mobile device
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Check if device supports touch
 * @returns True if touch device
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Get network information (if available)
 * @returns Network information or null
 */
export function getNetworkInfo(): {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
} | null {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
  
  if (!connection) {
    return null
  }

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  }
}

/**
 * Optimize image loading based on network conditions
 * @param src - Image source
 * @returns Optimized image source
 */
export function optimizeImageForNetwork(src: string): string {
  const networkInfo = getNetworkInfo()
  
  if (!networkInfo) {
    return src
  }

  // If on slow connection or data saver mode, return lower quality
  if (networkInfo.saveData || networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
    // Add quality parameter if using a CDN that supports it
    if (src.includes('cloudinary.com') || src.includes('imgix.net')) {
      return src + (src.includes('?') ? '&' : '?') + 'q=50&w=400'
    }
  }

  return src
}
