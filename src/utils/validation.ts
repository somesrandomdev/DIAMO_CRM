/**
 * Validation utilities with callers in the codebase
 */

/**
 * Sanitizes a string input by removing potentially dangerous characters
 * @param input - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string')
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets to prevent XSS
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove inline event handlers
}

/**
 * Validates an email address
 * @param email - The email to validate
 * @returns Validated email or null if invalid
 */
export function validateEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null
  }

  const sanitized = sanitizeString(email.toLowerCase())

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(sanitized)) {
    return null
  }

  return sanitized
}
