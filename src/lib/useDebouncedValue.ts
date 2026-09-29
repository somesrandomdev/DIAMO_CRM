import { useEffect, useState } from 'react'

/**
 * Returns `value` delayed by `delayMs`. Use the returned (debounced) value
 * for filtering/fetching while the UI keeps the immediate one for display.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
