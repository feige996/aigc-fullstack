type EnvMap = Record<string, string | undefined>

const weakSecretValues = new Set([
  '',
  'change-me',
  'changeme',
  'dev_access_secret',
  'minioadmin',
  'replace-me',
  'secret',
  'password',
  'test',
  'test-secret'
])

function isProduction(env: EnvMap) {
  return (env.NODE_ENV ?? '').toLowerCase() === 'production'
}

function isBlank(value?: string) {
  return !value || value.trim().length === 0
}

function isWeakSecret(value: string) {
  const normalized = value.trim().toLowerCase()

  return weakSecretValues.has(normalized) || normalized.length < 32
}

function isLocalHost(value: string) {
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function requireValue(
  env: EnvMap,
  key: string,
  errors: string[],
  options?: {
    allowWeak?: boolean
    allowLocalhostInProduction?: boolean
    legacyKeys?: string[]
  }
) {
  const legacyKeys = options?.legacyKeys ?? []
  const value = env[key] ?? legacyKeys.map((legacyKey) => env[legacyKey]).find((item) => !isBlank(item))

  if (typeof value !== 'string' || isBlank(value)) {
    const legacySuffix = legacyKeys.length > 0 ? ` (or ${legacyKeys.join(', ')})` : ''
    errors.push(`${key}${legacySuffix} is required`)
    return undefined
  }

  const trimmed = value.trim()
  if (!options?.allowWeak && isProduction(env) && isWeakSecret(trimmed)) {
    errors.push(`${key} must be a strong random secret in production`)
  }

  if (!options?.allowLocalhostInProduction && isProduction(env) && isLocalHost(trimmed)) {
    errors.push(`${key} cannot point to localhost in production`)
  }

  return trimmed
}

function validateUrl(
  env: EnvMap,
  key: string,
  errors: string[],
  allowedProtocols: string[],
  options?: {
    allowLocalhostInProduction?: boolean
  }
) {
  const value = requireValue(env, key, errors, options)

  if (!value) {
    return undefined
  }

  try {
    const parsed = new URL(value)
    if (!allowedProtocols.includes(parsed.protocol.replace(/:$/, ''))) {
      errors.push(`${key} must use one of: ${allowedProtocols.join(', ')}`)
    }
  } catch {
    errors.push(`${key} must be a valid URL`)
  }

  return value
}

function validateInteger(
  env: EnvMap,
  key: string,
  errors: string[],
  options?: {
    min?: number
  }
) {
  const raw = env[key]

  if (isBlank(raw)) {
    return undefined
  }

  const value = Number(raw)
  if (!Number.isInteger(value)) {
    errors.push(`${key} must be an integer`)
    return undefined
  }

  if (options?.min !== undefined && value < options.min) {
    errors.push(`${key} must be greater than or equal to ${options.min}`)
  }

  return String(value)
}

export function validateEnv(env: EnvMap) {
  const errors: string[] = []
  const production = isProduction(env)
  const normalized: EnvMap = { ...env }

  const databaseUrl = validateUrl(env, 'DATABASE_URL', errors, ['mysql', 'mysql2'])
  if (databaseUrl) {
    normalized.DATABASE_URL = databaseUrl
  }

  const rabbitmqUrl = validateUrl(env, 'RABBITMQ_URL', errors, ['amqp', 'amqps'])
  if (rabbitmqUrl) {
    normalized.RABBITMQ_URL = rabbitmqUrl
  }

  const jwtSecret = requireValue(env, 'JWT_ACCESS_SECRET', errors, {
    legacyKeys: ['JWT_SECRET']
  })
  if (jwtSecret) {
    normalized.JWT_ACCESS_SECRET = jwtSecret
  }

  const sseSecret = requireValue(env, 'SSE_TICKET_SECRET', errors)
  if (sseSecret) {
    normalized.SSE_TICKET_SECRET = sseSecret
  }

  const objectStorageEndpoint = validateUrl(env, 'OBJECT_STORAGE_ENDPOINT', errors, [
    'http',
    'https'
  ])
  if (objectStorageEndpoint) {
    normalized.OBJECT_STORAGE_ENDPOINT = objectStorageEndpoint
  }

  const objectStorageBucket = requireValue(env, 'OBJECT_STORAGE_BUCKET', errors)
  if (objectStorageBucket) {
    normalized.OBJECT_STORAGE_BUCKET = objectStorageBucket
  }

  const objectStorageAccessKey = requireValue(env, 'OBJECT_STORAGE_ACCESS_KEY', errors)
  if (objectStorageAccessKey) {
    normalized.OBJECT_STORAGE_ACCESS_KEY = objectStorageAccessKey
  }

  const objectStorageSecretKey = requireValue(env, 'OBJECT_STORAGE_SECRET_KEY', errors)
  if (objectStorageSecretKey) {
    normalized.OBJECT_STORAGE_SECRET_KEY = objectStorageSecretKey
  }

  if (production) {
    const strongSecrets = [
      ['JWT_ACCESS_SECRET', normalized.JWT_ACCESS_SECRET],
      ['SSE_TICKET_SECRET', normalized.SSE_TICKET_SECRET],
      ['OBJECT_STORAGE_ACCESS_KEY', normalized.OBJECT_STORAGE_ACCESS_KEY],
      ['OBJECT_STORAGE_SECRET_KEY', normalized.OBJECT_STORAGE_SECRET_KEY]
    ] as const

    for (const [key, value] of strongSecrets) {
      if (!value || isWeakSecret(value)) {
        errors.push(`${key} must be replaced with a strong production value`)
      }
    }

    if (normalized.DATABASE_URL && isLocalHost(normalized.DATABASE_URL)) {
      errors.push('DATABASE_URL cannot point to localhost in production')
    }

    if (normalized.RABBITMQ_URL && isLocalHost(normalized.RABBITMQ_URL)) {
      errors.push('RABBITMQ_URL cannot point to localhost in production')
    }

    if (normalized.OBJECT_STORAGE_ENDPOINT && isLocalHost(normalized.OBJECT_STORAGE_ENDPOINT)) {
      errors.push('OBJECT_STORAGE_ENDPOINT cannot point to localhost in production')
    }
  }

  validateInteger(env, 'JWT_REFRESH_EXPIRES_DAYS', errors, { min: 1 })
  validateInteger(env, 'PROVIDER_MAX_RETRIES', errors, { min: 0 })

  if (env.JWT_ACCESS_EXPIRES_IN !== undefined && isBlank(env.JWT_ACCESS_EXPIRES_IN)) {
    errors.push('JWT_ACCESS_EXPIRES_IN cannot be blank')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`)
  }

  return normalized
}
