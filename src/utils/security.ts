/**
 * Rate limiter for preventing brute force attacks
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map()
  private maxAttempts: number
  private windowMs: number

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  /**
   * Check if an identifier is rate limited
   * @param identifier - The identifier to check (e.g., IP, email)
   * @returns True if rate limited
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(identifier) || []

    // Filter out old attempts
    const recentAttempts = attempts.filter((time) => now - time < this.windowMs)

    if (recentAttempts.length >= this.maxAttempts) {
      return true
    }

    // Add current attempt
    recentAttempts.push(now)
    this.attempts.set(identifier, recentAttempts)

    return false
  }

  /**
   * Reset attempts for an identifier
   * @param identifier - The identifier to reset
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier)
  }

  /**
   * Get remaining attempts for an identifier
   * @param identifier - The identifier to check
   * @returns Number of remaining attempts
   */
  getRemainingAttempts(identifier: string): number {
    const now = Date.now()
    const attempts = this.attempts.get(identifier) || []
    const recentAttempts = attempts.filter((time) => now - time < this.windowMs)

    return Math.max(0, this.maxAttempts - recentAttempts.length)
  }
}
