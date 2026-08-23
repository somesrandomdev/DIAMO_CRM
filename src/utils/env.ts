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
