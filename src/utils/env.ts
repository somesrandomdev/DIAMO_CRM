/**
 * Environment configuration and validation
 * Ensures all required environment variables are present and valid
 */

interface EnvConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  appUrl: string
  nodeEnv: 'development' | 'production' | 'test'
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
  sentryDsn?: string
}

/**
 * Validates that a required environment variable is present
 * @param key - Environment variable key
 * @param defaultValue - Optional default value
 * @returns Environment variable value
 * @throws Error if variable is missing and no default provided
 */
function getRequiredEnv(key: string, defaultValue?: string): string {
  const value = import.meta.env[key] || defaultValue
  
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

/**
 * Validates a URL environment variable
 * @param key - Environment variable key
 * @param defaultValue - Optional default value
 * @returns Validated URL
 * @throws Error if URL is invalid
 */
function getEnvUrl(key: string, defaultValue?: string): string {
  const value = getRequiredEnv(key, defaultValue)
  
  try {
    new URL(value)
    return value
  } catch {
    throw new Error(`Invalid URL for environment variable: ${key}`)
  }
}

/**
 * Gets the application configuration from environment variables
 * @returns Validated environment configuration
 */
export function getEnvConfig(): EnvConfig {
  const nodeEnv = (getRequiredEnv('MODE', 'development') as 'development' | 'production' | 'test')
  
  return {
    supabaseUrl: getEnvUrl('VITE_SUPABASE_URL'),
    supabaseAnonKey: getRequiredEnv('VITE_SUPABASE_ANON_KEY'),
    appUrl: getEnvUrl('VITE_APP_URL', window.location.origin),
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  }
}

/**
 * Lazy-loaded environment configuration
 * Only validates environment variables when first accessed
 */
let envConfig: EnvConfig | null = null

export function useEnv(): EnvConfig {
  if (!envConfig) {
    envConfig = getEnvConfig()
  }
  return envConfig
}

/**
 * Validates environment variables on application startup
 * Call this in main.tsx to fail fast if configuration is invalid
 */
export function validateEnv(): void {
  try {
    getEnvConfig()
    console.log('✓ Environment configuration validated')
  } catch (error) {
    console.error('✗ Environment configuration error:', error)
    throw error
  }
}

/**
 * Gets a feature flag value
 * @param flag - Feature flag name
 * @param defaultValue - Default value if flag is not set
 * @returns Feature flag value
 */
export function getFeatureFlag(flag: string, defaultValue: boolean = false): boolean {
  const value = import.meta.env[`VITE_FEATURE_${flag.toUpperCase()}`]
  return value === 'true' || value === '1' || defaultValue
}

/**
 * Feature flags for the application
 */
export const featureFlags = {
  enableAnalytics: getFeatureFlag('analytics', false),
  enableDebugMode: getFeatureFlag('debug', false),
  enableNewUI: getFeatureFlag('new_ui', true),
  enableAdvancedSearch: getFeatureFlag('advanced_search', true),
} as const

/**
 * API configuration
 */
export const apiConfig = {
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
  retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000', 10),
} as const

/**
 * Storage configuration
 */
export const storageConfig = {
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760', 10), // 10MB default
  allowedFileTypes: (import.meta.env.VITE_ALLOWED_FILE_TYPES || 'image/*,application/pdf').split(','),
} as const
