/**
 * Validation utilities for input sanitization and data validation
 * Provides production-grade validation functions with proper error handling
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
 * Escapes HTML characters to prevent XSS attacks when rendering raw strings.
 * @param input - The string to escape
 * @returns Escaped string safely formatted for HTML injection
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates and sanitizes a phone number
 * @param phone - The phone number to validate
 * @returns Validated phone number or null if invalid
 */
export function validatePhone(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null
  }

  const sanitized = sanitizeString(phone)
  
  // Accept various phone formats: +221 77 123 45 67, 0771234567, etc.
  const phoneRegex = /^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/
  
  if (!phoneRegex.test(sanitized.replace(/\s/g, ''))) {
    return null
  }

  return sanitized
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

/**
 * Validates a name field (letters, spaces, hyphens, apostrophes)
 * @param name - The name to validate
 * @param minLength - Minimum length (default: 2)
 * @param maxLength - Maximum length (default: 100)
 * @returns Validated name or null if invalid
 */
export function validateName(name: string, minLength: number = 2, maxLength: number = 100): string | null {
  if (!name || typeof name !== 'string') {
    return null
  }

  const sanitized = sanitizeString(name)
  
  if (sanitized.length < minLength || sanitized.length > maxLength) {
    return null
  }

  // Allow letters, spaces, hyphens, apostrophes, and accented characters
  const nameRegex = /^[a-zA-Z\u00C0-\u017F\s\-']+$/
  
  if (!nameRegex.test(sanitized)) {
    return null
  }

  return sanitized
}

/**
 * Validates a numeric value
 * @param value - The value to validate
 * @param min - Minimum value (optional)
 * @param max - Maximum value (optional)
 * @returns Validated number or null if invalid
 */
export function validateNumber(value: string | number, min?: number, max?: number): number | null {
  const num = typeof value === 'string' ? parseFloat(value) : value
  
  if (isNaN(num)) {
    return null
  }

  if (min !== undefined && num < min) {
    return null
  }

  if (max !== undefined && num > max) {
    return null
  }

  return num
}

/**
 * Validates a quantity (positive integer)
 * @param quantity - The quantity to validate
 * @param max - Maximum quantity (default: 9999)
 * @returns Validated quantity or null if invalid
 */
export function validateQuantity(quantity: string | number, max: number = 9999): number | null {
  const num = validateNumber(quantity, 1, max)
  
  if (num === null || !Number.isInteger(num)) {
    return null
  }

  return num
}

/**
 * Validates a price/amount (positive number with up to 2 decimal places)
 * @param price - The price to validate
 * @param min - Minimum price (default: 0)
 * @param max - Maximum price (default: 999999999.99)
 * @returns Validated price or null if invalid
 */
export function validatePrice(price: string | number, min: number = 0, max: number = 999999999.99): number | null {
  const num = validateNumber(price, min, max)
  
  if (num === null) {
    return null
  }

  // Check for max 2 decimal places
  const decimalPlaces = (num.toString().split('.')[1] || '').length
  if (decimalPlaces > 2) {
    return null
  }

  return num
}

/**
 * Validates a UUID/GUID string
 * @param uuid - The UUID to validate
 * @returns Validated UUID or null if invalid
 */
export function validateUUID(uuid: string): string | null {
  if (!uuid || typeof uuid !== 'string') {
    return null
  }

  const sanitized = sanitizeString(uuid)
  
  // UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  
  if (!uuidRegex.test(sanitized)) {
    return null
  }

  return sanitized
}

/**
 * Validates a URL
 * @param url - The URL to validate
 * @param allowedProtocols - Array of allowed protocols (default: ['http', 'https'])
 * @returns Validated URL or null if invalid
 */
export function validateURL(url: string, allowedProtocols: string[] = ['http', 'https']): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  const sanitized = sanitizeString(url)
  
  try {
    const parsed = new URL(sanitized)
    
    if (!allowedProtocols.includes(parsed.protocol.replace(':', ''))) {
      return null
    }

    return sanitized
  } catch {
    return null
  }
}

/**
 * Validates an address/location string
 * @param address - The address to validate
 * @param minLength - Minimum length (default: 5)
 * @param maxLength - Maximum length (default: 500)
 * @returns Validated address or null if invalid
 */
export function validateAddress(address: string, minLength: number = 5, maxLength: number = 500): string | null {
  if (!address || typeof address !== 'string') {
    return null
  }

  const sanitized = sanitizeString(address)
  
  if (sanitized.length < minLength || sanitized.length > maxLength) {
    return null
  }

  return sanitized
}

/**
 * Validates a client type
 * @param type - The client type to validate
 * @returns Validated client type or null if invalid
 */
export function validateClientType(type: string): string | null {
  const validTypes = ['Particulier', 'Entreprise', '']
  
  if (!validTypes.includes(type)) {
    return null
  }

  return type
}

/**
 * Validates a container preference
 * @param container - The container preference to validate
 * @returns Validated container or null if invalid
 */
export function validateContainer(container: string): string | null {
  const validContainers = ['Bouteille 10L', 'F 19L', 'Bouteille 11L', 'Réservoir', '']
  
  if (!validContainers.includes(container)) {
    return null
  }

  return container
}

/**
 * Validates a contact preference
 * @param preference - The contact preference to validate
 * @returns Validated preference or null if invalid
 */
export function validateContactPreference(preference: string): string | null {
  const validPreferences = ['Téléphone', 'WhatsApp', 'Email', '']
  
  if (!validPreferences.includes(preference)) {
    return null
  }

  return preference
}

/**
 * Validates a user role
 * @param role - The role to validate
 * @returns Validated role or null if invalid
 */
export function validateRole(role: string): string | null {
  const validRoles = ['fontainier', 'commercial', 'administrateur']
  
  if (!validRoles.includes(role)) {
    return null
  }

  return role
}

/**
 * Sanitizes and validates an object by applying validation rules to each field
 * @param data - The object to validate
 * @param schema - Validation schema mapping field names to validation functions
 * @returns Validated object or null if any field is invalid
 */
export function validateObject<T extends Record<string, any>>(
  data: T,
  schema: Partial<Record<keyof T, (value: any) => any>>
): T | null {
  const result: any = {}
  
  for (const [key, validator] of Object.entries(schema)) {
    const value = data[key]
    const validated = validator?.(value)
    
    if (validated === null && value !== null && value !== undefined && value !== '') {
      return null
    }
    
    result[key] = validated
  }

  return result as T
}

/**
 * Creates a validation error message
 * @param field - The field name
 * @param type - The validation type
 * @returns Error message
 */
export function getValidationErrorMessage(field: string, type: string): string {
  const messages: Record<string, string> = {
    required: `${field} est obligatoire`,
    invalid: `${field} est invalide`,
    tooShort: `${field} est trop court`,
    tooLong: `${field} est trop long`,
    invalidEmail: `${field} n'est pas une adresse email valide`,
    invalidPhone: `${field} n'est pas un numéro de téléphone valide`,
    invalidNumber: `${field} doit être un nombre valide`,
    invalidUUID: `${field} n'est pas un identifiant valide`,
  }

  return messages[type] || `${field} est invalide`
}
