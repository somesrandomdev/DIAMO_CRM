/**
 * Security utilities for the Diam'o application
 * Provides production-grade security functions for XSS prevention, input sanitization, and auth security
 */

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(html: unknown): string {
  if (html === null || html === undefined || html === '') {
    return ''
  }
  const htmlStr = String(html)

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }

  return htmlStr.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * Strips all HTML tags from a string
 * @param html - The HTML string to strip
 * @returns Plain text string
 */
export function stripHTML(html: unknown): string {
  if (html === null || html === undefined || html === '') {
    return ''
  }

  const htmlStr = String(html)
  return htmlStr.replace(/<[^>]*>/g, '')
}

/**
 * Validates and sanitizes user input for display
 * @param input - The input string to sanitize
 * @returns Safe string for display
 */
export function sanitizeForDisplay(input: unknown): string {
  if (input === null || input === undefined || input === '') {
    return ''
  }

  return sanitizeHTML(String(input).trim())
}

/**
 * Creates a Content Security Policy nonce
 * @returns Random nonce string
 */
export function generateCSPNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validates a password strength
 * @param password - The password to validate
 * @returns Object with validation result and strength score
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  if (!password || typeof password !== 'string') {
    return { isValid: false, score: 0, feedback: ['Password is required'] }
  }

  // Length check
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('Password should be at least 8 characters')
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Add uppercase letters')
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Add lowercase letters')
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1
  } else {
    feedback.push('Add numbers')
  }

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1
  } else {
    feedback.push('Add special characters')
  }

  return {
    isValid: score >= 4,
    score,
    feedback: feedback.length > 0 ? feedback : ['Strong password'],
  }
}

/**
 * Checks if a string contains potential SQL injection patterns
 * @param input - The input string to check
 * @returns True if suspicious patterns found
 */
export function hasSQLInjectionPatterns(input: string): boolean {
  if (typeof input !== 'string') {
    return false
  }

  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--)|(\/\*)|(\*\/)/,
    /(\bOR\b|\bAND\b)\s*['"]?\d+['"]?\s*=\s*['"]?\d+/i,
    /['"];\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/i,
  ]

  return suspiciousPatterns.some((pattern) => pattern.test(input))
}

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

/**
 * Secure token storage utility
 */
export const SecureTokenStorage = {
  /**
   * Store a token securely
   * @param key - Storage key
   * @param token - Token value
   */
  setToken(key: string, token: string): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      // Use sessionStorage for sensitive tokens (cleared on tab close)
      sessionStorage.setItem(key, btoa(token))
    } catch {
      console.error('Failed to store token securely')
    }
  },

  /**
   * Retrieve a stored token
   * @param key - Storage key
   * @returns Token value or null
   */
  getToken(key: string): string | null {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const encoded = sessionStorage.getItem(key)
      return encoded ? atob(encoded) : null
    } catch {
      return null
    }
  },

  /**
   * Remove a stored token
   * @param key - Storage key
   */
  removeToken(key: string): void {
    if (typeof window === 'undefined') {
      return
    }

    sessionStorage.removeItem(key)
  },

  /**
   * Clear all stored tokens
   */
  clearAll(): void {
    if (typeof window === 'undefined') {
      return
    }

    sessionStorage.clear()
  },
}

/**
 * Validates that a redirect URL is safe (same origin)
 * @param url - The URL to validate
 * @returns True if safe
 */
export function isSafeRedirectURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Allow relative URLs
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true
  }

  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Generates a secure random string
 * @param length - Length of the string (default: 32)
 * @returns Random string
 */
export function generateSecureRandomString(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length)
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
