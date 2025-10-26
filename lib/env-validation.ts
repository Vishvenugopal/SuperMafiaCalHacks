/**
 * Environment variable validation
 * Validates required environment variables on startup
 */

export interface EnvValidationResult {
  valid: boolean
  missing: string[]
  warnings: string[]
}

export function validateEnvironment(): EnvValidationResult {
  const required = [
    'BASETEN_API_KEY',
    'BASETEN_MODEL_ID',
  ]

  const optional = [
    'JANITOR_AI_API_KEY',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'LIVEKIT_WS_URL',
  ]

  const missing: string[] = []
  const warnings: string[] = []

  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  // Check optional variables and warn if missing
  for (const key of optional) {
    if (!process.env[key]) {
      warnings.push(key)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

/**
 * Log environment validation results
 */
export function logEnvValidation(result: EnvValidationResult) {
  if (result.valid) {
    console.log('✅ All required environment variables are set')
  } else {
    console.error('❌ Missing required environment variables:', result.missing)
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ Optional environment variables not set:', result.warnings)
    console.warn('Some features may not work without these variables')
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (!value && defaultValue) {
    return defaultValue
  }
  if (!value) {
    console.warn(`Environment variable ${key} is not set`)
  }
  return value || ''
}


