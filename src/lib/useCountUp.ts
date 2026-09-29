import { useEffect, useRef, useState } from 'react'

/**
 * Animated 0 → target count-up over ~600ms with ease-out, driven by
 * requestAnimationFrame. Falls back to the instant value when the user
 * prefers reduced motion. Returns the current value (not the eased
 * progress) so callers format it once.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [value, setValue] = useState(() => (prefersReduced ? target : 0))
  const fromRef = useRef(0)

  useEffect(() => {
    if (prefersReduced) {
      setValue(target)
      return
    }

    const from = fromRef.current
    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, prefersReduced])

  return value
}
